import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  mergeLocationCatalog,
  parseLocationCatalog,
  type LocationOption,
} from './location-catalog.js';

const TTL = 24 * 60 * 60 * 1000;
const RETRY_DELAY = 30_000;

@Injectable()
export class LocationsService {
  private cache?: {
    data: LocationOption[];
    updatedAt: string;
    expires: number;
  };
  private pending?: Promise<{
    data: LocationOption[];
    meta: { updatedAt: string; stale: boolean };
  }>;
  private retryAfter = 0;

  async list() {
    if (
      this.cache &&
      (Date.now() < this.cache.expires || Date.now() < this.retryAfter)
    ) {
      return this.response(Date.now() >= this.cache.expires);
    }
    if (Date.now() < this.retryAfter && !this.cache) throw this.unavailable();
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private response(stale: boolean) {
    return {
      data: this.cache!.data,
      meta: { updatedAt: this.cache!.updatedAt, stale },
    };
  }

  private unavailable() {
    return new ServiceUnavailableException({
      error: 'LOCATION_CATALOG_UNAVAILABLE',
      message: 'Không thể tải danh mục địa điểm. Vui lòng thử lại.',
    });
  }

  private async refresh() {
    try {
      const fetchCatalog = async (version: 'current' | 'legacy') => {
        const path = version === 'current' ? 'v2/?depth=1' : 'v1/?depth=2';
        const response = await fetch(
          `https://provinces.open-api.vn/api/${path}`,
          {
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!response.ok) throw new Error('Location provider unavailable');
        return parseLocationCatalog(await response.json(), version);
      };
      const fetchMergers = async () => {
        const response = await fetch(
          'https://www.tinhthanhpho.com/api/v1/new-provinces?limit=100',
          {
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!response.ok)
          throw new Error('Province merger provider unavailable');
        return response.json() as Promise<unknown>;
      };
      const [current, legacy, mergers] = await Promise.all([
        fetchCatalog('current'),
        fetchCatalog('legacy'),
        fetchMergers(),
      ]);
      this.cache = {
        data: mergeLocationCatalog([...current, ...legacy], mergers),
        updatedAt: new Date().toISOString(),
        expires: Date.now() + TTL,
      };
      this.retryAfter = 0;
      return this.response(false);
    } catch {
      this.retryAfter = Date.now() + RETRY_DELAY;
      if (this.cache) return this.response(true);
      throw this.unavailable();
    }
  }
}
