import * as http from './httpClient.js';

/**
 * 根据作者查询文章
 */
export async function searchByAuthor(author, page = 1, limit = 20, sortBy = 'latest') {
  try {
    // 先通过用户列表接口获取用户信息
    const userData = await http.get('/view/users', {});
    
    if (!userData || !userData.users) {
      return {
        success: false,
        message: '获取用户列表失败',
        data: [],
      };
    }

    // 查找匹配的用户
    const user = userData.users.find(u => 
      (u.nickname || '').toLowerCase().includes(author.toLowerCase()) ||
      u._id === author
    );

    if (!user) {
      return {
        success: false,
        message: '未找到该作者',
        data: [],
      };
    }

    // 获取该用户的文章列表
    const articleData = await http.get('/article/getArticleList', {
      userId: user._id,
      page,
    });

    if (!articleData) {
      return {
        success: false,
        message: '获取文章列表失败',
        data: [],
      };
    }

    // 根据排序方式对文章进行排序
    let articles = articleData || [];
    switch (sortBy) {
      case 'popular':
        articles.sort((a, b) => (b.likeNum || 0) - (a.likeNum || 0));
        break;
      case 'views':
        articles.sort((a, b) => (b.readNum || 0) - (a.readNum || 0));
        break;
      case 'latest':
      default:
        articles.sort((a, b) => new Date(b.meta?.updatedAt || 0) - new Date(a.meta?.updatedAt || 0));
        break;
    }

    return {
      success: true,
      data: {
        author: {
          id: user._id,
          nickname: user.nickname,
          headImg: user.headImg,
          articleNum: user.articleNum,
          totalLikes: user.like,
        },
        articles: articles.slice(0, limit),
        pagination: {
          page,
          limit,
          total: articles.length,
          pages: Math.ceil(articles.length / limit),
        },
      },
    };
  } catch (error) {
    console.error('searchByAuthor error:', error);
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

/**
 * 获取阅读量最高的文章
 */
export async function getTopByViews(limit = 10, tagId = null, timeRange = 'all') {
  try {
    // 获取文章列表
    const params = {};
    if (tagId) {
      params.tagId = tagId;
    }

    const articles = await http.get('/article/getArticleList', params);

    if (!articles || articles.length === 0) {
      return {
        success: true,
        data: {
          articles: [],
          statistics: {
            totalViews: 0,
            avgViews: 0,
            count: 0,
          },
        },
      };
    }

    // 过滤时间范围
    let filteredArticles = articles;
    if (timeRange !== 'all') {
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
        case 'year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
      }

      if (startDate) {
        filteredArticles = articles.filter(article => {
          const createdAt = new Date(article.meta?.createdAt || article.meta?.updatedAt);
          return createdAt >= startDate;
        });
      }
    }

    // 按阅读量排序
    const sortedArticles = filteredArticles.sort((a, b) => {
      const readNumDiff = (b.readNum || 0) - (a.readNum || 0);
      if (readNumDiff !== 0) return readNumDiff;
      return (b.likeNum || 0) - (a.likeNum || 0);
    }).slice(0, limit);

    // 计算总阅读量和平均值
    const totalViews = sortedArticles.reduce((sum, article) => sum + (article.readNum || 0), 0);
    const avgViews = sortedArticles.length > 0 ? totalViews / sortedArticles.length : 0;

    return {
      success: true,
      data: {
        articles: sortedArticles,
        statistics: {
          totalViews,
          avgViews: Math.round(avgViews),
          count: sortedArticles.length,
        },
      },
    };
  } catch (error) {
    console.error('getTopByViews error:', error);
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

/**
 * 根据关键词搜索文章
 */
export async function searchByKeyword(keyword, searchIn = 'both', page = 1, limit = 20) {
  try {
    // 使用搜索接口
    const offset = (page - 1) * limit;
    const firstPage = Math.floor(offset / 20) + 1;
    const lastPage = Math.floor((offset + limit - 1) / 20) + 1;
    const found = [];
    for (let apiPage = firstPage; apiPage <= lastPage; apiPage++) {
      const result = await http.get('/view/search', { keyword, page: apiPage });
      found.push(...(result?.article || []));
    }
    const searchData = { article: found.slice(offset % 20, offset % 20 + limit) };

    if (!searchData || !searchData.article) {
      return {
        success: true,
        data: {
          keyword,
          articles: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        },
      };
    }

    let articles = searchData.article;

    // 根据搜索范围过滤
    if (searchIn !== 'both') {
      articles = articles.filter(article => {
        const titleMatch = article.title?.toLowerCase().includes(keyword.toLowerCase());
        const descMatch = article.description?.toLowerCase().includes(keyword.toLowerCase());
        
        if (searchIn === 'title') {
          return titleMatch;
        } else if (searchIn === 'description') {
          return descMatch;
        }
        return true;
      });
    }

    // 排序：优先按相关度（阅读量），然后按更新时间
    articles.sort((a, b) => {
      const readNumDiff = (b.readNum || 0) - (a.readNum || 0);
      if (readNumDiff !== 0) return readNumDiff;
      return new Date(b.meta?.updatedAt || 0) - new Date(a.meta?.updatedAt || 0);
    });

    const total = articles.length;
    const paginatedArticles = articles.slice(0, limit);

    return {
      success: true,
      data: {
        keyword,
        articles: paginatedArticles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error('searchByKeyword error:', error);
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}

/**
 * 获取推荐文章
 */
export async function getRecommendations(articleId, tagId, limit = 5) {
  try {
    let targetTagId = tagId;

    // 如果提供了文章ID，先获取文章详情获得标签
    if (articleId) {
      const articleDetail = await http.get('/article/getArticleDetail', {
        id: articleId,
      });
      
      if (articleDetail && articleDetail.article) {
        targetTagId = articleDetail.article.tagId;
      }
    }

    if (!targetTagId) {
      return {
        success: false,
        message: '未找到相关标签',
        data: [],
      };
    }

    // 获取同标签的文章
    const articles = await http.get('/article/getArticleList', {
      tagId: targetTagId,
    });

    if (!articles || articles.length === 0) {
      return {
        success: true,
        data: {
          recommendations: [],
          count: 0,
        },
      };
    }

    // 排除当前文章并按热度排序
    let recommendations = articles
      .filter(article => article._id !== articleId)
      .sort((a, b) => {
        const readNumDiff = (b.readNum || 0) - (a.readNum || 0);
        if (readNumDiff !== 0) return readNumDiff;
        return (b.likeNum || 0) - (a.likeNum || 0);
      })
      .slice(0, limit);

    return {
      success: true,
      data: {
        recommendations,
        count: recommendations.length,
      },
    };
  } catch (error) {
    console.error('getRecommendations error:', error);
    return {
      success: false,
      message: error.message,
      data: [],
    };
  }
}
