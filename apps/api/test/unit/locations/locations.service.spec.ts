import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationsService } from '../../../src/locations/locations.service.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LocationsService', () => {
  it('serves authoritative master catalogue including provinces, key districts and major stations', async () => {
    const service = new LocationsService();
    const result = await service.list();

    expect(result.data.length).toBeGreaterThan(60);
    expect(result.meta.stale).toBe(false);

    // Verify TP.HCM is clean, with no fictional merger legacy names
    const hcm = result.data.find((item) => item.id === 'province:79');
    expect(hcm).toBeDefined();
    expect(hcm?.name).toBe('TP. Hồ Chí Minh');
    expect(hcm?.value).toBe('TP.HCM');
    expect(hcm?.legacyNames).toBeUndefined();

    // Verify key districts (Thủ Đức, Đà Lạt)
    const thuDuc = result.data.find((item) => item.name.includes('Thủ Đức'));
    expect(thuDuc).toBeDefined();
    expect(thuDuc?.kind).toBe('district');
    expect(thuDuc?.province).toBe('TP. Hồ Chí Minh');

    const daLat = result.data.find((item) => item.name.includes('Đà Lạt'));
    expect(daLat).toBeDefined();
    expect(daLat?.kind).toBe('district');
    expect(daLat?.province).toBe('Lâm Đồng');

    // Verify major bus stations
    const bxMienDong = result.data.find((item) => item.id === 'station:bx-mien-dong');
    expect(bxMienDong).toBeDefined();
    expect(bxMienDong?.kind).toBe('station');
    expect(bxMienDong?.province).toBe('TP. Hồ Chí Minh');

    // Verify popular locations
    const popular = result.data.filter((item) => item.popular);
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.some((item) => item.value === 'TP.HCM')).toBe(true);
  });

  it('coalesces concurrent requests and uses in-memory cache', async () => {
    const service = new LocationsService();
    const [first, concurrent] = await Promise.all([
      service.list(),
      service.list(),
    ]);
    const cached = await service.list();
    expect(first).toEqual(concurrent);
    expect(cached).toEqual(first);
    expect(first.meta.stale).toBe(false);
  });
});
