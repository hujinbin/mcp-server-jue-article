/**
 * HTTP 客户端服务
 * 用于调用 jue 网站的 API 接口
 */


/**
 * 发送 HTTP 请求
 */
async function request(method, path, data = null) {
  const BASE_URL = (process.env.JUE_API_BASE_URL || 'https://jue.leheavengame.com/api').replace(/\/$/, '');
  const url = `${BASE_URL}${path}`;
  
  const options = {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MCP-Server/1.0',
    },
  };

  if (data) {
    if (method === 'GET') {
      // GET 请求：将数据拼接到 URL
      const params = new URLSearchParams(data);
      const fullUrl = `${url}?${params}`;
      const response = await fetch(fullUrl, options);
      return await handleResponse(response);
    } else {
      // POST 请求：放入 body
      options.body = JSON.stringify(data);
      const response = await fetch(url, options);
      return await handleResponse(response);
    }
  } else {
    const response = await fetch(url, options);
    return await handleResponse(response);
  }
}

/**
 * 处理响应
 */
async function handleResponse(response) {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const result = await response.json();
  
  if (result.code !== 200) {
    throw new Error(result.message || 'API request failed');
  }
  
  // 兼容文章站搜索接口的顶层字段和常规 data 包装。
  if (result.articleList) return { ...result, article: result.articleList };
  if (result.userList) return { users: result.userList };
  return result.data;
}

/**
 * GET 请求
 */
export async function get(path, params = null) {
  return request('GET', path, params);
}

/**
 * POST 请求
 */
export async function post(path, data = null) {
  return request('POST', path, data);
}

export default {
  get,
  post,
};
