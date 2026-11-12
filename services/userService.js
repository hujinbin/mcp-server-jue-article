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
 * 获取用户统计信息
 */
export async function getUserStats(userIdentifier) {
  try {
    // 通过用户详情接口获取用户信息
    const userData = await http.get('/view/userInfo', {
      id: userIdentifier,
    });

    if (!userData || !userData.user) {
      // 如果直接查询失败，尝试从用户列表中查找
      const usersData = await http.get('/view/users', {});
      
      if (!usersData || !usersData.users) {
        return {
          success: false,
          message: '未找到该用户',
          data: null,
        };
      }

      const user = usersData.users.find(u => 
        u._id === userIdentifier || 
        (u.nickname || '').toLowerCase().includes(userIdentifier.toLowerCase())
      );

      if (!user) {
        return {
          success: false,
          message: '未找到该用户',
          data: null,
        };
      }

      // 获取用户文章列表
      const articles = await http.get('/article/getArticleList', {
        userId: user._id,
      });

      // 计算统计数据
      const totalViews = articles ? articles.reduce((sum, article) => sum + (article.readNum || 0), 0) : 0;
      const totalLikes = articles ? articles.reduce((sum, article) => sum + (article.likeNum || 0), 0) : 0;
      const articleCount = articles ? articles.length : 0;
      
      const topArticle = articles && articles.length > 0
        ? articles.reduce((prev, current) => 
            ((prev.readNum || 0) > (current.readNum || 0)) ? prev : current
          )
        : null;

      const avgViews = articleCount > 0 ? Math.round(totalViews / articleCount) : 0;

      return {
        success: true,
        data: {
          user: {
            id: user._id,
            nickname: maskAuthorPhoneText(user.nickname),
            headImg: user.headImg,
            job: maskAuthorPhoneText(user.job || ''),
            company: maskAuthorPhoneText(user.company || ''),
            introduce: maskAuthorPhoneText(user.introduce || ''),
            registTime: user.meta?.registTime,
          },
          statistics: {
            articleCount,
            totalViews,
            totalLikes,
            avgViews,
            fans: user.fans || 0,
            following: user.focu || 0,
            followingTags: user.tag || 0,
          },
          topArticle: topArticle ? {
            id: topArticle._id,
            title: topArticle.title,
            readNum: topArticle.readNum || 0,
            likeNum: topArticle.likeNum || 0,
          } : null,
        },
      };
    }

    const user = userData.user;
    
    // 获取用户文章列表
    const articles = await http.get('/article/getArticleList', {
      userId: user._id,
    });

    // 计算统计数据
    const totalViews = articles ? articles.reduce((sum, article) => sum + (article.readNum || 0), 0) : 0;
    const totalLikes = articles ? articles.reduce((sum, article) => sum + (article.likeNum || 0), 0) : 0;
    const articleCount = articles ? articles.length : 0;
    
    const topArticle = articles && articles.length > 0
      ? articles.reduce((prev, current) => 
          ((prev.readNum || 0) > (current.readNum || 0)) ? prev : current
        )
      : null;

    const avgViews = articleCount > 0 ? Math.round(totalViews / articleCount) : 0;

    return {
      success: true,
      data: {
        user: {
          id: user._id,
          nickname: maskAuthorPhoneText(user.nickname),
          headImg: user.headImg,
          job: maskAuthorPhoneText(user.job || ''),
          company: maskAuthorPhoneText(user.company || ''),
          introduce: maskAuthorPhoneText(user.introduce || ''),
          registTime: user.meta?.registTime,
        },
        statistics: {
          articleCount,
          totalViews,
          totalLikes,
          avgViews,
          fans: user.fans || 0,
          following: user.focu || 0,
          followingTags: user.tag || 0,
        },
        topArticle: topArticle ? {
          id: topArticle._id,
          title: topArticle.title,
          readNum: topArticle.readNum || 0,
          likeNum: topArticle.likeNum || 0,
        } : null,
      },
    };
  } catch (error) {
    console.error('getUserStats error:', error);
    return {
      success: false,
      message: maskAuthorPhoneText(error.message),
      data: null,
    };
  }
}
