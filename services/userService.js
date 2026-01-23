import * as http from './httpClient.js';

/**
 * 获取用户统计信息
 */
export async function getUserStats(userIdentifier) {
  try {
    // 通过用户详情接口获取用户信息
    const userData = await http.get('/user/getUserInfo', {
      userId: userIdentifier,
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
        u.nickname.toLowerCase().includes(userIdentifier.toLowerCase())
      );

      if (!user) {
        return {
          success: false,
          message: '未找到该用户',
          data: null,
        };
      }

      // 获取用户文章列表
      const articles = await http.get('/user/getArticleList', {
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
            nickname: user.nickname,
            headImg: user.headImg,
            job: user.job || '',
            company: user.company || '',
            introduce: user.introduce || '',
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
    const articles = await http.get('/user/getArticleList', {
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
          nickname: user.nickname,
          headImg: user.headImg,
          job: user.job || '',
          company: user.company || '',
          introduce: user.introduce || '',
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
      message: error.message,
      data: null,
    };
  }
}
