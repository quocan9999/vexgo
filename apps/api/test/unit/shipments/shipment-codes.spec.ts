import { describe, expect, it } from 'vitest';
import { generateStandaloneShipmentCodes } from '../../../src/shipments/shipment-codes.js';

describe('generateStandaloneShipmentCodes', () => {
  it('keeps the existing date-prefixed code shape with collision-resistant suffixes', () => {
    const timestamp = new Date(2026, 9, 15, 9, 8);
    const first = generateStandaloneShipmentCodes('FUTA', timestamp);
    const second = generateStandaloneShipmentCodes('FUTA', timestamp);

    expect(first.orderCode).toMatch(/^FUTA-GD-151020260908-[A-F\d]{25}$/);
    expect(first.waybillCode).toMatch(/^FUTA-VD-151020260908-[A-F\d]{25}$/);
    expect(first.orderCode).not.toBe(second.orderCode);
    expect(first.waybillCode).not.toBe(second.waybillCode);
    expect(first.orderCode.length).toBeLessThanOrEqual(50);
    expect(first.waybillCode.length).toBeLessThanOrEqual(50);
  });

  it('sanitizes unusually long or unsafe operator codes and uses a safe fallback', () => {
    const timestamp = new Date(2026, 9, 15, 9, 8);
    expect(
      generateStandaloneShipmentCodes('FUTA ../ BUS', timestamp).orderCode,
    ).toMatch(/^FUTABUS-GD-/);
    expect(
      generateStandaloneShipmentCodes('!!!', timestamp).waybillCode,
    ).toMatch(/^VXG-VD-/);
  });
});
