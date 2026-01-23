#!/usr/bin/env node

/**
 * Jue Knowledge Base MCP Server
 * 提供文章、用户、标签等数据的查询和分析工具
 * 使用 HTTP API 接口获取数据
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 导入服务
import * as articleService from './services/articleService.js';
import * as userService from './services/userService.js';
import * as analyticsService from './services/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建MCP服务器实例
const server = new Server(
  {
    name: process.env.MCP_SERVER_NAME || 'jue-knowledge-base',
    version: process.env.MCP_SERVER_VERSION || '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义所有可用的工具
const TOOLS = [
  {
    name: 'search_articles_by_author',
    description: '根据作者昵称或用户ID查找该作者发表的所有文章，支持分页',
    inputSchema: {
      type: 'object',
      properties: {
        author: {
          type: 'string',
          description: '作者的昵称或用户ID',
        },
        page: {
          type: 'number',
          description: '页码，默认为1',
          default: 1,
        },
        limit: {
          type: 'number',
          description: '每页数量，默认为20',
          default: 20,
        },
        sortBy: {
          type: 'string',
          enum: ['latest', 'popular', 'views'],
          description: '排序方式: latest(最新), popular(最受欢迎), views(阅读量)',
          default: 'latest',
        },
      },
      required: ['author'],
    },
  },
  {
    name: 'get_top_articles_by_views',
    description: '获取阅读量最高的文章列表，可按标签筛选，可指定时间范围',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回文章数量，默认为10',
          default: 10,
        },
        tagId: {
          type: 'string',
          description: '标签ID，可选，不填则查询所有标签',
        },
        timeRange: {
          type: 'string',
          enum: ['all', 'today', 'week', 'month', 'year'],
          description: '时间范围筛选',
          default: 'all',
        },
      },
    },
  },
  {
    name: 'search_articles_by_keyword',
    description: '根据关键词搜索文章，支持标题和内容全文搜索',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词',
        },
        searchIn: {
          type: 'string',
          enum: ['title', 'description', 'both'],
          description: '搜索范围: title(标题), description(描述), both(两者)',
          default: 'both',
        },
        page: {
          type: 'number',
          description: '页码，默认为1',
          default: 1,
        },
        limit: {
          type: 'number',
          description: '每页数量，默认为20',
          default: 20,
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_user_stats',
    description: '获取指定用户的统计信息，包括文章数、总点赞数、粉丝数等',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: '用户ID或昵称',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'get_trending_tags',
    description: '获取热门标签列表，按文章数量或活跃度排序',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回标签数量，默认为10',
          default: 10,
        },
        sortBy: {
          type: 'string',
          enum: ['count', 'recent'],
          description: '排序方式: count(文章数量), recent(最近更新)',
          default: 'count',
        },
      },
    },
  },
  {
    name: 'analyze_engagement',
    description: '分析文章的互动数据，包括点赞、评论、阅读等指标',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '文章ID',
        },
      },
      required: ['articleId'],
    },
  },
  {
    name: 'get_article_recommendations',
    description: '根据文章ID或标签获取推荐的相关文章',
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '参考文章ID',
        },
        tagId: {
          type: 'string',
          description: '标签ID（如果不提供articleId）',
        },
        limit: {
          type: 'number',
          description: '推荐数量，默认为5',
          default: 5,
        },
      },
    },
  },
  {
    name: 'get_content_summary',
    description: '获取指定时间段内的内容统计摘要',
    inputSchema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: '时间范围',
          default: 'week',
        },
      },
    },
  },
];

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_articles_by_author': {
        const result = await articleService.searchByAuthor(
          args.author,
          args.page || 1,
          args.limit || 20,
          args.sortBy || 'latest'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_top_articles_by_views': {
        const result = await articleService.getTopByViews(
          args.limit || 10,
          args.tagId,
          args.timeRange || 'all'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'search_articles_by_keyword': {
        const result = await articleService.searchByKeyword(
          args.keyword,
          args.searchIn || 'both',
          args.page || 1,
          args.limit || 20
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_user_stats': {
        const result = await userService.getUserStats(args.userId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_trending_tags': {
        const result = await analyticsService.getTrendingTags(
          args.limit || 10,
          args.sortBy || 'count'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'analyze_engagement': {
        const result = await analyticsService.analyzeEngagement(args.articleId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_article_recommendations': {
        const result = await articleService.getRecommendations(
          args.articleId,
          args.tagId,
          args.limit || 5
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'get_content_summary': {
        const result = await analyticsService.getContentSummary(
          args.timeRange || 'week'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            stack: error.stack,
          }),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  try {
    console.error('🚀 Jue MCP Server starting...');
    console.error('📡 Using API endpoint: https://jue.leheavengame.com/api');

    // 创建传输层
    const transport = new StdioServerTransport();
    
    // 连接服务器和传输层
    await server.connect(transport);
    
    console.error('✅ Jue MCP Server running on stdio');
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.error('\n⏹️  Shutting down...');
  process.exit(0);
});

main();
