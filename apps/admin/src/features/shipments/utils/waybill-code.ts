/**
 * Tiện ích chuẩn hóa và kiểm tra định dạng mã vận đơn nhận được từ
 * máy quét mã vạch (barcode/QR wedge reader) hoặc camera scanner.
 */

export const WAYBILL_PATTERN = /^[A-Z0-9-]{6,64}$/;

/**
 * Chuẩn hóa chuỗi quét được thành mã vận đơn hợp lệ.
 * - Loại bỏ khoảng trắng thừa, ký tự điều khiển (CR, LF do máy quét gửi sau khi quét).
 * - Nếu là URL (khách quét link tra cứu), tự động bóc tách tham số code/waybill hoặc path segment.
 * - Chuyển toàn bộ về chữ in hoa theo quy ước mã vận đơn của hệ thống.
 */
export function normalizeScannedWaybill(raw?: string | null): string | null {
  if (!raw) return null;

  // Loại bỏ ký tự điều khiển và khoảng trắng đầu/cuối
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  if (!cleaned) return null;

  // Kiểm tra nếu chuỗi quét là một URL tra cứu
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

      // Thử lấy segment cuối của path nếu không có query param
      const pathSegments = url.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment) {
        const normalizedLast = decodeURIComponent(lastSegment).trim().toUpperCase();
        if (WAYBILL_PATTERN.test(normalizedLast)) {
          return normalizedLast;
        }
      }
    } catch {
      // Bỏ qua lỗi URL không hợp lệ và tiếp tục kiểm tra chuỗi thô
    }
  }

  const normalized = cleaned.toUpperCase();
  if (WAYBILL_PATTERN.test(normalized)) {
    return normalized;
  }

  return null;
}
