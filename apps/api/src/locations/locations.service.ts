import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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
    isLegacy: false,
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
  private initialLoaded = false;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.cache = {
      data: buildMasterCatalog(),
      updatedAt: new Date().toISOString(),
      expires: Date.now() + TTL,
    };
  }

  async list() {
    if (this.prisma && !this.initialLoaded) {
      try {
        await this.refresh();
        this.initialLoaded = true;
      } catch {
        // Fallback to in-memory catalogue
      }
    }

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

  async loadFromDatabase(): Promise<LocationOption[] | null> {
    if (!this.prisma) return null;
    try {
      const locations = await this.prisma.danhMucDiaDiem.findMany({
        where: { trangThai: 'HOAT_DONG' },
        include: {
          bangSapNhapMoi: {
            include: { diaDiemCu: true },
          },
        },
        orderBy: [{ thuTuHienThi: 'desc' }, { tenDiaDiem: 'asc' }],
      });
      if (!locations || locations.length === 0) return null;

      const stations = await this.prisma.diemDonTra.findMany({
        where: { trangThai: 'HOAT_DONG' },
        include: {
          diaDiemCu: true,
          diaDiemMoi: true,
        },
      });

      const result: LocationOption[] = [];

      for (const loc of locations) {
        const isLegacy = loc.laDiaDanhCu;
        const cleanName = loc.tenDiaDiem.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim();
        const value = cleanName.toLowerCase().includes('hồ chí minh') ? 'TP.HCM' : cleanName;
        const kind: LocationOption['kind'] = loc.capDiaDiem === 'TINH_THANH' ? 'province' : 'district';
        const id = isLegacy
          ? `legacy:${kind}:${loc.code}`
          : `current:${kind}:${loc.code}`;

        const legacyNames = (loc as any).bangSapNhapMoi && (loc as any).bangSapNhapMoi.length > 0
          ? (loc as any).bangSapNhapMoi.map((m: any) => m.diaDiemCu.tenDiaDiem)
          : undefined;

        result.push({
          id,
          name: cleanName,
          value,
          aliases: [loc.tenDiaDiem, loc.tenKhongDau, cleanName, value],
          versions: [isLegacy ? 'legacy' : 'current'],
          kind,
          province: loc.capDiaDiem === 'QUAN_HUYEN' ? (loc.chuThichSapNhap ?? null) : null,
          parentName: loc.capDiaDiem === 'QUAN_HUYEN' ? (loc.chuThichSapNhap ?? undefined) : undefined,
          isLegacy,
          mergedFromText: loc.chuThichSapNhap,
          legacyNames,
          popular: loc.noiBat,
          diaDiemId: loc.diaDiemId,
        });
      }

      for (const st of stations) {
        const parentName = st.diaDiemCu?.tenDiaDiem ?? st.diaDiemMoi?.tenDiaDiem ?? undefined;
        result.push({
          id: `station:${st.maDiem.toLowerCase()}`,
          name: st.tenDiem,
          value: st.tenDiem,
          aliases: [st.tenDiem, st.maDiem],
          versions: ['current'],
          kind: 'station',
          province: parentName ?? null,
          parentName,
          address: st.diaChi,
          isLegacy: false,
          popular: Boolean(st.maDiem.startsWith('BX-')),
          diemDonTraId: st.diemDonTraId,
        });
      }

      return result;
    } catch {
      return null;
    }
  }

  private async refresh() {
    try {
      const dbData = await this.loadFromDatabase();
      this.cache = {
        data: dbData && dbData.length > 0 ? dbData : buildMasterCatalog(),
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
