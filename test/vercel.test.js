import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import mcpHandler from '../api/mcp.js';
import healthHandler from '../api/health.js';

test('Vercel 预解析 JSON、无状态 MCP、路由、鉴权与跨域', async () => {
  process.env.MCP_AUTH_TOKEN = 'vercel-test-only-token';
  process.env.MCP_SERVER_NAME = 'vercel-test-server';
  process.env.MCP_ALLOWED_ORIGINS = 'https://plugin.example.com, https://second.example.com';
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  let parsedRequests = 0;
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const destination = config.rewrites.find(route => route.source === pathname)?.destination || pathname;
    if (destination === '/api/health') return healthHandler(req, res);
    if (destination !== '/api/mcp') return res.writeHead(404).end();
    // 模拟 Vercel 消费请求流，并在访问 req.body 时惰性解析 JSON。
    if (req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      Object.defineProperty(req, 'body', { get() {
        parsedRequests += 1;
        return body ? JSON.parse(body) : undefined;
      } });
    }
    await mcpHandler(req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Authorization: 'Bearer vercel-test-only-token',
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2025-03-26',
    Origin: 'https://plugin.example.com',
  };
  const call = async (path, method, params) => {
    const response = await fetch(`${base}${path}`, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal(response.headers.get('mcp-session-id'), null);
    const rpc = await response.json();
    assert.equal(rpc.error, undefined);
    return rpc.result;
  };
  try {
    const initialized = await call('/mcp', 'initialize', {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'vercel-test', version: '1' },
    });
    assert.equal(initialized.serverInfo.name, 'vercel-test-server');
    assert.ok(initialized.protocolVersion);
    // 各请求由独立实例处理，后续发现不依赖初始化所在函数实例。
    for (const path of ['/mcp/', '/mcp?source=plugin', '/api/mcp']) {
      const list = await call(path, 'tools/list', {});
      assert.ok(list.tools.find(tool => tool.name === 'search_articles_by_keyword'));
    }
    assert.equal(parsedRequests, 4);
    const notify = await fetch(`${base}/mcp`, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    assert.equal(notify.status, 202);
    const unauthorized = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...headers, Authorization: 'Bearer invalid' }, body: '{}' });
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get('access-control-allow-origin'), headers.Origin);
    const preflight = await fetch(`${base}/mcp/`, {
      method: 'OPTIONS', headers: { Origin: 'https://second.example.com', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://second.example.com');
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
    const forbidden = await fetch(`${base}/mcp`, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example.com' } });
    assert.equal(forbidden.status, 403);
    const forbiddenPost = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.example.com' }, body: '{}' });
    assert.equal(forbiddenPost.status, 403);
    assert.equal(forbiddenPost.headers.get('access-control-allow-origin'), null);
    const parsedBeforeErrors = parsedRequests;
    const malformedUnauthorized = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...headers, Authorization: 'Bearer invalid' }, body: '{' });
    assert.equal(malformedUnauthorized.status, 401);
    const malformedForbidden = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.example.com' }, body: '{' });
    assert.equal(malformedForbidden.status, 403);
    assert.equal(parsedRequests, parsedBeforeErrors);
    const malformed = await fetch(`${base}/mcp`, { method: 'POST', headers, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal((await malformed.json()).error.code, -32700);
    const browserGet = await fetch(`${base}/mcp`);
    assert.equal(browserGet.status, 401);
    const authorizedGet = await fetch(`${base}/mcp`, { headers: { Authorization: headers.Authorization } });
    assert.equal(authorizedGet.status, 405);
    assert.equal(authorizedGet.headers.get('allow'), 'POST');
    for (const path of ['/', '/health', '/health/', '/api/health']) {
      const response = await fetch(`${base}${path}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await response.json(), { status: 'ok', name: 'vercel-test-server', transport: 'streamable-http', endpoint: '/mcp' });
    }
    const head = await fetch(`${base}/health`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const healthPost = await fetch(`${base}/health`, { method: 'POST' });
    assert.equal(healthPost.status, 405);
    const missing = await fetch(`${base}/mcp-other`);
    assert.equal(missing.status, 404);
    delete process.env.MCP_AUTH_TOKEN;
    const unconfigured = await fetch(`${base}/mcp`, { method: 'POST', headers, body: '{}' });
    assert.equal(unconfigured.status, 503);
    const unconfiguredHealth = await fetch(`${base}/health`);
    assert.equal(unconfiguredHealth.status, 503);
    assert.equal((await unconfiguredHealth.json()).status, 'unconfigured');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('命令行 stdio 仍可初始化并发现文章工具', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../index.js', import.meta.url))],
    env: { ...process.env, MCP_TRANSPORT: 'stdio', MCP_AUTH_TOKEN: 'stdio-test-only-token' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'stdio-compat-test', version: '1' });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.ok(list.tools.find(tool => tool.name === 'search_articles_by_keyword'));
  } finally {
    await client.close();
  }
});
