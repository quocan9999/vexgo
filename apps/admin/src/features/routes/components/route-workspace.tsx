'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Compass,
  LoaderCircle,
  MapPinned,
  Pencil,
  Route as RouteIcon,
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
import { Badge } from '@/components/ui/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { useTranslations } from 'next-intl';
import { StopListEditor } from '@/features/stops/components/stop-list-editor';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  getRouteById,
  updateRouteStatus,
} from '../services/route-service';
import { getRouteStops } from '@/features/stops/services/stop-service';
import type { RouteStopItem } from '@/features/stops/types/stop';
import type { Route, RouteStatus } from '../types/route';
import { RouteFormDialog } from './route-form-dialog';

interface RouteWorkspaceProps {
  routeId: number;
  onClose?: () => void;
  onUpdated?: (route: Route) => void;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; route: Route };

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

export function RouteWorkspace({
  routeId,
  onUpdated,
}: RouteWorkspaceProps) {
  const tRoutes = useTranslations('routes');
  const tCommon = useTranslations('common');
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const canUpdate = hasAdminPermission(session, 'route:update');

  const [detail, setDetail] = useState<DetailState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [stopsEditorOpen, setStopsEditorOpen] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteStopItem[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);

  const nextStatus: RouteStatus | null =
    detail.status === 'success'
      ? detail.route.status === 'HOAT_DONG'
        ? 'TAM_NGUNG'
        : 'HOAT_DONG'
      : null;

  async function confirmStatusChange() {
    if (!canUpdate || statusSubmittingRef.current || nextStatus === null) {
      return;
    }
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    try {
      const saved = await updateRouteStatus(routeId, { status: nextStatus });
      setStatusOpen(false);
      setDetail({ status: 'success', route: saved });
      onUpdated?.(saved);
      toast.success(
        nextStatus === 'TAM_NGUNG'
          ? tRoutes('statusSuspendedSuccess')
          : tRoutes('statusActivatedSuccess'),
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof TypeError
          ? tCommon('networkError')
          : error instanceof Error
            ? error.message
            : tRoutes('statusUpdateError'),
      );
    } finally {
      statusSubmittingRef.current = false;
      setStatusSubmitting(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getRouteById(routeId, controller.signal)
      .then((route) => {
        if (!controller.signal.aborted) setDetail({ status: 'success', route });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetail({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : tRoutes('loadDetailsError'),
          });
        }
      });

    void Promise.resolve().then(() => setLoadingStops(true));
    getRouteStops(routeId)
      .then((stops) => {
        if (!controller.signal.aborted) setRouteStops(stops);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoadingStops(false);
      });

    return () => controller.abort();
  }, [routeId, retryCount]);

  function retry() {
    setDetail({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  const route = detail.status === 'success' ? detail.route : null;

  return (
    <SuperAdminLayout
      activeSection="routes"
      breadcrumbs={[
        { label: tRoutes('routesTitle'), href: '/routes' },
        { label: route ? `${route.code} (${route.origin} - ${route.destination})` : tRoutes('routeDetails') },
      ]}
    >
      <div className="admin-page-content space-y-6">
        <AdminPageHeader
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/routes" />}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" />
                {tCommon('backToList')}
              </Button>
              {canUpdate && route && nextStatus && (
                <Button variant="outline" onClick={() => setStatusOpen(true)}>
                  {route.status === 'HOAT_DONG'
                    ? tRoutes('suspendRoute')
                    : tRoutes('activateRoute')}
                </Button>
              )}
              {canUpdate && route && (
                <Button onClick={() => setEditOpen(true)}>
                  <Pencil aria-hidden="true" />
                  {tCommon('edit')}
                </Button>
              )}
              <ResourceRefreshAction
                loading={detail.status === 'loading'}
                onClick={retry}
              />
            </div>
          }
          eyebrow={tRoutes('eyebrow')}
          title={route ? tRoutes('routeDetailsTitle', { code: route.code }) : tRoutes('routeDetails')}
          titleId="route-workspace-title"
        />

        {detail.status === 'loading' && (
          <ResourceState loading>{tRoutes('loadingDetails')}</ResourceState>
        )}

        {detail.status === 'error' && (
          <ResourceState error>
            <p>{detail.message}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={retry} variant="outline">
                {tCommon('retry')}
              </Button>
              <Button nativeButton={false} render={<Link href="/routes" />}>
                {tRoutes('backToRoutes')}
              </Button>
            </div>
          </ResourceState>
        )}

        {detail.status === 'success' && route && (
          <div className="space-y-6">
            {/* Hero Card */}
            <Card className="rounded-[var(--admin-radius-panel)] p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-primary"
                  >
                    <MapPinned size={28} />
                  </span>
                  <div>
                    <h2 className="admin-data-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {route.code}
                    </h2>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{route.origin}</span>
                      <span aria-hidden="true">→</span>
                      <span className="font-medium text-foreground">{route.destination}</span>
                    </p>
                  </div>
                </div>
                <ResourceStatusBadge
                  tone={route.status === 'HOAT_DONG' ? 'active' : 'muted'}
                >
                  {route.status === 'HOAT_DONG' ? tRoutes('active') : tRoutes('inactive')}
                </ResourceStatusBadge>
              </div>
            </Card>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Card 1: Journey Info */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tRoutes('journeyInfo')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt>{tRoutes('departurePoint')}</dt>
                      <dd className="font-medium text-foreground">{route.origin}</dd>
                    </div>
                    <div>
                      <dt>{tRoutes('arrivalPoint')}</dt>
                      <dd className="font-medium text-foreground">{route.destination}</dd>
                    </div>
                    <div>
                      <dt>{tRoutes('estimatedDuration')}</dt>
                      <dd className="font-medium text-foreground">
                        {route.durationMinutes === null
                          ? tRoutes('notSet')
                          : tRoutes('durationMinutesDetail', {
                              minutes: route.durationMinutes,
                              hours: Math.floor(route.durationMinutes / 60),
                              mins: route.durationMinutes % 60,
                            })}
                      </dd>
                    </div>
                    <div>
                      <dt>{tRoutes('colOperator')}</dt>
                      <dd className="flex items-center gap-1.5 font-medium">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        {route.busCompany.name} (
                        <span className="admin-data-mono">{route.busCompany.code}</span>
                        )
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Card 2: Sample Route */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RouteIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-base font-semibold">
                        {tRoutes('sampleRouteTitle')}
                      </CardTitle>
                    </div>
                    {canUpdate && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setStopsEditorOpen(true)}
                      >
                        {tRoutes('configureStops', { count: routeStops.length })}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <CardDescription className="text-xs">
                    {tRoutes('sampleRouteDesc')}
                  </CardDescription>

                  {loadingStops ? (
                    <p className="text-xs text-muted-foreground">{tRoutes('loadingStops')}</p>
                  ) : routeStops.length === 0 ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {tRoutes('noStopsPattern')}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        {tRoutes('pickupCount', { count: routeStops.filter((s) => s.loaiDiem === 'DON').length })}
                      </Badge>
                      <Badge variant="outline">
                        {tRoutes('dropoffCount', { count: routeStops.filter((s) => s.loaiDiem === 'TRA').length })}
                      </Badge>
                      {routeStops.some((s) => s.loaiDiem === 'NGHI') && (
                        <Badge variant="warning">
                          {tRoutes('restCount', { count: routeStops.filter((s) => s.loaiDiem === 'NGHI').length })}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 3: Record & Timeline */}
              <Card className="rounded-[var(--admin-radius-panel)] p-5 shadow-sm">
                <CardHeader className="p-0 pb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {tRoutes('recordAndTimeline')}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <dl className="grid gap-4 text-[13px] [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-words">
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tRoutes('createdAtLabel')}
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(route.createdAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {tRoutes('updatedAtLabel')}
                      </dt>
                      <dd className="text-muted-foreground tabular-nums">
                        {timestampFormat(route.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Dialogs */}
        {editOpen && canUpdate && route && (
          <RouteFormDialog
            route={route}
            onClose={() => setEditOpen(false)}
            onSaved={(saved) => {
              setEditOpen(false);
              setDetail({ status: 'success', route: saved });
              onUpdated?.(saved);
              toast.success(tRoutes('updateSuccess'));
            }}
          />
        )}

        {stopsEditorOpen && canUpdate && route && (
          <StopListEditor
            mode="route"
            targetId={routeId}
            title={tRoutes('patternTitle', { code: route.code, origin: route.origin, destination: route.destination })}
            onClose={() => setStopsEditorOpen(false)}
            onSaved={() => {
              getRouteStops(routeId).then(setRouteStops).catch(() => {});
            }}
          />
        )}

        {statusOpen && canUpdate && route && nextStatus && (
          <ResourceConfirmation
            busy={statusSubmitting}
            onClose={() => setStatusOpen(false)}
            title={
              nextStatus === 'TAM_NGUNG'
                ? tRoutes('suspendTitle')
                : tRoutes('activateTitle')
            }
            description={
              nextStatus === 'TAM_NGUNG'
                ? tRoutes('suspendDescription')
                : tRoutes('activateDescription')
            }
          >
            <Button
              disabled={statusSubmitting}
              aria-busy={statusSubmitting}
              onClick={confirmStatusChange}
            >
              {statusSubmitting && (
                <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
              )}
              {statusSubmitting
                ? tRoutes('updatingStatus')
                : nextStatus === 'TAM_NGUNG'
                  ? tRoutes('suspendRoute')
                  : tRoutes('activateRoute')}
            </Button>
          </ResourceConfirmation>
        )}
      </div>
    </SuperAdminLayout>
  );
}

export { RouteWorkspace as RouteDetails };
