'use client';

import { Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from '@/components/ui/table';
import {
  ResourceDetailAction,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import type { Station } from '../types/station';

const TYPE_LABELS: Record<string, string> = {
  BEN_XE: 'Bến xe',
  VAN_PHONG: 'Văn phòng',
  DIEM_DON_TRA: 'Điểm đón/trả',
  TRUNG_CHUYEN: 'Trung chuyển',
  TRAM_NGHI: 'Trạm nghỉ',
};

interface StationListTableProps {
  stations: Station[];
  onSelectStation: (station: Station) => void;
}

export function StationListTable({
  stations,
  onSelectStation,
}: StationListTableProps) {
  if (stations.length === 0) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Building2 className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Chưa có điểm đón trả nào được cấu hình.</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Nhấn vào nút "Thêm điểm đón trả" để tạo bến bãi hoặc văn phòng mới.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table className="min-w-[960px]">
          <TableCaption className="sr-only">
            Danh sách bến bãi và điểm đón trả
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Mã điểm</TableHead>
              <TableHead scope="col">Tên điểm</TableHead>
              <TableHead scope="col">Loại</TableHead>
              <TableHead scope="col">Khu vực (Cũ ➔ Mới)</TableHead>
              <TableHead scope="col">Địa chỉ chi tiết</TableHead>
              <TableHead scope="col">Hotline</TableHead>
              <TableHead scope="col">
                <span className="sr-only">Thao tác</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stations.map((st) => (
              <TableRow key={st.diemDonTraId}>
                <th
                  className="admin-data-mono whitespace-nowrap px-4 py-3 text-left font-semibold"
                  scope="row"
                >
                  {st.maDiem}
                </th>
                <TableCell className="font-medium text-foreground">
                  {st.tenDiem}
                </TableCell>
                <TableCell>
                  <ResourceStatusBadge
                    tone={st.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
                  >
                    {TYPE_LABELS[st.loaiDiem] ?? st.loaiDiem}
                  </ResourceStatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <span>{st.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0">
                        CŨ
                      </Badge>
                    </div>
                    {st.diaDiemMoi && (
                      <span className="text-xs text-muted-foreground">
                        ➔ {st.diaDiemMoi.tenDiaDiem}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                  <span className="line-clamp-2">{st.diaChi}</span>
                </TableCell>
                <TableCell className="admin-data-mono text-xs text-muted-foreground">
                  {st.soDienThoai || '—'}
                </TableCell>
                <TableCell>
                  <ResourceDetailAction
                    onClick={() => onSelectStation(st)}
                    resourceName={`điểm ${st.tenDiem}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-4 bg-background p-4 md:hidden">
        {stations.map((st) => (
          <Card className="gap-3 p-4 ring-0" key={st.diemDonTraId}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="admin-data-mono text-base font-semibold">
                  {st.maDiem}
                </h2>
                <p className="mt-0.5 text-sm font-medium">{st.tenDiem}</p>
              </div>
              <ResourceStatusBadge
                tone={st.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
              >
                {TYPE_LABELS[st.loaiDiem] ?? st.loaiDiem}
              </ResourceStatusBadge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Khu vực:</strong>{' '}
                {st.diaDiemCu?.tenDiaDiem ?? '—'} [CŨ]{' '}
                {st.diaDiemMoi ? `➔ ${st.diaDiemMoi.tenDiaDiem}` : ''}
              </p>
              <p className="line-clamp-2">
                <strong className="text-foreground">Địa chỉ:</strong> {st.diaChi}
              </p>
              {st.soDienThoai && (
                <p className="admin-data-mono">
                  <strong className="text-foreground">Hotline:</strong> {st.soDienThoai}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t pt-2">
              <ResourceDetailAction
                onClick={() => onSelectStation(st)}
                resourceName={`điểm ${st.tenDiem}`}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
