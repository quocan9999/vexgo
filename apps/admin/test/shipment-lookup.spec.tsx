import { describe, expect, it, vi, beforeEach } from 'vitest';
import { findShipmentByWaybill } from '../src/features/shipments/services/shipment-lookup';
import * as shipmentService from '../src/features/shipments/services/shipment-service';
import type { ShipmentSummary, ShipmentsResponse } from '../src/features/shipments/types/shipment';

vi.mock('../src/features/shipments/services/shipment-service', () => ({
  getShipments: vi.fn(),
}));

const mockShipmentBase = {
  sentAt: '2026-11-04T08:00:00.000Z',
  status: 'DA_TIEP_NHAN' as const,
  sender: { fullName: 'Nguyễn Văn A', phoneNumber: '0901234567' },
  receiver: { fullName: 'Trần Thị B', phoneNumber: '0912345678' },
  trip: null,
  originPoint: { pointId: 1, name: 'Bến xe Miền Tây', code: 'BXMT', address: 'TP.HCM' },
  destinationPoint: { pointId: 2, name: 'Bến xe Đà Lạt', code: 'BXDL', address: 'Đà Lạt' },
  totalFee: 65000,
};

describe('shipment-lookup service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without calling API when waybill code format is invalid', async () => {
    const result = await findShipmentByWaybill('inv@lid');
    expect(result).toBeNull();
    expect(shipmentService.getShipments).not.toHaveBeenCalled();
  });

  it('returns the exact matched shipment when backend search returns candidate matches', async () => {
    const mockCandidates: ShipmentSummary[] = [
      {
        ...mockShipmentBase,
        shipmentId: 101,
        waybillCode: 'FUTA-VD-123456-PREFIX',
      },
      {
        ...mockShipmentBase,
        shipmentId: 102,
        waybillCode: 'FUTA-VD-123456',
      },
      {
        ...mockShipmentBase,
        shipmentId: 103,
        waybillCode: 'FUTA-VD-123456-SUFFIX',
      },
    ];

    const mockResponse: ShipmentsResponse = {
      data: mockCandidates,
      meta: { page: 1, pageSize: 5, totalItems: 3, totalPages: 1 },
    };

    vi.mocked(shipmentService.getShipments).mockResolvedValue(mockResponse);

    const result = await findShipmentByWaybill('futa-vd-123456');

    expect(shipmentService.getShipments).toHaveBeenCalledWith(
      { search: 'FUTA-VD-123456', pageSize: 5 },
      undefined,
    );
    expect(result).not.toBeNull();
    expect(result?.shipmentId).toBe(102);
    expect(result?.waybillCode).toBe('FUTA-VD-123456');
  });

  it('returns null when no candidates match the exact waybill code', async () => {
    const mockResponse: ShipmentsResponse = {
      data: [
        {
          ...mockShipmentBase,
          shipmentId: 101,
          waybillCode: 'FUTA-VD-999999-OTHER',
        },
      ],
      meta: { page: 1, pageSize: 5, totalItems: 1, totalPages: 1 },
    };

    vi.mocked(shipmentService.getShipments).mockResolvedValue(mockResponse);

    const result = await findShipmentByWaybill('FUTA-VD-999999');
    expect(result).toBeNull();
  });

  it('returns null when search results are empty', async () => {
    vi.mocked(shipmentService.getShipments).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 },
    });

    const result = await findShipmentByWaybill('FUTA-VD-NOTFOUND');
    expect(result).toBeNull();
  });
});
