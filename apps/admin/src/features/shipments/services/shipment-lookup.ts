import { getShipments } from './shipment-service';
import type { ShipmentSummary } from '../types/shipment';
import { normalizeScannedWaybill } from '../utils/waybill-code';

/**
 * Find exactly 1 shipment by waybill code within the current bus company scope.
 * Backend searches with `contains` (substring), so frontend filters down to
 * only exact matching records (case-insensitive).
 *
 * Security notice: Bus company data scope (tenant scope) is verified and
 * automatically restricted by the backend based on the staff's Access Token.
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
