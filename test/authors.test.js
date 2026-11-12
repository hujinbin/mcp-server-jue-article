import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

test('作者工具发现、公开字段、昵称搜索和分页边界', async () => {
  const requests = [];
  const recommended = [
    {
      _id: '5e78b81b14e8374edc11bfa9', nickname: '惊觉', headImg: 'https://cdn.example.com/avatar.png',
      introduce: '公开作者简介', articleNum: 5, password: 'private-password', mobile: 'private-mobile',
      email: 'private-email', role: 'private-role', meta: { registTime: 'private-time' },
    },
    { _id: '5e941bb5617c0a3c4455f920', nickname: '天明' },
  ];
  const site = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    requests.push(url);
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/view/search') {
      const users = url.searchParams.get('keyword') === '不存在' ? [] : [recommended[0]];
      res.end(JSON.stringify({ code: 200, userList: users, articleList: [], tagList: [] }));
      return;
    }
    assert.equal(url.pathname, '/api/view/users');
    res.end(JSON.stringify({ code: 200, userList: recommended }));
  });
  site.listen(0, '127.0.0.1');
  await once(site, 'listening');
  process.env.JUE_API_BASE_URL = `http://127.0.0.1:${site.address().port}/api`;
  process.env.JUE_SITE_URL = 'https://blog.example.com/';
  process.env.MCP_AUTH_TOKEN = 'authors-test-only-token';
  process.env.MCP_ALLOWED_ORIGINS = 'https://blog.example.com';
  process.env.MCP_PORT = '0';
  const { startHTTP } = await import('../index.js');
  const server = startHTTP();
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/mcp`;
  const headers = {
    Authorization: 'Bearer authors-test-only-token',
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Origin: 'https://blog.example.com',
    'MCP-Protocol-Version': '2025-03-26',
  };
  const call = async (method, params) => {
    const response = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), headers.Origin);
    const rpc = await response.json();
    assert.equal(rpc.error, undefined);
    return rpc.result;
  };
  const authors = args => call('tools/call', { name: 'list_authors', arguments: args });
  try {
    const list = await call('tools/list', {});
    assert.equal(list.tools.length, 9);
    assert.ok(list.tools.find(tool => tool.name === 'search_articles_by_author'));
    assert.ok(list.tools.find(tool => tool.name === 'search_articles_by_keyword'));
    const tool = list.tools.find(tool => tool.name === 'list_authors');
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.deepEqual(tool.inputSchema.properties.page.enum, [1]);

    const recommendedResult = await authors({});
    const data = JSON.parse(recommendedResult.content[0].text);
    assert.equal(recommendedResult.isError, false);
    assert.deepEqual(recommendedResult.structuredContent, data);
    assert.equal(data.success, true);
    assert.equal(data.data.returnedCount, 2);
    assert.deepEqual(data.data.authors[0], {
      id: recommended[0]._id, nickname: '惊觉', url: `https://blog.example.com/user/${recommended[0]._id}`,
      headImg: 'https://cdn.example.com/avatar.png', introduce: '公开作者简介', articleNum: 5,
    });
    assert.deepEqual(data.data.authors[1], {
      id: recommended[1]._id, nickname: '天明', url: `https://blog.example.com/user/${recommended[1]._id}`,
    });
    assert.match(data.data.queryScope, /推荐作者/);
    assert.equal(data.data.total, undefined);
    assert.equal(data.data.totalPages, undefined);
    assert.doesNotMatch(recommendedResult.content[0].text, /private-/);

    const limited = JSON.parse((await authors({ limit: 1 })).content[0].text);
    assert.equal(limited.data.authors.length, 1);
    const searched = JSON.parse((await authors({ keyword: '  惊觉  ', limit: 3 })).content[0].text);
    assert.equal(searched.data.keyword, '惊觉');
    assert.equal(searched.data.authors.length, 1);
    assert.match(searched.data.queryScope, /昵称搜索/);
    assert.equal(requests.at(-1).pathname, '/api/view/search');
    assert.equal(requests.at(-1).searchParams.get('keyword'), '惊觉');
    const empty = JSON.parse((await authors({ keyword: '不存在' })).content[0].text);
    assert.equal(empty.success, true);
    assert.equal(empty.data.returnedCount, 0);
    assert.deepEqual(empty.data.authors, []);

    const beforeInvalid = requests.length;
    for (const args of [{ page: 2 }, { page: 0 }, { limit: 21 }, { limit: 0 }, { keyword: {} }, { keyword: '长'.repeat(101) }]) {
      const invalid = await authors(args);
      assert.equal(invalid.isError, true);
    }
    assert.equal(requests.length, beforeInvalid);
    assert.match((await authors({ page: 2 })).content[0].text, /本工具当前仅处理第 1 页/);

    process.env.JUE_SITE_URL = 'javascript:invalid';
    const invalidSite = await authors({});
    assert.equal(invalidSite.isError, true);
    assert.match(invalidSite.content[0].text, /站点地址配置无效/);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => site.close(resolve));
  }
});
