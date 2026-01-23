import * as http from './httpClient.js';

/**
 * 获取热门标签
 */
export async function getTrendingTags(limit = 10, sortBy = 'count') {
  try {
    // 获取标签列表
    const tagsData = await http.get('/article/getTagList', {});

    if (!tagsData || tagsData.length === 0) {
      return {
        success: true,
        data: {
          tags: [],
          total: 0,
        },
      };
    }

    // 获取所有文章用于统计
    const articles = await http.get('/article/getArticleList', {});

    // 统计每个标签的文章数和最新文章时间
    const tagStats = tagsData.map(tag => {
      const tagArticles = articles.filter(article => article.tagId === tag._id);
      
      let latestUpdate = tag.meta?.updatedAt;
      if (tagArticles.length > 0) {
        const latestArticle = tagArticles.reduce((latest, current) => {
          const latestTime = new Date(latest.meta?.updatedAt || 0);
          const currentTime = new Date(current.meta?.updatedAt || 0);
          return currentTime > latestTime ? current : latest;
        });
        latestUpdate = latestArticle.meta?.updatedAt || latestUpdate;
      }

      return {
        id: tag._id,
        name: tag.name,
        icon: tag.icon,
        articleCount: tagArticles.length,
        attention: tag.attention || 0,
        latestUpdate,
      };
    });

    // 排序
    tagStats.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.latestUpdate) - new Date(a.latestUpdate);
      }
      return b.articleCount - a.articleCount;
    });

    return {
      success: true,
      data: {
        tags: tagStats.slice(0, limit),
        total: tagStats.length,
      },
    };
  } catch (error) {
    console.error('getTrendingTags error:', error);
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

/**
 * 分析文章互动数据
 */
export async function analyzeEngagement(articleId) {
  try {
    // 获取文章详情
    const articleData = await http.get('/article/getArticleDetail', {
      _id: articleId,
    });

    if (!articleData || !articleData.article) {
      return {
        success: false,
        message: '文章不存在',
        data: null,
      };
    }

    const article = articleData.article;
    const comments = articleData.comment || [];

    // 计算评论数（主评论和回复）
    const commentCount = comments.length;
    const totalComments = comments.reduce((sum, comment) => {
      return sum + 1 + (comment.child ? comment.child.length : 0);
    }, 0);

    // 计算互动率
    const engagementRate = article.readNum > 0
      ? ((article.likeNum + totalComments) / article.readNum * 100).toFixed(2)
      : 0;

    // 计算点赞率
    const likeRate = article.readNum > 0
      ? (article.likeNum / article.readNum * 100).toFixed(2)
      : 0;

    return {
      success: true,
      data: {
        article: {
          id: article._id,
          title: article.title,
          author: article.nickname || 'Unknown',
          authorAvatar: article.headImg || '',
          publishDate: article.meta?.createdAt,
        },
        metrics: {
          views: article.readNum || 0,
          likes: article.likeNum || 0,
          comments: commentCount,
          totalComments,
          shares: 0,
        },
        rates: {
          engagementRate: parseFloat(engagementRate),
          likeRate: parseFloat(likeRate),
          commentRate: article.readNum > 0 
            ? parseFloat((totalComments / article.readNum * 100).toFixed(2))
            : 0,
        },
        performance: {
          isHot: (article.readNum || 0) > 1000,
          isPopular: (article.likeNum || 0) > 100,
          isActive: totalComments > 10,
        },
      },
    };
  } catch (error) {
    console.error('analyzeEngagement error:', error);
    return {
      success: false,
      message: error.message,
      data: null,
    };
  }
}

/**
 * 获取内容统计摘要
 */
export async function getContentSummary(timeRange = 'week') {
  try {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setDate(now.getDate() - 7));
    }

    // 获取文章列表
    const allArticles = await http.get('/article/getArticleList', {});

    // 过滤时间段内的文章
    const articles = allArticles.filter(article => {
      const createdAt = new Date(article.meta?.createdAt || article.meta?.updatedAt);
      return createdAt >= startDate;
    });

    // 获取用户列表来统计新用户
    const usersData = await http.get('/view/users', {});
    const newUsers = usersData && usersData.users 
      ? usersData.users.filter(user => {
          const registTime = new Date(user.meta?.registTime);
          return registTime >= startDate;
        }).length
      : 0;

    // 计算总阅读量和点赞量
    const totalViews = articles.reduce((sum, article) => sum + (article.readNum || 0), 0);
    const totalLikes = articles.reduce((sum, article) => sum + (article.likeNum || 0), 0);

    // 找出热门文章
    const topArticles = [...articles]
      .sort((a, b) => (b.readNum || 0) - (a.readNum || 0))
      .slice(0, 5)
      .map(article => ({
        id: article._id,
        title: article.title,
        author: article.nickname,
        readNum: article.readNum || 0,
        likeNum: article.likeNum || 0,
      }));

    return {
      success: true,
      data: {
        timeRange,
        period: {
          start: startDate,
          end: new Date(),
        },
        summary: {
          newArticles: articles.length,
          newUsers,
          totalComments: 0, // 评论需要遍历所有文章详情，成本较高，这里简化
          totalViews,
          totalLikes,
          avgViewsPerArticle: articles.length > 0 
            ? Math.round(totalViews / articles.length) 
            : 0,
        },
        topArticles,
      },
    };
  } catch (error) {
    console.error('getContentSummary error:', error);
    return {
      success: false,
      message: error.message,
      data: null,
    };
  }
}
