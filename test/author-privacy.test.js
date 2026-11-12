import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { maskAuthorPhoneText } from '../services/authorPrivacy.js';

test('手机号展示脱敏覆盖常见格式，并保留 ID 和正常文字', () => {
  for (const phone of ['13800138000', '+8613800138000', '+86 138 0013 8000', '+86-138-0013-8000', '138-0013-8000', '138 0013 8000']) {
    assert.equal(maskAuthorPhoneText(`作者 ${phone} 的主页`), '作者 138****8000 的主页');
  }
  assert.equal(maskAuthorPhoneText('联系13800138000，备用13900138000'), '联系138****8000，备用139****8000');
  assert.equal(maskAuthorPhoneText('5e78138001380000edc11bfa9'), '5e78138001380000edc11bfa9');
  assert.equal(maskAuthorPhoneText('编号 138001380001'), '编号 138001380001');
  assert.equal(maskAuthorPhoneText('惊觉，前端开发者'), '惊觉，前端开发者');
  assert.equal(maskAuthorPhoneText(13800138000), '138****8000');
  assert.equal(maskAuthorPhoneText({ mobile: '13800138000' }), '');
});

test('作者列表、作者文章和用户统计的实际 MCP 响应不暴露作者手机号', async () => {
  const user = {
    _id: '5e78b81b14e8374edc11bfa9', nickname: '13800138000',
    headImg: 'https://cdn.example.com/avatar.png', introduce: '联系 +86 139 0013 8000，备用 137-0013-8000',
    job: '咨询 13600138000', company: '+86-135-0013-8000', articleNum: 16,
    mobile: '13400138000', phone: '13300138000', tel: '13200138000',
    meta: { registTime: '2026-01-01' },
  };
  const normal = { _id: '5e941bb5617c0a3c4455f920', nickname: '惊觉', introduce: '正常作者简介', articleNum: 3 };
  const articles = [{ _id: '6106845b142a06708bc9f854', title: '公开文章', nickname: user.nickname, userId: user._id, description: '文章摘要', readNum: 12, likeNum: 2 }];
  const site = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    let result;
    switch (url.pathname) {
      case '/api/view/users':
      case '/api/view/search':
        result = { code: 200, userList: [user, normal] };
        break;
      case '/api/view/userInfo':
        result = { code: 200, data: { user: url.searchParams.get('id') === 'direct-author' ? user : null } };
        break;
      case '/api/article/getArticleList':
        result = { code: 200, data: articles };
        break;
      default:
        res.writeHead(404).end();
        return;
    }
    res.end(JSON.stringify(result));
  });
  site.listen(0, '127.0.0.1');
  await once(site, 'listening');
  process.env.JUE_API_BASE_URL = `http://127.0.0.1:${site.address().port}/api`;
  process.env.JUE_SITE_URL = 'https://blog.example.com';
  process.env.MCP_AUTH_TOKEN = 'author-privacy-test-token';
  process.env.MCP_PORT = '0';
  const { startHTTP } = await import('../index.js');
  const server = startHTTP();
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${server.address().port}/mcp`;
  const call = async (name, args) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer author-privacy-test-token',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-03-26',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    assert.equal(response.status, 200);
    const rpc = await response.json();
    assert.equal(rpc.error, undefined);
    const data = JSON.parse(rpc.result.content[0].text);
    assert.equal(data.success, true);
    const serialized = JSON.stringify(rpc.result);
    for (const phone of ['13800138000', '139 0013 8000', '137-0013-8000', '13600138000', '135-0013-8000', user.mobile, user.phone, user.tel]) {
      assert.equal(serialized.includes(phone), false, `工具 ${name} 不得返回原始手机号`);
    }
    assert.doesNotMatch(serialized, /"(?:mobile|phone|tel)"\s*:/);
    return { result: rpc.result, data: data.data };
  };
  try {
    const listed = await call('list_authors', { keyword: user.nickname });
    assert.deepEqual(listed.result.structuredContent.data, listed.data);
    assert.equal(listed.data.keyword, '138****8000');
    assert.equal(listed.data.authors[0].nickname, '138****8000');
    assert.equal(listed.data.authors[0].introduce, '联系 139****8000，备用 137****8000');
    assert.equal(listed.data.authors[0].id, user._id);
    assert.equal(listed.data.authors[0].articleNum, 16);
    assert.equal(listed.data.authors[0].url, `https://blog.example.com/user/${user._id}`);
    assert.equal(listed.data.authors[1].nickname, '惊觉');
    assert.equal(listed.data.authors[1].url, `https://blog.example.com/user/${normal._id}`);

    const byAuthor = await call('search_articles_by_author', { author: user._id });
    assert.equal(byAuthor.data.author.nickname, '138****8000');
    assert.equal(byAuthor.data.author.articleNum, 16);
    assert.equal(byAuthor.data.articles[0].nickname, '138****8000');
    assert.equal(byAuthor.data.articles[0].description, '文章摘要');
    assert.equal(byAuthor.data.articles[0].url, `https://blog.example.com/article/${articles[0]._id}`);

    for (const identifier of ['direct-author', user._id]) {
      const stats = await call('get_user_stats', { userId: identifier });
      assert.equal(stats.data.user.nickname, '138****8000');
      assert.equal(stats.data.user.introduce, '联系 139****8000，备用 137****8000');
      assert.equal(stats.data.user.job, '咨询 136****8000');
      assert.equal(stats.data.user.company, '135****8000');
      assert.equal(stats.data.user.id, user._id);
      assert.equal(stats.data.statistics.articleCount, 1);
      assert.equal(stats.data.statistics.totalViews, 12);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => site.close(resolve));
  }
});
