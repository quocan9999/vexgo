import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StationListTable } from '../src/features/stations/components/station-list-table';
import type { Station } from '../src/features/stations/types/station';

const mockStations: Station[] = [
  {
    diemDonTraId: 1,
    maDiem: 'BX-VT',
    tenDiem: 'Bến xe Vũng Tàu',
    loaiDiem: 'BEN_XE',
    diaChi: '192 Nam Kỳ Khởi Nghĩa, Vũng Tàu',
    diaDiemCuId: 77,
    diaDiemMoiId: 28,
    viDo: 10.3541,
    kinhDo: 107.0852,
    soDienThoai: '19006067',
    trangThai: 'HOAT_DONG',
    nhaXeId: 1,
    createdAt: '2026-10-29T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
    diaDiemCu: {
      diaDiemId: 77,
      tenDiaDiem: 'Bà Rịa - Vũng Tàu',
      code: 77,
    },
    diaDiemMoi: {
      diaDiemId: 28,
      tenDiaDiem: 'Hồ Chí Minh',
      code: 79,
    },
  },
];

describe('StationListTable', () => {
  it('renders station rows with code, name, type, and old/new province mapping', () => {
    const html = renderToStaticMarkup(
      <StationListTable
        stations={mockStations}
        onSelectStation={vi.fn()}
      />,
    );

    expect(html).toContain('BX-VT');
    expect(html).toContain('Bến xe Vũng Tàu');
    expect(html).toContain('Bến xe');
    expect(html).toContain('192 Nam Kỳ Khởi Nghĩa, Vũng Tàu');
    expect(html).toContain('Bà Rịa - Vũng Tàu');
    expect(html).toContain('CŨ');
    expect(html).toContain('Hồ Chí Minh');
    expect(html).toContain('19006067');
    expect(html).toContain('Xem chi tiết');
    // Both desktop table and mobile card have the detail action
    expect(html.match(/aria-label="Xem chi tiết điểm Bến xe Vũng Tàu"/g)).toHaveLength(2);
    expect(html).toContain('grid gap-4 bg-background p-4 md:hidden');
  });

  it('renders empty state when no stations are configured', () => {
    const html = renderToStaticMarkup(
      <StationListTable
        stations={[]}
        onSelectStation={vi.fn()}
      />,
    );

    expect(html).toContain('Chưa có điểm đón trả nào được cấu hình.');
  });
});
