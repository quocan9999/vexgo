const INTERNAL_ORIGIN = 'http://vexgo.local';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export function sanitizeLoginRedirect(
  value: string | null | undefined,
): string {
  if (!value || value !== value.trim()) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || CONTROL_CHARACTER_PATTERN.test(value)) return '/';

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    const decodedPath = decodeURIComponent(url.pathname);

    if (
      url.origin !== INTERNAL_ORIGIN ||
      decodedPath.startsWith('//') ||
      decodedPath.includes('\\') ||
      CONTROL_CHARACTER_PATTERN.test(decodedPath)
    ) {
      return '/';
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
