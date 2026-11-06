# mcp-server-jue-article

Jue MCP Server 是一个基于 Model Context Protocol (MCP) 的知识库服务端，面向 AI Agent 提供惊觉社区的文章数据、用户统计和内容分析能力。

## 快速开始

### 环境要求

- Node.js 20 及以上版本
- npm 10 及以上版本

### 安装依赖

```bash
npm install
```

### 开发模式启动

```bash
npm run dev
```

启动后控制台会输出：

```
🚀 Jue MCP Server starting...
📡 Using API endpoint: https://jue.leheavengame.com/api
✅ Jue MCP Server running on stdio
```

## 验证 MCP 服务

使用官方 MCP CLI 可以确认服务已正常工作：

1. 查看工具列表：

  ```bash
  npx @modelcontextprotocol/cli inspect --stdio -- node index.js
  ```

  若命令成功，会显示服务器名称、版本及已注册的工具（如 search_articles_by_author、get_user_stats 等）。

2. 调用示例工具：

  ```bash
  npx @modelcontextprotocol/cli call --stdio -- node index.js search_articles_by_author --arg author="测试用户"
  ```

  命令会返回 JSON 结构的查询结果，代表服务端通过远端 API 成功获取数据。

若出现连接失败或报错，请确认以下事项：

- nodemon/Node 进程仍在运行并监听 stdio
- 当前网络可访问 https://jue.leheavengame.com/api
- 环境变量（如 MCP_SERVER_NAME、MCP_SERVER_VERSION）在启动前已正确配置

## 可用工具概览

- search_articles_by_author：按作者昵称或用户 ID 分页检索文章
- get_top_articles_by_views：按阅读量获取热门文章，可选标签和时间范围
- search_articles_by_keyword：按关键词搜索文章标题或描述
- get_user_stats：查询指定用户的文章数、点赞等统计数据
- get_trending_tags：查看热门标签及活跃度
- analyze_engagement：分析文章的互动指标
- get_article_recommendations：根据文章或标签获取相关推荐
- get_content_summary：查看指定时间范围的内容摘要

## 环境变量

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| MCP_SERVER_NAME | MCP 服务器名称 | jue-knowledge-base |
| MCP_SERVER_VERSION | MCP 服务器版本号 | 1.0.0 |

可以在 .env 文件中覆盖上述配置。

## 常见问题

- **CLI 输出为空或无法握手**：确认命令在项目根目录执行，并使用 Node 18+。
- **调用超时或返回错误**：检查目标 API 是否可用，或稍后重试。

欢迎根据业务需求扩展更多工具函数或完善数据源。

**数据来源**: 通过 HTTP API 接口从 https://jue.leheavengame.com 获取数据

## 功能特性

### 📚 文章查询
- **search_articles_by_author** - 查找指定作者的所有文章
- **get_top_articles_by_views** - 获取阅读量最高的文章
- **search_articles_by_keyword** - 关键词全文搜索
- **get_article_recommendations** - 智能文章推荐

### 👤 用户分析
- **get_user_stats** - 获取用户详细统计信息

### 📊 数据分析
- **get_trending_tags** - 热门标签分析
- **analyze_engagement** - 文章互动数据分析
- **get_content_summary** - 内容统计摘要

## 安装步骤

### 1. 安装依赖

```bash
cd mcp-server
npm install
```

### 2. 配置环境变量（可选）

如果需要自定义配置，可以创建 `.env` 文件：

```env
MCP_SERVER_NAME=jue-knowledge-base
MCP_SERVER_VERSION=1.0.0
```

### 3. 配置 Claude Desktop

编辑 Claude Desktop 配置文件：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

添加以下配置：

```json
{
  "mcpServers": {
    "jue-knowledge-base": {
      "command": "node",
      "args": ["mcp-server-jue-article\\index.js"]
    }
  }
}
```

### 4. 启动测试

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

## 使用示例

启动 Claude Desktop 后，你可以这样与 AI 对话：

### 示例 1: 查找作者文章
```
帮我查找"张三"写的所有文章，按阅读量排序
```

AI 会调用 `search_articles_by_author` 工具返回结果。

### 示例 2: 获取热门文章
```
给我看看本周阅读量最高的10篇文章
```

AI 会调用 `get_top_articles_by_views` 工具。

### 示例 3: 用户统计
```
查询用户"李四"的统计信息
```

AI 会调用 `get_user_stats` 工具。

### 示例 4: 内容分析
```
分析一下这周的内容表现如何
```

AI 会调用 `get_content_summary` 工具。

## API 工具说明

### search_articles_by_author

查找指定作者的文章列表。

**参数:**
- `author` (string, 必填) - 作者昵称或ID
- `page` (number) - 页码，默认1
- `limit` (number) - 每页数量，默认20
- `sortBy` (string) - 排序方式: latest/popular/views

**返回:**
```json
{
  "success": true,
  "data": {
    "author": {
      "id": "...",
      "nickname": "张三",
      "articleNum": 25,
      "totalLikes": 1500
    },
    "articles": [...],
    "pagination": {
      "page": 1,
      "total": 25,
      "pages": 2
    }
  }
}
```

### get_top_articles_by_views

获取阅读量最高的文章。

**参数:**
- `limit` (number) - 返回数量，默认10
- `tagId` (string) - 标签ID筛选
- `timeRange` (string) - 时间范围: all/today/week/month/year

### search_articles_by_keyword

关键词搜索文章。

**参数:**
- `keyword` (string, 必填) - 搜索关键词
- `searchIn` (string) - 搜索范围: title/description/both
- `page` (number) - 页码
- `limit` (number) - 每页数量

### get_user_stats

获取用户统计信息。

**参数:**
- `userId` (string, 必填) - 用户ID或昵称

**返回:**
```json
{
  "success": true,
  "data": {
    "user": {...},
    "statistics": {
      "articleCount": 25,
      "totalViews": 50000,
      "totalLikes": 1500,
      "avgViews": 2000,
      "fans": 120,
      "following": 50
    },
    "topArticle": {...}
  }
}
```

### get_trending_tags

获取热门标签。

**参数:**
- `limit` (number) - 返回数量，默认10
- `sortBy` (string) - 排序: count/recent

### analyze_engagement

分析文章互动数据。

**参数:**
- `articleId` (string, 必填) - 文章ID

**返回:**
```json
{
  "success": true,
  "data": {
    "article": {...},
    "metrics": {
      "views": 5000,
      "likes": 200,
      "comments": 50
    },
    "rates": {
      "engagementRate": 5.0,
      "likeRate": 4.0,
      "commentRate": 1.0
    },
    "performance": {
      "isHot": true,
      "isPopular": true,
      "isActive": true
    }
  }
}
```

## 架构设计

```
Claude Desktop / AI Agent
      ↓
    MCP Protocol (stdio)
      ↓
   MCP Server (Node.js)
    ├── Tools Router
    ├── Services Layer
    │   ├── articleService
    │   ├── userService
    │   └── analyticsService
    └── Remote Jue HTTP API
```

## 技术栈

- **MCP SDK**: @modelcontextprotocol/sdk
- **运行时**: Node.js (ES Modules)
- **通信协议**: stdio (标准输入输出)

## 开发扩展

### 添加新工具

1. 在 `index.js` 的 `TOOLS` 数组中定义工具
2. 在对应的 service 文件中实现业务逻辑
3. 在 `CallToolRequestSchema` 处理器中添加路由

示例：

```javascript
// 1. 定义工具
{
  name: 'my_new_tool',
  description: '工具描述',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: '参数说明' }
    },
    required: ['param1']
  }
}

// 2. 实现服务
export async function myNewFunction(param1) {
  // 业务逻辑
  return { success: true, data: {...} };
}

// 3. 添加路由
case 'my_new_tool': {
  const result = await myService.myNewFunction(args.param1);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
}
```

## 故障排查

### 连接失败
- 确认 Node 进程仍在运行
- 检查 `inspect`/`call` 命令参数是否使用了正确的路径

### 工具不可用
- 重启 Claude Desktop
- 检查配置文件路径是否正确
- 查看 Node.js 版本是否 >= 18

### 查看日志
```bash
# Windows
type %APPDATA%\Claude\logs\mcp-server-jue-knowledge-base.log

# macOS
tail -f ~/Library/Logs/Claude/mcp-server-jue-knowledge-base.log
```

## 许可证

MIT

## 相关链接

- [MCP 官方文档](https://modelcontextprotocol.io)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop](https://claude.ai/desktop)

## 网站插件直连的 HTTP 模式

复制 `.env.example` 为 `.env`，设置 MCP_AUTH_TOKEN 和 MCP_ALLOWED_ORIGINS，运行 npm start。使用 Node.js 20+。浏览器配置中的令牌对用户可见，应使用适合公开客户端的只读查询凭据。

服务默认监听 127.0.0.1:3101/mcp，通过 HTTPS 域名反向代理暴露 /mcp。MCP_ALLOWED_ORIGINS 填写插件所在网站的来源，例如 https://jue.leheavengame.com，多个来源以逗号分隔。浏览器需要 HTTPS 地址，服务器本机地址只用于反向代理的上游。

插件初始化时填写 mcpServers 配置数组，直接连接 MCP。AI 后端只接收普通聊天消息，文章站无需 MCP 转发接口。

JUE_API_BASE_URL 指定文章查询 API，JUE_SITE_URL 指定博文跳转网站。命令行客户端可以继续使用 MCP_TRANSPORT=stdio。

运行 `npm test` 验证本地 HTTP、Vercel 入口、命令行 stdio、文章链接、鉴权和跨域访问。

## 部署到 Vercel 并绑定域名

本仓库已提供 Vercel Node.js 函数入口。Vercel 通过 `api/mcp.js` 处理 MCP 请求，复用本地 HTTP 的鉴权、来源限制和工具实现，每个请求独立创建 MCP 实例，不依赖常驻进程、端口监听或内存会话。`vercel.json` 将 `/mcp`、`/mcp/` 映射到函数，并将单次函数执行上限设为 60 秒。

### 1. 导入项目

1. 将本次代码更新到你的 Git 仓库，然后在 Vercel 新建项目并导入 `mcp-server-jue-article` 仓库。
2. Root Directory 选择此仓库根目录，Framework Preset 选择 `Other`，Build Command 保持为空。Output Directory 已由 `vercel.json` 固定为 `public`，其中仅提供 `robots.txt`，服务代码通过函数入口执行；保留 Vercel 的依赖安装即可。
3. Vercel 使用平台当前默认的 Node.js LTS 版本；本地运行支持 Node.js 20 及以上。

### 2. 配置环境变量

在 Vercel 项目 `Settings → Environment Variables` 添加以下配置，并勾选要使用的 Production / Preview 环境。不要上传本地 `.env` 文件。

| 变量 | 示例或填写方式 |
| --- | --- |
| `MCP_AUTH_TOKEN` | 自行生成的长随机只读查询令牌，插件配置同一值 |
| `MCP_ALLOWED_ORIGINS` | `https://jue.leheavengame.com,https://www.leheavengame.com`，允许两个博客域名 |
| `JUE_API_BASE_URL` | `https://jue.leheavengame.com/api` |
| `JUE_SITE_URL` | `https://jue.leheavengame.com` |
| `MCP_SERVER_NAME` | 可选，默认 `jue-knowledge-base` |
| `MCP_SERVER_VERSION` | 可选，默认 `1.0.0` |

`MCP_ALLOWED_ORIGINS` 填插件实际运行的博客网站来源，如 `https://jue.leheavengame.com`，包含 `https://` 和可选端口，不带路径或末尾斜杠。需要本地调试时可以额外添加实际开发来源。浏览器中的令牌对访问者可见，因此这里只开放只读文章查询能力。

`MCP_TRANSPORT`、`MCP_HOST`、`MCP_PORT` 专用于本地或自有服务器上的 HTTP / stdio 进程；Vercel 由函数平台管理请求。环境变量修改后，重新部署使新配置生效。

### 3. 绑定 `mcp.leheavengame.com`

部署成功后，在 Vercel 项目 `Settings → Domains` 添加 `mcp.leheavengame.com`，按页面给出的目标值为 DNS 中的 `mcp` 子域名配置记录。若已有旧服务器的同名记录，更新或移除冲突项；以该项目当前显示的 DNS 要求为准。等待域名验证和 HTTPS 证书就绪后，插件 MCP 地址填写：

```text
https://mcp.leheavengame.com/mcp
```

Production 域名需要允许插件正常访问，避免 Vercel 的登录保护或密码保护将 MCP 请求重定向到验证页。MCP 令牌鉴权和来源限制仍由本服务执行。只有在部署记录中出现本次函数入口后，域名才会运行新的 MCP 服务。

### 4. 检查部署

浏览器访问 `https://mcp.leheavengame.com/` 或 `/health`，配置完成时应看到：

```json
{"status":"ok","name":"jue-knowledge-base","transport":"streamable-http","endpoint":"/mcp"}
```

此检查确认函数启动和令牌已配置，不会调用文章 API，也不会返回令牌。未配置令牌时返回 HTTP 503 和 `status: "unconfigured"`。浏览器直接打开 `/mcp` 得到 401 是正常的；携带正确令牌的 GET 请求返回 405，因为协议入口使用 POST。

协议检查可以将以下内容保存为 `mcp-initialize.json`：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"deploy-check","version":"1"}}}
```

然后使用你的令牌执行：

```bash
curl https://mcp.leheavengame.com/mcp \
  -H "Authorization: Bearer YOUR_READ_ONLY_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  --data-binary @mcp-initialize.json
```

响应应包含 `result.protocolVersion` 和 `result.serverInfo`。同一地址继续发送 `tools/list` 可发现文章工具；服务无状态，不需要保存 `Mcp-Session-Id`。再从允许的网站测试插件检索文章和打开博文链接，即可验证完整链路。

### 5. 更新博客插件

博客 `jue` 已升级到 `ai-agent-plugin@0.0.2`，通过服务端运行时配置把 MCP 地址、只读查询令牌和联网选项传给插件。在博客服务器 `.env` 中配置：

```env
AI_API_BASE_URL=https://monitor.leheavengame.com/api
JUE_AI_SEARCH=true
JUE_MCP_URL=https://mcp.leheavengame.com/mcp
JUE_MCP_TOKEN=replace-with-the-same-mcp-auth-token
```

`JUE_MCP_TOKEN` 与 Vercel 的 `MCP_AUTH_TOKEN` 使用同一值。本次已在两个本地项目 `.env` 中配置一致的令牌，上线时将这些对应配置同步到博客服务器和 Vercel。更新博客依赖、前端构建产物及服务端代码后，重启博客 Node 服务使 `.env` 生效。修改查询令牌时，重启服务即可更新页面运行时配置。

插件先连接 MCP 查询文章，再把参考资料交给 AI 回答，参考来源可以新标签页打开。`JUE_AI_SEARCH=false` 可关闭公网搜索，同时继续使用 MCP 文章查询。

Vercel 配置参考：[Node.js 函数与请求正文](https://vercel.com/docs/functions/runtimes/node-js)、[项目路由与函数配置](https://vercel.com/docs/project-configuration/vercel-json)、[绑定域名](https://vercel.com/docs/domains/working-with-domains/add-a-domain)。
