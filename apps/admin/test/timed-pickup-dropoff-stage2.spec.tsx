import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StationListTable } from '../src/features/stations/components/station-list-table';
import type { Station } from '../src/features/stations/types/station';
import { TripManifestView } from '../src/features/trips/components/trip-manifest-view';

const mockStationsWithNewTypes: Station[] = [
  {
    diemDonTraId: 10,
    maDiem: 'TC-HX',
    tenDiem: 'Điểm đón trung chuyển Hàng Xanh',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: '486 Điện Biên Phủ, Bình Thạnh',
    diaDiemCuId: 79,
    diaDiemMoiId: 79,
    viDo: 10.8,
    kinhDo: 106.7,
    soDienThoai: '19006067',
    trangThai: 'HOAT_DONG',
    nhaXeId: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    diaDiemCu: {
      diaDiemId: 79,
      tenDiaDiem: 'TP. Hồ Chí Minh',
      code: 79,
    },
  },
  {
    diemDonTraId: 11,
    maDiem: 'TN-TG',
    tenDiem: 'Trạm dừng chân Tiền Giang',
    loaiDiem: 'TRAM_NGHI',
    diaChi: 'Km 50 Tiền Giang',
    diaDiemCuId: 82,
    diaDiemMoiId: 82,
    viDo: 10.4,
    kinhDo: 106.3,
    soDienThoai: null,
    trangThai: 'HOAT_DONG',
    nhaXeId: 1,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    diaDiemCu: {
      diaDiemId: 82,
      tenDiaDiem: 'Tiền Giang',
      code: 82,
    },
  },
];

describe('Stage 2: Admin Timed Pickup/Dropoff & Manifest with shadcn/ui components', () => {
  it('renders TRUNG_CHUYEN and TRAM_NGHI badges in StationListTable using shadcn status badges', () => {
    const html = renderToStaticMarkup(
      <StationListTable
        stations={mockStationsWithNewTypes}
        onSelectStation={vi.fn()}
      />,
    );

    expect(html).toContain('TC-HX');
    expect(html).toContain('Điểm đón trung chuyển Hàng Xanh');
    expect(html).toContain('Trung chuyển');

    expect(html).toContain('TN-TG');
    expect(html).toContain('Trạm dừng chân Tiền Giang');
    expect(html).toContain('Trạm nghỉ');

    // Kiểm tra badge CŨ sử dụng shadcn Badge
    expect(html).toContain('CŨ');
    expect(html).toContain('group/badge');
  });

  it('renders loading state for TripManifestView before API resolves', () => {
    const html = renderToStaticMarkup(<TripManifestView tripId={100} />);
    expect(html).toContain('Đang tải danh sách hành khách chuyến xe');
  });
});
