'use client';

import { Building2, Pencil, Trash2 } from 'lucide-react';
import { ResourceSheet, ResourceStatusBadge } from '@/components/admin/resource-ui';
import { Badge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/action-button';
import type { Station } from '../types/station';

const TYPE_LABELS: Record<string, string> = {
  BEN_XE: 'Bến xe',
  VAN_PHONG: 'Văn phòng',
  DIEM_DON_TRA: 'Điểm đón/trả',
  TRUNG_CHUYEN: 'Trung chuyển',
  TRAM_NGHI: 'Trạm nghỉ',
};

function timestampFormat(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
}

export function StationDetailSheet({
  station,
  canUpdate,
  canDelete,
  onClose,
  onEdit,
  onDelete,
}: {
  station: Station;
  canUpdate: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <ResourceSheet
      title="Thông tin điểm đón trả"
      description="Chi tiết bến xe, văn phòng và điểm trung chuyển của nhà xe."
      onClose={onClose}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b pb-6">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-[var(--admin-radius-panel)] bg-accent text-primary"
          >
            <Building2 size={24} />
          </span>
          <div className="min-w-0">
            <h3 className="admin-data-mono break-words text-base font-semibold">
              {station.maDiem}
            </h3>
            <p className="mt-1 break-words text-[13px] text-muted-foreground">
              {station.tenDiem}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 text-[13px] [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
          <div>
            <dt>Tên điểm đón / trả</dt>
            <dd className="font-medium text-foreground">{station.tenDiem}</dd>
          </div>
          <div>
            <dt>Loại điểm</dt>
            <dd>
              <ResourceStatusBadge
                tone={station.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
              >
                {TYPE_LABELS[station.loaiDiem] ?? station.loaiDiem}
              </ResourceStatusBadge>
            </dd>
          </div>
          {station.loaiDiem === 'TRUNG_CHUYEN' && station.benTrungChuyen && (
            <div className="col-span-2">
              <dt>Bến đích trung chuyển</dt>
              <dd className="font-medium text-foreground">
                {station.benTrungChuyen.tenDiem} ({station.benTrungChuyen.maDiem})
              </dd>
            </div>
          )}
          <div>
            <dt>Khu vực (trước sáp nhập)</dt>
            <dd className="flex items-center gap-1.5">
              <span>{station.diaDiemCu?.tenDiaDiem ?? '—'}</span>
              <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 py-0">
                CŨ
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Khu vực (sau sáp nhập)</dt>
            <dd>{station.diaDiemMoi?.tenDiaDiem ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt>Địa chỉ chi tiết</dt>
            <dd className="text-muted-foreground">{station.diaChi}</dd>
          </div>
          <div>
            <dt>Số điện thoại liên hệ</dt>
            <dd className="admin-data-mono">{station.soDienThoai || 'Chưa thiết lập'}</dd>
          </div>
          <div>
            <dt>Ngày tạo</dt>
            <dd className="text-muted-foreground tabular-nums">
              {timestampFormat(station.createdAt)}
            </dd>
          </div>
          <div>
            <dt>Cập nhật lần cuối</dt>
            <dd className="text-muted-foreground tabular-nums">
              {timestampFormat(station.updatedAt)}
            </dd>
          </div>
        </dl>

        {(canUpdate || canDelete) && (
          <div className="flex flex-wrap justify-end gap-3 border-t pt-4">
            {canDelete && (
              <Button variant="outline" onClick={onDelete}>
                <Trash2 aria-hidden />
                Xóa điểm
              </Button>
            )}
            {canUpdate && (
              <Button onClick={onEdit}>
                <Pencil aria-hidden />
                Chỉnh sửa
              </Button>
            )}
          </div>
        )}
      </div>
    </ResourceSheet>
  );
}
