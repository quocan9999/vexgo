export function getApiBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new Error('Thiếu NEXT_PUBLIC_API_URL để kết nối API quản trị.');
  }
  return baseUrl;
}
