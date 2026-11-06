import { handleMCPRequest } from '../index.js';

export default function handler(req, res) { // Vercel 为插件提供无状态 MCP 接口
  return handleMCPRequest(req, res, () => req.body);
}
