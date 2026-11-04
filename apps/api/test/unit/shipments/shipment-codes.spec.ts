import { describe, expect, it } from 'vitest';
import { generateStandaloneShipmentCodes } from '../../../src/shipments/shipment-codes.js';

describe('generateStandaloneShipmentCodes', () => {
  it('generates 32-char lowercase hex UUID v4 business codes for order and waybill', () => {
    const first = generateStandaloneShipmentCodes('FUTA', new Date());
    const second = generateStandaloneShipmentCodes('FUTA', new Date());

    expect(first.orderCode).toMatch(/^[0-9a-f]{32}$/);
    expect(first.waybillCode).toMatch(/^[0-9a-f]{32}$/);
    expect(first.orderCode).not.toBe(second.orderCode);
    expect(first.waybillCode).not.toBe(second.waybillCode);
    expect(first.orderCode.length).toBe(32);
    expect(first.waybillCode.length).toBe(32);
  });
});
