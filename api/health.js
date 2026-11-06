import { handleHealthRequest } from '../index.js';

export default function handler(req, res) { // Vercel 为浏览器与部署探针提供无敏感信息的健康检查
  return handleHealthRequest(req, res);
}
