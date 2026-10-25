import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationsService } from '../../../src/locations/locations.service.js';

const current = [{ code: 79, name: 'Thành phố Hồ Chí Minh' }];
const legacy = [{ code: 74, name: 'Tỉnh Bình Dương', districts: [] }];
const mergers = { data: [{ code: '79', merged_from: ['74'] }] };
function provider() {
  return vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.includes('tinhthanhpho.com')
            ? mergers
            : url.includes('/v2/')
              ? current
              : legacy,
        ),
      ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LocationsService', () => {
  it('coalesces concurrent requests and caches both real source versions', async () => {
    const fetchMock = provider();
    vi.stubGlobal('fetch', fetchMock);
    const service = new LocationsService();
    const [first, concurrent] = await Promise.all([
      service.list(),
      service.list(),
    ]);
    const cached = await service.list();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(first).toEqual(concurrent);
    expect(cached).toEqual(first);
    expect(first.data.map((item) => item.value)).toEqual(['TP.HCM']);
    expect(first.data[0].legacyNames).toEqual(['Bình Dương']);
    expect(first.meta.stale).toBe(false);
  });

  it('returns a structured 503 and backs off when no valid cached catalogue exists', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new LocationsService();
    await expect(service.list()).rejects.toMatchObject({
      response: {
        error: 'LOCATION_CATALOG_UNAVAILABLE',
        message: expect.any(String),
      },
    });
    await expect(service.list()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the last valid catalogue on refresh failure and marks it stale', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const fetchMock = provider();
    vi.stubGlobal('fetch', fetchMock);
    const service = new LocationsService();
    const original = await service.list();
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    fetchMock.mockRejectedValue(new Error('offline'));
    const stale = await service.list();
    expect(stale.data).toEqual(original.data);
    expect(stale.meta).toEqual({
      updatedAt: original.meta.updatedAt,
      stale: true,
    });
    await service.list();
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rejects a partial provider response instead of caching only one version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(JSON.stringify(url.includes('/v2/') ? current : [])),
      ),
    );
    await expect(new LocationsService().list()).rejects.toMatchObject({
      status: 503,
    });
  });
});
