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
import { useTranslations } from 'next-intl';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { deleteStation, getStationById } from '../services/station-service';
import type { Station, StationType } from '../types/station';
import { StationFormDialog } from './station-form-dialog';

interface StationWorkspaceProps {
  stationId: number;
}

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
  const tStations = useTranslations('stations');
  const tCommon = useTranslations('common');
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

  const typeLabels: Record<StationType, string> = {
    BEN_XE: tStations('typeTerminal'),
    VAN_PHONG: tStations('typeOffice'),
    DIEM_DON_TRA: tStations('typeStop'),
    TRUNG_CHUYEN: tStations('typeTransit'),
    TRAM_NGHI: tStations('typeRest'),
  };

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
              : tStations('errors.loadDetailsFailed'),
          );
          setLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [stationId, retryCount, tStations]);

  function retry() {
    setRetryCount((c) => c + 1);
  }

  async function handleDeleteConfirm() {
    if (!station || deleting) return;
    setDeleting(true);
    try {
      await deleteStation(station.diemDonTraId);
      toast.success(tStations('deletedWithName', { name: station.tenDiem }));
      setDeleteOpen(false);
      router.push('/stations');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : tStations('errors.deleteFailed'),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SuperAdminLayout
      activeSection="stations"
      breadcrumbs={[
        { label: tStations('stationsTitle'), href: '/stations' },
        { label: station ? station.tenDiem : tStations('stationDetails') },
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
                {tCommon('backToList')}
              </Button>
              {canUpdate && station && (
                <Button onClick={() => setFormOpen(true)}>
                  <Pencil aria-hidden="true" />
                  {tCommon('edit')}
                </Button>
              )}
              {canDelete && station && (
                <Button
                  onClick={() => setDeleteOpen(true)}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  {tStations('deletePoint')}
                </Button>
              )}
              <ResourceRefreshAction loading={loading} onClick={retry} />
            </div>
          }
          eyebrow={tStations('eyebrow')}
          title={
            station
              ? tStations('stationDetailsWithName', { name: station.tenDiem })
              : tStations('stationDetails')
          }
          titleId="station-workspace-title"
        />

        {loading && (
          <ResourceState loading>
            {tStations('loadingDetails')}
          </ResourceState>
        )}

        {error && !loading && (
          <ResourceState error>
            <p>{error}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                {tCommon('retry')}
              </Button>
              <Button nativeButton={false} render={<Link href="/stations" />}>
                {tStations('backToStations')}
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
                      {tStations('colCode')}:{' '}
                      <strong className="admin-data-mono font-semibold">
                        {station.maDiem}
                      </strong>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={station.loaiDiem === 'BEN_XE' ? 'active' : 'muted'}
                >
                  {typeLabels[station.loaiDiem] ?? station.loaiDiem}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Location & Scale */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tStations('locationAndScale')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tStations('stationTypeLabel')}</dt>
                      <dd className="font-medium text-foreground">
                        {typeLabels[station.loaiDiem] ?? station.loaiDiem}
                      </dd>
                    </div>
                    {station.loaiDiem === 'TRUNG_CHUYEN' && station.benTrungChuyen && (
                      <div>
                        <dt>{tStations('transitDestinationLabel')}</dt>
                        <dd className="font-medium text-foreground">
                          {station.benTrungChuyen.tenDiem} (
                          <span className="admin-data-mono">{station.benTrungChuyen.maDiem}</span>
                          )
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>{tStations('addressDetailLabel')}</dt>
                      <dd className="text-foreground">{station.diaChi}</dd>
                    </div>
                    <div>
                      <dt>{tStations('adminAreaOldLabel')}</dt>
                      <dd className="flex items-center gap-1.5">
                        <span>{station.diaDiemCu?.tenDiaDiem ?? '—'}</span>
                        <LegacyBadge />
                      </dd>
                    </div>
                    <div>
                      <dt>{tStations('adminAreaNewLabel')}</dt>
                      <dd className="font-medium text-foreground">
                        {station.diaDiemMoi?.tenDiaDiem ?? '—'}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Contact & GPS */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tStations('contactAndGps')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tStations('phoneLabel')}</dt>
                      <dd className="admin-data-mono font-medium text-foreground">
                        {station.soDienThoai || tStations('notConfigured')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tStations('gpsCoordinatesLabel')}</dt>
                      <dd className="admin-data-mono text-muted-foreground">
                        {station.viDo && station.kinhDo
                          ? `${station.viDo.toFixed(4)}, ${station.kinhDo.toFixed(4)}`
                          : tStations('noGps')}
                      </dd>
                    </div>
                    <div>
                      <dt>{tStations('managingCompanyLabel')}</dt>
                      <dd className="font-medium text-foreground">
                        {station.nhaXe ? `${station.nhaXe.tenNhaXe} (${station.nhaXe.maNhaXe})` : tStations('allSystem')}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 3: Record & Timeline */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tStations('recordAndTimeline')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tStations('createdAtLabel')}
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(station.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tStations('updatedAtLabel')}
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
              toast.success(tStations('updatedWithName', { name: saved.tenDiem }));
            }}
          />
        )}

        {deleteOpen && station && (
          <ResourceConfirmation
            title={tStations('deleteTitle', { name: station.tenDiem })}
            description={tStations('deleteDescription', { name: station.tenDiem, code: station.maDiem })}
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
              {deleting ? tStations('deleting') : tStations('deletePoint')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}
