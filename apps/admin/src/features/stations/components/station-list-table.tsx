'use client';

import { Pencil, Trash2, Building2, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResourceStatusBadge } from '@/components/admin/resource-ui';
import type { Station } from '../types/station';

const TYPE_LABELS: Record<string, string> = {
  BEN_XE: 'Bến xe',
  VAN_PHONG: 'Văn phòng',
  DIEM_DON_TRA: 'Điểm đón/trả',
};

interface StationListTableProps {
  stations: Station[];
  onEdit: (station: Station) => void;
  onDelete: (station: Station) => void;
}

export function StationListTable({
  stations,
  onEdit,
  onDelete,
}: StationListTableProps) {
  if (stations.length === 0) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        <Building2 className="mb-2 size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">Chưa có điểm đón trả nào được cấu hình.</p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Nhấn vào nút "Thêm điểm đón trả" để tạo bến bãi hoặc văn phòng mới.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28 font-semibold">Mã điểm</TableHead>
            <TableHead className="font-semibold">Tên điểm đón / trả</TableHead>
            <TableHead className="w-32 font-semibold">Loại</TableHead>
            <TableHead className="font-semibold">Địa chỉ chi tiết</TableHead>
            <TableHead className="font-semibold">Khu vực (Cũ ➔ Mới)</TableHead>
            <TableHead className="w-32 font-semibold">Hotline</TableHead>
            <TableHead className="w-28 text-right font-semibold">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stations.map((station) => (
            <TableRow key={station.diemDonTraId}>
              <TableCell className="font-mono text-xs font-semibold text-foreground">
                {station.maDiem}
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {station.tenDiem}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {TYPE_LABELS[station.loaiDiem] ?? station.loaiDiem}
                </span>
              </TableCell>
              <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                <span className="line-clamp-2">{station.diaChi}</span>
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <span>{station.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                    <span className="inline-flex rounded border border-border/70 bg-muted px-1 text-[10px] font-bold text-muted-foreground">
                      CŨ
                    </span>
                  </div>
                  {station.diaDiemMoi && (
                    <span className="text-[11px] text-muted-foreground">
                      ➔ {station.diaDiemMoi.tenDiaDiem}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {station.soDienThoai ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3 text-muted-foreground/70" />
                    {station.soDienThoai}
                  </span>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onEdit(station)}
                    title="Chỉnh sửa"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(station)}
                    title="Xóa"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
