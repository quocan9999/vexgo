'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  LoaderCircle,
  MapPin,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LegacyBadge } from '@/components/ui/status-badge';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { deleteStation, getStationById } from '../services/station-service';
import type { Station } from '../types/station';
import { StationFormDialog } from './station-form-dialog';

interface StationWorkspaceProps {
  stationId: number;
}

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

export function StationWorkspace({ stationId }: StationWorkspaceProps) {
  const router = useRouter();
  const { can } = useAdminPermissions();
  const canUpdate = can('route:update');
  const canDelete = can('route:update');

  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);

    getStationById(stationId)
      .then((data) => {
        if (current) {
          setStation(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải thông tin điểm đón trả.',
          );
          setLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [stationId, retryCount]);

  function retry() {
    setRetryCount((c) => c + 1);
  }

  async function handleDeleteConfirm() {
    if (!station || deleting) return;
    setDeleting(true);
    try {
      await deleteStation(station.diemDonTraId);
      toast.success(`Đã xóa điểm đón trả "${station.tenDiem}".`);
      setDeleteOpen(false);
      router.push('/stations');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Xóa điểm đón trả thất bại.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SuperAdminLayout
      activeSection="stations"
      breadcrumbs={[
        { label: 'Bến bãi & Điểm đón trả', href: '/stations' },
        { label: station ? station.tenDiem : 'Chi tiết điểm đón trả' },
      ]}
    >
      <div className="admin-page-content space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/stations" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại danh sách
              </Button>
              {canUpdate && station && (
                <Button onClick={() => setFormOpen(true)}>
                  <Pencil aria-hidden="true" />
                  Chỉnh sửa
                </Button>
              )}
              {canDelete && station && (
                <Button
                  onClick={() => setDeleteOpen(true)}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Xóa điểm
                </Button>
              )}
              <ResourceRefreshAction loading={loading} onClick={retry} />
            </div>
          }
          eyebrow="QUẢN LÝ VẬN HÀNH"
          title={
            station
              ? `Chi tiết điểm ${station.tenDiem}`
              : 'Chi tiết điểm đón trả'
          }
          titleId="station-workspace-title"
        />

        {loading && (
          <ResourceState loading>
            Đang tải thông tin điểm đón trả…
          </ResourceState>
        )}

        {error && !loading && (
          <ResourceState error>
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                Thử lại
              </Button>
              <Button nativeButton={false} render={<Link href="/stations" />}>
                Về danh sách điểm đón trả
              </Button>
            </div>
          </ResourceState>
        )}

        {station && !loading && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <Building2 size={28} />
                  </span>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {station.tenDiem}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      Mã điểm:{' '}
                      <strong className="admin-data-mono font-semibold">
                        {station.maDiem}
                      </strong>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={station.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
                >
                  {TYPE_LABELS[station.loaiDiem] ?? station.loaiDiem}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Vị trí & Phân loại */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Vị trí & Quy mô
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Loại hình trạm / bến</dt>
                      <dd className="font-medium text-foreground">
                        {TYPE_LABELS[station.loaiDiem] ?? station.loaiDiem}
                      </dd>
                    </div>
                    {station.loaiDiem === 'TRUNG_CHUYEN' && station.benTrungChuyen && (
                      <div>
                        <dt>Bến đích trung chuyển</dt>
                        <dd className="font-medium text-foreground">
                          {station.benTrungChuyen.tenDiem} (
                          <span className="admin-data-mono">{station.benTrungChuyen.maDiem}</span>
                          )
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Địa chỉ chi tiết</dt>
                      <dd className="text-foreground">{station.diaChi}</dd>
                    </div>
                    <div>
                      <dt>Khu vực hành chính (trước sáp nhập)</dt>
                      <dd className="flex items-center gap-1.5">
                        <span>{station.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                        <LegacyBadge />
                      </dd>
                    </div>
                    <div>
                      <dt>Khu vực hành chính (sau sáp nhập)</dt>
                      <dd className="font-medium text-foreground">
                        {station.diaDiemMoi?.tenDiaDiem ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Liên hệ & Tọa độ */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Liên hệ & Định vị
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>Số điện thoại liên hệ</dt>
                      <dd className="admin-data-mono font-medium text-foreground">
                        {station.soDienThoai || 'Chưa thiết lập'}
                      </dd>
                    </div>
                    <div>
                      <dt>Tọa độ GPS (Vĩ độ / Kinh độ)</dt>
                      <dd className="admin-data-mono text-muted-foreground">
                        {station.viDo && station.kinhDo
                          ? `${station.viDo.toFixed(4)}, ${station.kinhDo.toFixed(4)}`
                          : 'Chưa cập nhật tọa độ'}
                      </dd>
                    </div>
                    <div>
                      <dt>Nhà xe quản lý</dt>
                      <dd className="font-medium text-foreground">
                        {station.nhaXe ? `${station.nhaXe.tenNhaXe} (${station.nhaXe.maNhaXe})` : 'Toàn hệ thống'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Hồ sơ & Thời gian */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      Hồ sơ & Thời gian
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Ngày tạo hồ sơ
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(station.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Cập nhật lần cuối
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(station.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {formOpen && station && (
          <StationFormDialog
            station={station}
            onClose={() => setFormOpen(false)}
            onSaved={(saved) => {
              setStation(saved);
              setFormOpen(false);
              toast.success(`Đã cập nhật điểm "${saved.tenDiem}".`);
            }}
          />
        )}

        {deleteOpen && station && (
          <ResourceConfirmation
            title={`Xóa điểm đón trả ${station.tenDiem}?`}
            description={`Điểm đón trả "${station.tenDiem}" (${station.maDiem}) sẽ bị xóa vĩnh viễn khỏi hệ thống. Thao tác này không thể hoàn tác.`}
            busy={deleting}
            onClose={() => setDeleteOpen(false)}
          >
            <Button
              aria-busy={deleting}
              disabled={deleting}
              onClick={handleDeleteConfirm}
              variant="destructive"
            >
              {deleting ? (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              {deleting ? 'Đang xóa…' : 'Xóa điểm'}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
