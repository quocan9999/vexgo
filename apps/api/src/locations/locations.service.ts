import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  type LocationOption,
} from './location-catalog.js';
import {
  VIETNAM_PROVINCES,
  KEY_DISTRICTS,
  MAJOR_STATIONS,
  type MasterLocation,
} from './vietnam-locations.data.js';

const TTL = 24 * 60 * 60 * 1000;
const RETRY_DELAY = 30_000;

const POPULAR_IDS = new Set([
  'province:79', // TP.HCM
  'province:01', // Hà Nội
  'district:672', // Đà Lạt
  'province:48', // Đà Nẵng
  'district:568', // Nha Trang
  'district:747', // Vũng Tàu
  'province:92', // Cần Thơ
  'district:593', // Phan Thiết
  'station:bx-mien-dong', // Bến xe Miền Đông
  'station:bx-mien-tay', // Bến xe Miền Tây
]);

function toLocationOption(item: MasterLocation): LocationOption {
  return {
    id: item.id,
    name: item.name,
    value: item.value,
    aliases: item.aliases,
    versions: ['current'],
    kind: item.kind,
    province: item.province,
    popular: Boolean(item.popular || POPULAR_IDS.has(item.id)),
    address: item.address,
    parentName: item.province ?? undefined,
  };
}

function buildMasterCatalog(): LocationOption[] {
  const all: MasterLocation[] = [
    ...VIETNAM_PROVINCES,
    ...KEY_DISTRICTS,
    ...MAJOR_STATIONS,
  ];
  return all.map(toLocationOption);
}

@Injectable()
export class LocationsService {
  private cache: {
    data: LocationOption[];
    updatedAt: string;
    expires: number;
  };
  private pending?: Promise<{
    data: LocationOption[];
    meta: { updatedAt: string; stale: boolean };
  }>;
  private retryAfter = 0;

  constructor() {
    this.cache = {
      data: buildMasterCatalog(),
      updatedAt: new Date().toISOString(),
      expires: Date.now() + TTL,
    };
  }

  async list() {
    if (
      this.cache &&
      (Date.now() < this.cache.expires || Date.now() < this.retryAfter)
    ) {
      return this.response(Date.now() >= this.cache.expires);
    }
    this.pending ??= this.refresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  private response(stale: boolean) {
    return {
      data: this.cache.data,
      meta: { updatedAt: this.cache.updatedAt, stale },
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
      this.cache = {
        data: buildMasterCatalog(),
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
