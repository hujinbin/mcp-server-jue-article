import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

test('HTTP MCP 初始化、发现、检索、链接与鉴权', async () => {
  const site = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    assert.equal(url.searchParams.get('keyword'), 'react');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ code: 200, articleList: [{ _id: 'article123', title: 'React 示例' }] }));
  });
  site.listen(0, '127.0.0.1');
  await once(site, 'listening');
  process.env.JUE_API_BASE_URL = `http://127.0.0.1:${site.address().port}/api`;
  process.env.MCP_PORT = '0';
  process.env.MCP_AUTH_TOKEN = 'test-only-token';
  process.env.MCP_ALLOWED_ORIGINS = 'https://plugin.example.com';
  const { startHTTP } = await import('../index.js');
  const server = startHTTP();
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/mcp`;
  const headers = { Authorization: 'Bearer test-only-token', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-03-26' };
  const call = async (method, params) => {
    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    assert.equal(response.status, 200);
    const rpc = await response.json();
    assert.equal(rpc.error, undefined);
    return rpc.result;
  };
  try {
    const initialized = await call('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.ok(initialized.protocolVersion);
    const notify = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    assert.equal(notify.status, 202);
    const list = await call('tools/list', {});
    assert.ok(list.tools.find(tool => tool.name === 'search_articles_by_keyword'));
    const result = await call('tools/call', { name: 'search_articles_by_keyword', arguments: { keyword: 'react' } });
    assert.equal(JSON.parse(result.content[0].text).data.articles[0].url, 'https://jue.leheavengame.com/article/article123');
    const rejected = await fetch(endpoint, { method: 'POST' });
    assert.equal(rejected.status, 401);
    const preflight = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://plugin.example.com', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://plugin.example.com');
    const forbidden = await fetch(endpoint, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.example.com' } });
    assert.equal(forbidden.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => site.close(resolve));
  }
});
