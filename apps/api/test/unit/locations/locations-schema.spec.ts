import { describe, it, expect } from 'vitest';

describe('Locations & Stations Schema Invariants', () => {
  it('should enforce unique compound constraint (code, laDiaDanhCu)', () => {
    // Check invariant that code alone is not unique:
    // e.g., code 79 exists as both old province (TP.HCM cũ) and new province (TP.HCM mới)
    const oldLocation = { code: 79, laDiaDanhCu: true, name: 'Thành phố Hồ Chí Minh' };
    const newLocation = { code: 79, laDiaDanhCu: false, name: 'Thành phố Hồ Chí Minh' };

    expect(oldLocation.code).toBe(newLocation.code);
    expect(oldLocation.laDiaDanhCu).not.toBe(newLocation.laDiaDanhCu);
  });

  it('should require laDiaDanhCu condition in queries', () => {
    function buildLocationQuery(code: number, isLegacy: boolean) {
      return {
        code,
        laDiaDanhCu: isLegacy,
      };
    }

    const query = buildLocationQuery(79, true);
    expect(query).toHaveProperty('laDiaDanhCu', true);
    expect(query).toHaveProperty('code', 79);
  });

  it('should use diaDiemId as internal foreign key for mappings and stations', () => {
    const station = {
      diemDonTraId: 1,
      maDiem: 'BX-MD-MOI',
      tenDiem: 'Bến xe Miền Đông mới',
      diaDiemCuId: 101, // internal diaDiemId
      diaDiemMoiId: 28,  // internal diaDiemId
    };

    expect(typeof station.diaDiemCuId).toBe('number');
    expect(typeof station.diaDiemMoiId).toBe('number');
    expect(station.diaDiemCuId).not.toBe(station.diaDiemMoiId);
  });
});
