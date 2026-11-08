import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';

export type MeasurementDraft = {
  cargoId: number;
  weight: string;
  length: string;
  width: string;
  height: string;
};
export function buildAcceptanceItems(items: MeasurementDraft[]) {
  return items.map((item) => {
    const weight = Number(item.weight);
    if (!Number.isFinite(weight) || weight <= 0)
      throw new Error('Actual weight must be greater than 0 for each item.');
    const dimensions = [item.length, item.width, item.height];
    if (
      dimensions.some(Boolean) &&
      !dimensions.every(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      )
    )
      throw new Error('All three dimensions must be greater than 0.');
    return {
      cargoId: item.cargoId,
      weight,
      ...(dimensions.every(Boolean)
        ? {
            length: Number(item.length),
            width: Number(item.width),
            height: Number(item.height),
          }
        : {}),
    };
  });
}
export function canDispatchShipment(shipment: {
  trip: { tripId: number } | null;
  paymentStatus: string;
  feeSummary: { freightPayer: string };
}) {
  return (
    Boolean(shipment.trip) &&
    (shipment.paymentStatus === 'DA_THANH_TOAN' ||
      shipment.feeSummary.freightPayer === 'NGUOI_NHAN')
  );
}
export class ShipmentOperationError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly previousFee?: number,
    readonly totalFee?: number,
  ) {
    super(message);
  }
}
export async function shipmentOperation<T>(
  id: number,
  action: string,
  method: 'POST' | 'PATCH' | 'GET',
  payload?: unknown,
): Promise<T> {
  const response = await adminApiFetch(
    `${getApiBaseUrl()}/api/v1/shipments/${id}/${action}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw new ShipmentOperationError(
      body.message || 'Unable to perform operation.',
      body.error,
      body.previousFee,
      body.totalFee,
    );
  return body.data;
}
export type EligibleShipmentTrip = {
  tripId: number;
  code: string;
  departureDate: string;
  departureTime: string;
};
