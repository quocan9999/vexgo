import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TrangThaiPhieuGuiHang } from '../../../src/generated/prisma/client.js';
import { ShipmentQueryDto } from '../../../src/shipments/dto/shipment-query.dto.js';

describe('ShipmentQueryDto', () => {
  it('preserves pagination and sorting while allowing DA_HUY as a history filter', async () => {
    const query = plainToInstance(ShipmentQueryDto, {
      page: '2',
      pageSize: '50',
      search: '  VG-2026-001  ',
      status: TrangThaiPhieuGuiHang.DA_HUY,
      sortBy: 'createdAt',
      sortDirection: 'asc',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.page).toBe(2);
    expect(query.pageSize).toBe(50);
    expect(query.search).toBe('VG-2026-001');
    expect(query.status).toBe(TrangThaiPhieuGuiHang.DA_HUY);
    expect(query.sortBy).toBe('createdAt');
    expect(query.sortDirection).toBe('asc');
  });

  it('rejects an out-of-range page size and unknown shipment status', async () => {
    const query = plainToInstance(ShipmentQueryDto, {
      pageSize: '51',
      status: 'NOT_A_SHIPMENT_STATUS',
    });

    const errors = await validate(query);

    expect(errors.map(({ property }) => property).sort()).toEqual([
      'pageSize',
      'status',
    ]);
  });
});
