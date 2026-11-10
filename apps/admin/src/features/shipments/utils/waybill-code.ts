/**
 * Utility to normalize and validate waybill codes scanned from
 * barcode/QR wedge readers or camera scanners.
 */

export const WAYBILL_PATTERN = /^[A-Z0-9-]{6,64}$/;

/**
 * Normalizes scanned raw string into a valid waybill code.
 * - Strips control characters (CR, LF emitted by hardware scanners) and extraneous spaces.
 * - Extracts code/waybill parameter or last path segment if scanned string is an URL.
 * - Converts to uppercase following system convention.
 */
export function normalizeScannedWaybill(raw?: string | null): string | null {
  if (!raw) return null;

  // Remove control characters and leading/trailing whitespace
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  if (!cleaned) return null;

  // Check if scanned raw string is a tracking URL
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const paramCode =
        url.searchParams.get('code') ||
        url.searchParams.get('waybill') ||
        url.searchParams.get('waybillCode');

      if (paramCode) {
        const normalizedParam = paramCode.trim().toUpperCase();
        if (WAYBILL_PATTERN.test(normalizedParam)) {
          return normalizedParam;
        }
      }

      // Try extracting last path segment if no query param
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        const normalizedLast = decodeURIComponent(lastSegment).trim().toUpperCase();
        if (WAYBILL_PATTERN.test(normalizedLast)) {
          return normalizedLast;
        }
      }
    } catch {
      // Ignore invalid URL error and proceed with raw string check
    }
  }

  const normalized = cleaned.toUpperCase();
  if (WAYBILL_PATTERN.test(normalized)) {
    return normalized;
  }

  return null;
}
