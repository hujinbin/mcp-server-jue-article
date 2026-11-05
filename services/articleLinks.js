// 工具结果中的文章统一附带站内地址，客户端可直接展示跳转入口。
export function withArticleLinks(value) {
  if (Array.isArray(value)) return value.map(withArticleLinks);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withArticleLinks(item)]));
  const id = value._id || value.id;
  if (id && typeof value.title === 'string') {
    const base = (process.env.JUE_SITE_URL || 'https://jue.leheavengame.com').replace(/\/$/, '');
    result.url = `${base}/article/${encodeURIComponent(id)}`;
  }
  if (Array.isArray(value.articles) || value.statistics || value.summary) {
    result.queryScope = '数据来自公开 API 返回的分页样本，统计与排序范围仅限已返回的数据';
  }
  return result;
}
