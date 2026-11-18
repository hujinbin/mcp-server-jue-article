import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

test('作者昵称精准解析、文章总数与样本范围、分页以及真实 MCP 结果', async () => {
  const authorId = '5e941bb5617c0a3c4455f920';
  const unknownCountId = '5e941bb5617c0a3c4455f921';
  const profileOnlyId = '5e941bb5617c0a3c4455f922';
  const missingId = '5e941bb5617c0a3c4455f923';
  const user = { _id: authorId, nickname: '天明', articleNum: 47, fans: 3, focu: 8 };
  const articles = Array.from({ length: 47 }, (_, index) => ({
    _id: String(index + 1).padStart(24, '0'), userId: authorId,
    title: `公开文章 ${index + 1}`, nickname: '天明',
    description: '文章内容中的 13800138000 保留原文', readNum: 47 - index, likeNum: index,
    meta: { updatedAt: new Date(Date.UTC(2026, 0, 47 - index)).toISOString() },
  }));
  const requests = [];
  const site = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    requests.push(url);
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/api/view/search') {
      const keyword = url.searchParams.get('keyword');
      const found = keyword === '不存在' ? [] : keyword === '同名' ? [
        { _id: authorId, nickname: '同名' }, { _id: unknownCountId, nickname: '同名' }
      ] : [user, { _id: unknownCountId, nickname: '天明技术' }];
      response.end(JSON.stringify({ code: 200, userList: found, articleList: [] }));
      return;
    }
    if (url.pathname === '/api/view/userInfo') {
      const id = url.searchParams.get('id');
      const profile = id === authorId ? user : id === unknownCountId ? { _id: id, nickname: '未知总数' } : id === profileOnlyId ? { ...user, _id: id } : {};
      // 覆盖顶层详情、旧式 data 包装和缺少文章列表的详情。
      const body = id === profileOnlyId ? { code: 200, user: profile } : id === unknownCountId ? { code: 200, data: { user: profile, articleList: articles.slice(0, 20) } } : { code: 200, user: profile, articleList: articles.slice(0, 20) };
      response.end(JSON.stringify(body));
      return;
    }
    if (url.pathname === '/api/article/getArticleList') {
      assert.ok([authorId, profileOnlyId].includes(url.searchParams.get('userId')), '文章查询必须携带已确认的作者 ID');
      const page = Number(url.searchParams.get('page') || 1);
      response.end(JSON.stringify({ code: 200, data: articles.slice((page - 1) * 20, page * 20) }));
      return;
    }
    response.writeHead(404).end();
  });
  site.listen(0, '127.0.0.1');
  await once(site, 'listening');
  process.env.JUE_API_BASE_URL = `http://127.0.0.1:${site.address().port}/api`;
  process.env.JUE_SITE_URL = 'https://blog.example.com';
  process.env.MCP_AUTH_TOKEN = 'author-query-test-token';
  process.env.MCP_PORT = '0';
  const { startHTTP } = await import('../index.js');
  const server = startHTTP();
  await once(server, 'listening');
  const call = async (name, args) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/mcp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer author-query-test-token', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-03-26' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    assert.equal(response.status, 200);
    const rpc = await response.json();
    assert.equal(rpc.error, undefined);
    const payload = JSON.parse(rpc.result.content[0].text);
    assert.deepEqual(rpc.result.structuredContent, payload);
    return { result: rpc.result, payload };
  };
  try {
    const stats = await call('get_user_stats', { userId: '天明' });
    assert.equal(stats.result.isError, false);
    assert.equal(stats.payload.data.user.id, authorId);
    assert.equal(stats.payload.data.user.nickname, '天明');
    assert.equal(stats.payload.data.statistics.articleCount, 47);
    assert.equal(stats.payload.data.statistics.articleCountSource, 'author_profile');
    assert.equal(stats.payload.data.statistics.sampledArticleCount, 20);
    assert.equal(stats.payload.data.statistics.totalViews, articles.slice(0, 20).reduce((sum, article) => sum + article.readNum, 0));
    assert.match(stats.payload.data.queryScope, /公开作者资料记录/);
    assert.match(stats.payload.data.queryScope, /20 篇公开文章样本/);
    assert.equal(stats.payload.data.user.url, `https://blog.example.com/user/${authorId}`);
    assert.ok(requests.some(url => url.pathname === '/api/view/search' && url.searchParams.get('keyword') === '天明'));
    assert.ok(!requests.some(url => url.pathname === '/api/view/users'));
    assert.ok(!requests.some(url => url.pathname === '/api/view/userInfo' && url.searchParams.get('id') === '天明'));

    const unknown = await call('get_user_stats', { userId: unknownCountId });
    assert.equal(unknown.payload.data.statistics.articleCount, null);
    assert.equal(unknown.payload.data.statistics.articleCountSource, 'unavailable');
    const profileOnly = await call('get_user_stats', { userId: profileOnlyId });
    assert.equal(profileOnly.payload.data.statistics.articleCount, 47);
    assert.equal(profileOnly.payload.data.statistics.sampledArticleCount, 20);

    const smallPage = await call('search_articles_by_author', { author: '天明', page: 2, limit: 5 });
    assert.equal(smallPage.payload.data.pagination.total, 47);
    assert.equal(smallPage.payload.data.pagination.pages, 10);
    assert.equal(smallPage.payload.data.pagination.returnedCount, 5);
    assert.deepEqual(smallPage.payload.data.articles.map(article => article._id), articles.slice(5, 10).map(article => article._id));
    assert.equal(smallPage.payload.data.articles[0].description, articles[0].description);
    const largePage = await call('search_articles_by_author', { author: authorId, page: 2, limit: 30 });
    assert.deepEqual(largePage.payload.data.articles.map(article => article._id), articles.slice(30).map(article => article._id));
    assert.equal(largePage.payload.data.pagination.returnedCount, 17);
    await call('search_articles_by_author', { author: authorId, sortBy: 'views' });
    assert.ok(requests.some(url => url.pathname === '/api/article/getArticleList' && url.searchParams.get('sort') === 'hot'));

    for (const [name, args] of [
      ['get_user_stats', { userId: '同名' }],
      ['search_articles_by_author', { author: '同名' }],
      ['get_user_stats', { userId: '不存在' }],
      ['get_user_stats', { userId: missingId }],
      ['get_user_stats', { userId: '' }],
    ]) {
      const response = await call(name, args);
      assert.equal(response.result.isError, true);
      assert.equal(response.payload.success, false);
    }
    assert.ok(!requests.some(url => url.pathname === '/api/article/getArticleList' && !url.searchParams.get('userId')));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => site.close(resolve));
  }
});
