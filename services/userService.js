import * as http from './httpClient.js';
import { maskAuthorPhoneText } from './authorPrivacy.js';

/**
 * 列出公开接口返回的推荐作者，或按昵称检索作者。
 */
export async function listAuthors(page = 1, limit = 20, keyword = '') {
  if (page !== 1) {
    return { success: false, message: '本工具当前仅处理第 1 页推荐或昵称搜索样本，请使用第 1 页或按昵称搜索', data: null };
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    return { success: false, message: '作者返回数量必须是 1 到 20 的整数', data: null };
  }
  if (typeof keyword !== 'string' || keyword.trim().length > 100) {
    return { success: false, message: '作者关键词必须是最多 100 个字符的文本', data: null };
  }

  try {
    const query = keyword.trim();
    const result = query
      ? await http.get('/view/search', { keyword: query })
      : await http.get('/view/users', {});
    // 搜索接口同时返回文章列表，兼容 HTTP 工具对两种公开响应的包装。
    const users = result?.users || result?.userList;
    if (!Array.isArray(users)) {
      return { success: false, message: '公开接口未返回作者列表', data: null };
    }

    const site = new URL(process.env.JUE_SITE_URL || 'https://jue.leheavengame.com');
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) {
      return { success: false, message: '作者主页站点地址配置无效', data: null };
    }
    const authors = users.filter(user => user && user._id && typeof user.nickname === 'string')
      .slice(0, limit)
      .map(user => {
        const author = {
          id: String(user._id),
          nickname: maskAuthorPhoneText(user.nickname),
          url: new URL(`/user/${encodeURIComponent(user._id)}`, site.origin).href,
        };
        if (typeof user.headImg === 'string') author.headImg = user.headImg;
        if (typeof user.introduce === 'string') author.introduce = maskAuthorPhoneText(user.introduce);
        if (Number.isInteger(user.articleNum) && user.articleNum >= 0) author.articleNum = user.articleNum;
        return author;
      });

    return {
      success: true,
      data: {
        authors,
        returnedCount: authors.length,
        page: 1,
        limit,
        keyword: maskAuthorPhoneText(query),
        queryScope: query
          ? '本工具当前返回昵称搜索的第 1 页匹配作者样本，最多 20 位，不提供作者总数'
          : '本工具当前返回推荐作者的第 1 页样本，最多 20 位，不提供作者总数',
      },
    };
  } catch (error) {
    return { success: false, message: `获取作者列表失败，${maskAuthorPhoneText(error.message)}`, data: null };
  }
}

/**
 * 用作者 ID 或昵称解析公开资料，重名时由调用方确认作者。
 */
export async function resolveAuthor(userIdentifier) {
  if (typeof userIdentifier !== 'string' || !userIdentifier.trim() || userIdentifier.trim().length > 100) {
    return { success: false, message: '请提供最多 100 个字符的作者昵称或用户 ID', data: null };
  }
  const identifier = userIdentifier.trim();
  let userId = identifier;
  if (!/^[a-f0-9]{24}$/i.test(identifier)) {
    const found = await http.get('/view/search', { keyword: identifier });
    const users = (found?.users || found?.userList || []).filter(user => user && user._id && typeof user.nickname === 'string');
    const exact = users.filter(user => user.nickname.trim().toLowerCase() === identifier.toLowerCase());
    const matching = exact.length ? exact : users.filter(user => user.nickname.toLowerCase().includes(identifier.toLowerCase()));
    if (matching.length !== 1) {
      return {
        success: false,
        message: matching.length ? '找到多位匹配作者，请使用作者主页中的用户 ID 确认' : '公开昵称搜索中未找到匹配作者',
        data: { candidates: matching.map(user => ({ id: String(user._id), nickname: maskAuthorPhoneText(user.nickname) })) },
      };
    }
    userId = String(matching[0]._id);
  }
  const profile = await http.get('/view/userInfo', { id: userId });
  if (!profile?.user?._id || String(profile.user._id) !== userId) {
    return { success: false, message: '公开接口未返回该作者的有效资料', data: null };
  }
  return { success: true, data: { user: profile.user, articles: profile.articleList || profile.article } };
}

/**
 * 获取作者统计，区分作者资料中的文章数与分页样本的阅读点赞数据。
 */
export async function getUserStats(userIdentifier) {
  try {
    const resolved = await resolveAuthor(userIdentifier);
    if (!resolved.success) return resolved;
    const { user } = resolved.data;
    const articles = Array.isArray(resolved.data.articles) ? resolved.data.articles : await http.get('/article/getArticleList', { userId: user._id, page: 1 });
    if (!Array.isArray(articles)) return { success: false, message: '公开接口未返回有效的作者文章列表', data: null };
    const recordedCount = Number.isInteger(user.articleNum) && user.articleNum >= 0;
    const articleCount = recordedCount ? user.articleNum : articles.length < 20 ? articles.length : null;
    const totalViews = articles.reduce((sum, article) => sum + (Number(article.readNum) || 0), 0);
    const totalLikes = articles.reduce((sum, article) => sum + (Number(article.likeNum) || 0), 0);
    const topArticle = articles.reduce((best, article) => !best || (article.readNum || 0) > (best.readNum || 0) ? article : best, null);
    const site = new URL(process.env.JUE_SITE_URL || 'https://jue.leheavengame.com');
    if (!['http:', 'https:'].includes(site.protocol) || site.username || site.password) throw new Error('作者主页站点地址配置无效');
    return {
      success: true,
      data: {
        user: {
          id: String(user._id), nickname: maskAuthorPhoneText(user.nickname),
          url: new URL(`/user/${encodeURIComponent(user._id)}`, site.origin).href,
          headImg: user.headImg, job: maskAuthorPhoneText(user.job || ''),
          company: maskAuthorPhoneText(user.company || ''), introduce: maskAuthorPhoneText(user.introduce || ''),
          registTime: user.meta?.registTime,
        },
        statistics: {
          articleCount,
          articleCountSource: recordedCount ? 'author_profile' : articleCount === null ? 'unavailable' : 'public_articles',
          sampledArticleCount: articles.length, totalViews, totalLikes,
          avgViews: articles.length ? Math.round(totalViews / articles.length) : 0,
          fans: user.fans || 0, following: user.focu || 0, followingTags: user.tag || 0,
        },
        topArticle: topArticle ? { id: topArticle._id, title: topArticle.title, readNum: topArticle.readNum || 0, likeNum: topArticle.likeNum || 0 } : null,
        queryScope: `${recordedCount ? '文章数来自公开作者资料记录' : articleCount === null ? '当前资料未提供完整文章总数' : '文章数来自已完整返回的公开文章列表'}；阅读、点赞、平均阅读和最高阅读文章仅统计本次返回的 ${articles.length} 篇公开文章样本`,
      },
    };
  } catch (error) {
    return { success: false, message: maskAuthorPhoneText(error.message), data: null };
  }
}
