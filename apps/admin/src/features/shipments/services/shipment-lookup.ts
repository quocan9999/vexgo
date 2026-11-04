import { getShipments } from './shipment-service';
import type { ShipmentSummary } from '../types/shipment';
import { normalizeScannedWaybill } from '../utils/waybill-code';

/**
 * Tìm kiếm chính xác 1 phiếu gửi hàng theo mã vận đơn trong phạm vi nhà xe hiện tại.
 * Backend tìm kiếm theo `contains` (khớp chuỗi con), nên frontend sẽ lọc lại để chỉ
 * nhận bản ghi có mã vận đơn khớp tuyệt đối (không phân biệt hoa thường).
 *
 * Lưu ý bảo mật: Phạm vi dữ liệu nhà xe (tenant scope) được backend kiểm tra và
 * giới hạn tự động dựa trên Access Token của nhân viên đăng nhập.
 */
export async function findShipmentByWaybill(
  rawCode: string,
  signal?: AbortSignal,
): Promise<ShipmentSummary | null> {
  const code = normalizeScannedWaybill(rawCode);
  if (!code) {
    return null;
  }

  const response = await getShipments({ search: code, pageSize: 5 }, signal);
  const exactMatch = response.data.find(
    (s) => s.waybillCode.trim().toUpperCase() === code,
  );

  return exactMatch ?? null;
}
