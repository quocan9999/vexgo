import { describe, it, expect } from 'vitest';
import {
  buildAcceptanceItems,
  canDispatchShipment,
} from '@/features/shipments/services/shipment-operations';

describe('shipment receiving measurements', () => {
  it('requires actual measurements rather than silently reusing declared weights', () => {
    expect(() =>
      buildAcceptanceItems([
        { cargoId: 1, weight: '', length: '', width: '', height: '' },
      ]),
    ).toThrow(/(khối lượng|weight)/i);
  });
  it('sends measured weight and complete optional dimensions', () => {
    expect(
      buildAcceptanceItems([
        { cargoId: 1, weight: '5.25', length: '10', width: '20', height: '30' },
      ]),
    ).toEqual([
      { cargoId: 1, weight: 5.25, length: 10, width: 20, height: 30 },
    ]);
  });
  it('rejects incomplete or nonpositive dimensions', () => {
    expect(() =>
      buildAcceptanceItems([
        { cargoId: 1, weight: '2', length: '10', width: '', height: '' },
      ]),
    ).toThrow(/(kích thước|dimensions?)/i);
  });
  it('requires assignment and sender payment before dispatch', () => {
    expect(
      canDispatchShipment({
        trip: null,
        paymentStatus: 'DA_THANH_TOAN',
        feeSummary: { freightPayer: 'NGUOI_GUI' },
      }),
    ).toBe(false);
    expect(
      canDispatchShipment({
        trip: { tripId: 1 },
        paymentStatus: 'CHO_THANH_TOAN',
        feeSummary: { freightPayer: 'NGUOI_GUI' },
      }),
    ).toBe(false);
    expect(
      canDispatchShipment({
        trip: { tripId: 1 },
        paymentStatus: 'CHO_THANH_TOAN',
        feeSummary: { freightPayer: 'NGUOI_NHAN' },
      }),
    ).toBe(true);
  });
});
