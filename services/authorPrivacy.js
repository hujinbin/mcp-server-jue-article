// 仅用于作者展示文本，用户 ID、链接和统计数值由调用方保留原值。
export function maskAuthorPhoneText(value) {
  // 仅接收展示文本，异常类型不透传，避免把嵌套私有资料交给模型。
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return '';
  return value.replace(
    /(?<![A-Za-z0-9])(?:\+?86[ \t-]*)?(1[3-9]\d(?:[ \t-]*\d){8})(?![A-Za-z0-9])/g,
    (_, phone) => {
      const digits = phone.replace(/[ \t-]/g, '');
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    }
  );
}
