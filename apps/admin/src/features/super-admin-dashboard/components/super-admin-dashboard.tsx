'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Building2,
  CircleCheck,
  Radio,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
import { PlatformQuickActions } from './platform-quick-actions';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceNotice,
  ResourceRefreshAction,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import { Button, buttonVariants } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { hasAllPlatformAdminPermissions } from '@/features/admin-auth/services/admin-access';
import { getDashboardOverview } from '../services/dashboard-service';
import type {
  DashboardOverview,
  PlatformCompanySummary,
} from '../types/dashboard';

const number = (value: number) => value.toLocaleString('vi-VN');

function displayTimestamp(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return (
    part('hour') +
    ':' +
    part('minute') +
    ' · ' +
    part('day') +
    '-' +
    part('month') +
    '-' +
    part('year')
  );
}

function Metric({
  label,
  value,
  icon,
  children,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon: ReactNode;
  children?: ReactNode;
  tone?: 'primary' | 'neutral' | 'attention';
}) {
  const iconBoxStyle =
    tone === 'primary'
      ? 'bg-blue-50 text-primary border border-blue-100 shadow-2xs'
      : tone === 'attention'
        ? 'bg-amber-50 text-[var(--admin-status-warning)] border border-amber-200/80 shadow-2xs'
        : 'bg-slate-100 text-slate-600 border border-slate-200/80 shadow-2xs';

  return (
    <Card className="flex flex-col justify-between p-5.5 sm:p-6 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </h2>
          <div className={`grid size-9.5 place-items-center rounded-xl ${iconBoxStyle}`}>
            {icon}
          </div>
        </div>
        <div>
          <p
            className={
              tone === 'attention'
                ? 'text-[32px] font-bold leading-none tracking-tight tabular-nums text-[var(--admin-status-warning)]'
                : 'text-[32px] font-bold leading-none tracking-tight tabular-nums text-foreground'
            }
          >
            {number(value)}
          </p>
        </div>
      </div>
      {children && (
        <div className="mt-4 pt-3.5 border-t border-border/80 text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          {children}
        </div>
      )}
    </Card>
  );
}

function CompanyStatus({ status }: { status: string }) {
  return (
    <ResourceStatusBadge tone={status === 'HOAT_DONG' ? 'active' : 'muted'}>
      {status === 'HOAT_DONG'
        ? 'Đang hoạt động'
        : status === 'TAM_NGUNG'
          ? 'Tạm ngưng'
          : 'Trạng thái khác: ' + status}
    </ResourceStatusBadge>
  );
}

function RecentCompanies({
  companies,
  timeZone,
}: {
  companies: PlatformCompanySummary[];
  timeZone: string;
}) {
  if (!companies.length)
    return <ResourceState>Chưa có nhà xe trên nền tảng.</ResourceState>;
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhà xe</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Quản trị viên</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="max-w-64 whitespace-normal">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 font-bold text-sm text-primary border border-blue-100 shadow-2xs">
                      {company.name.trim().charAt(0).toLocaleUpperCase('vi-VN') ||
                        'N'}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-foreground">
                        {company.name}
                      </p>
                      <p className="admin-data-mono mt-0.5 break-all text-xs text-muted-foreground">
                        {company.code}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <CompanyStatus status={company.status} />
                </TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1.5 tabular-nums text-slate-700 font-medium"
                    title="Tài khoản hoạt động, nhân viên đang làm việc"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    {number(company.activeAdministratorCount)} hoạt động
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border/60 md:hidden">
        {companies.map((company) => (
          <li key={company.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 font-bold text-sm text-primary border border-blue-100 shadow-2xs">
                  {company.name.trim().charAt(0).toLocaleUpperCase('vi-VN') ||
                    'N'}
                </div>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-foreground">
                    {company.name}
                  </p>
                  <p className="admin-data-mono mt-0.5 break-all text-xs text-muted-foreground">
                    {company.code}
                  </p>
                </div>
              </div>
              <CompanyStatus status={company.status} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground pt-1">
              <p className="font-medium text-slate-700">
                {number(company.activeAdministratorCount)} quản trị viên hoạt
                động
              </p>
              <time dateTime={company.createdAt} className="text-slate-500">
                {displayTimestamp(company.createdAt, timeZone).split(' · ')[1]}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function OnboardingChart({ overview }: { overview: DashboardOverview }) {
  const maximum = Math.max(1, ...overview.onboarding.map((item) => item.count));
  const first = overview.onboarding[0];
  const last = overview.onboarding[overview.onboarding.length - 1];
  return (
    <Card className="min-w-0 gap-6 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">Nhà xe mới theo tháng</h2>
          <p className="text-xs text-muted-foreground">
            {first?.label} — {last?.label}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-primary shadow-2xs">
          6 tháng gần nhất
        </span>
      </div>
      <ul
        aria-label="Số nhà xe mới theo tháng, tháng hiện tại tính đến thời điểm cập nhật"
        className="grid grid-cols-6 gap-3"
      >
        {overview.onboarding.map((item) => (
          <li
            key={item.label}
            aria-label={
              item.label +
              ': ' +
              number(item.count) +
              ' nhà xe mới' +
              (item.currentMonth ? ', tháng hiện tại chưa kết thúc' : '')
            }
            className="group/bar min-w-0 text-center"
          >
            <div className="flex h-44 flex-col items-center justify-end gap-2 border-b border-border/80 pb-1">
              <span
                className={
                  item.count
                    ? 'text-[13px] font-bold tabular-nums text-foreground group-hover/bar:text-primary transition-colors'
                    : 'text-xs tabular-nums text-muted-foreground'
                }
              >
                {number(item.count)}
              </span>
              <span
                aria-hidden
                className={
                  item.currentMonth
                    ? 'w-3/4 max-w-10 rounded-t-lg bg-primary shadow-xs group-hover/bar:brightness-110 transition-all'
                    : 'w-3/4 max-w-10 rounded-t-lg bg-blue-100 group-hover/bar:bg-blue-200 transition-all'
                }
                style={{
                  height: item.count
                    ? Math.max(8, (item.count / maximum) * 140) + 'px'
                    : '0px',
                }}
              />
            </div>
            <p
              className={
                item.currentMonth
                  ? 'mt-3 text-xs font-bold text-primary'
                  : 'mt-3 text-xs font-medium text-muted-foreground group-hover/bar:text-foreground transition-colors'
              }
            >
              T{Number(item.label.slice(0, 2))}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
        {overview.onboarding.every((item) => item.count === 0)
          ? 'Chưa có nhà xe mới trong giai đoạn này.'
          : 'Tháng hiện tại chưa kết thúc.'}
      </p>
    </Card>
  );
}
export function SuperAdminDashboard() {
  const auth = useAdminSession();
  const session = auth.status === 'authenticated' ? auth.session : null;
  const canRead = hasAllPlatformAdminPermissions(session, [
    'bus-company:read',
    'admin-account:read',
  ]);
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [completedRequest, setCompletedRequest] = useState<{
    identity: string;
    refresh: number;
    error: string | null;
  } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30);
  const identity = session
    ? `${session.accountId}:${[...session.permissions].sort().join(',')}`
    : '';
  const [loadedIdentity, setLoadedIdentity] = useState('');
  const overview = canRead && loadedIdentity === identity ? data : null;
  const requestCompleted =
    completedRequest?.identity === identity &&
    completedRequest.refresh === refresh;
  const loading = canRead && !requestCompleted;
  const error = requestCompleted ? completedRequest.error : null;

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    let current = true;
    getDashboardOverview(controller.signal)
      .then((result) => {
        if (current) {
          setData(result);
          setLoadedIdentity(identity);
          setCompletedRequest({ identity, refresh, error: null });
        }
      })
      .catch((cause: unknown) => {
        if (current && !controller.signal.aborted)
          setCompletedRequest({
            identity,
            refresh,
            error:
              cause instanceof Error ? cause.message : 'Không thể tải tổng quan.',
          });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [canRead, identity, refresh]);

  // Auto-refresh interval
  useEffect(() => {
    if (!canRead || autoRefreshInterval <= 0) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setRefresh((prev) => prev + 1);
      }
    }, autoRefreshInterval * 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [canRead, autoRefreshInterval]);

  const needing = overview?.companies.needingAdministrator ?? 0;
  return (
    <SuperAdminLayout activeSection="overview">
      <div className="admin-ui admin-page-content space-y-6">
        {/* Context Command Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-1">
          <h1 className="sr-only">Tổng quan nền tảng VexGo</h1>

          {/* Left Context */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs">
              <Building2 className="size-3.5 text-slate-500" />
              <span>
                Phạm vi:{' '}
                <strong className="font-semibold text-slate-900">
                  Toàn hệ thống VexGo
                </strong>
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Trực tiếp
            </span>
          </div>

          {/* Right Controls */}
          {canRead && (
            <div className="flex items-center gap-3 flex-wrap">
              <div
                role="radiogroup"
                aria-label="Tần suất tự động làm mới"
                className="inline-flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-border text-xs"
              >
                <span className="text-muted-foreground px-2 py-1 font-medium flex items-center gap-1">
                  <Radio className="size-3 text-primary" />
                  <span>Làm mới:</span>
                </span>
                {[
                  { value: 30, label: '30s' },
                  { value: 60, label: '60s' },
                  { value: 0, label: 'Tắt' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={autoRefreshInterval === option.value}
                    onClick={() => setAutoRefreshInterval(option.value)}
                    className={`px-2 py-1 rounded-md font-medium text-xs transition-all ${
                      autoRefreshInterval === option.value
                        ? 'bg-card text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {overview && (
                <time
                  className="text-xs text-muted-foreground hidden lg:inline-block tabular-nums"
                  dateTime={overview.generatedAt}
                  aria-label={
                    'Cập nhật ' +
                    displayTimestamp(overview.generatedAt, overview.timeZone)
                  }
                >
                  Cập nhật:{' '}
                  {
                    displayTimestamp(
                      overview.generatedAt,
                      overview.timeZone,
                    ).split(' · ')[0]
                  }
                </time>
              )}

              <ResourceRefreshAction
                loading={loading}
                onClick={() => setRefresh((value) => value + 1)}
              />
            </div>
          )}
        </div>

        {!canRead ? (
          <Card className="p-0">
            <ResourceState>
              Bạn cần quyền xem nhà xe và tài khoản quản trị để xem tổng quan
              nền tảng.
            </ResourceState>
          </Card>
        ) : (
          <>
            {error && (
              <ResourceNotice kind="error">
                <div className="space-y-3">
                  <p>{error}</p>
                  {overview && (
                    <p>Đang hiển thị bản dữ liệu trước lần làm mới thất bại.</p>
                  )}
                  <Button
                    variant="outline"
                    disabled={loading}
                    onClick={() => setRefresh((value) => value + 1)}
                  >
                    Thử lại
                  </Button>
                </div>
              </ResourceNotice>
            )}

            {loading && !overview && (
              <div
                role="status"
                aria-label="Đang tải tổng quan nền tảng"
                className="grid gap-4 md:grid-cols-3"
              >
                {[0, 1, 2].map((item) => (
                  <Card key={item} className="space-y-4 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="size-9.5 rounded-xl" />
                    </div>
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-40" />
                  </Card>
                ))}
              </div>
            )}

            {overview && (
              <>
                {/* 1. 3 Thẻ KPI Chỉ số Nền tảng */}
                <div
                  role="region"
                  aria-label="Chỉ số nền tảng hiện tại"
                  aria-busy={loading}
                  className="grid gap-4 md:grid-cols-3"
                >
                  <Metric
                    label="Nhà xe trên nền tảng"
                    value={overview.companies.total}
                    icon={<Building2 className="size-4.5" />}
                    tone="primary"
                  >
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[11px]">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-emerald-600 animate-pulse"
                      />
                      {number(overview.companies.active)} hoạt động
                    </span>
                    {overview.companies.suspended > 0 && (
                      <span className="text-slate-500 font-medium text-[11px]">
                        · {number(overview.companies.suspended)} tạm ngưng
                      </span>
                    )}
                    {overview.companies.other > 0 && (
                      <span className="text-slate-500 font-medium text-[11px]">
                        · {number(overview.companies.other)} khác
                      </span>
                    )}
                  </Metric>
                  <Metric
                    label="Quản trị viên nhà xe"
                    value={overview.administrators.total}
                    icon={<UsersRound className="size-4.5" />}
                    tone="neutral"
                  >
                    <span className="text-slate-600 font-medium text-[11px]">
                      <strong className="text-foreground">
                        {number(overview.administrators.active)}
                      </strong>{' '}
                      đang làm việc
                    </span>
                  </Metric>
                  <Metric
                    label="Cần bổ sung quản trị viên"
                    value={needing}
                    icon={
                      needing ? (
                        <UserRoundCog className="size-4.5" />
                      ) : (
                        <CircleCheck className="size-4.5" />
                      )
                    }
                    tone={needing > 0 ? 'attention' : 'neutral'}
                  >
                    {needing ? (
                      <a
                        className="font-semibold text-[var(--admin-status-warning)] underline underline-offset-4 hover:text-amber-800 transition-colors text-[11px]"
                        href="#companies-needing-admin"
                      >
                        Xem nhà xe cần xử lý →
                      </a>
                    ) : overview.companies.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                        <CircleCheck className="size-3.5 text-emerald-600" /> Đầy
                        đủ quản trị viên
                      </span>
                    ) : (
                      'Chưa có nhà xe cần rà soát'
                    )}
                  </Metric>
                </div>

                {/* 2. Cụm Bento Grid 8:4 Cân đối */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Cột chính (8/12 cột): Nhà xe mới nhất & Biểu đồ Onboarding */}
                  <div className="lg:col-span-8 space-y-6">
                    <Card className="min-w-0 gap-0 py-0 border-border shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6 border-b border-border/80">
                        <div>
                          <h2 className="text-base font-semibold text-foreground">
                            Nhà xe mới nhất
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Các đối tác nhà xe vừa hoàn tất đăng ký hoặc gia nhập sàn VexGo
                          </p>
                        </div>
                        <Link
                          className={
                            buttonVariants({
                              variant: 'outline',
                              size: 'sm',
                            }) + ' text-xs h-7.5 px-2.5 gap-1 shrink-0'
                          }
                          href="/bus-companies"
                        >
                          <span>Tất cả nhà xe</span>
                          <ArrowUpRight className="size-3.5" aria-hidden />
                        </Link>
                      </div>
                      <RecentCompanies
                        companies={overview.recentCompanies}
                        timeZone={overview.timeZone}
                      />
                    </Card>

                    <OnboardingChart overview={overview} />
                  </div>

                  {/* Cột phụ (4/12 cột): Cảnh báo việc khẩn & Lối tắt thao tác nhanh */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* Cảnh báo bổ sung admin */}
                    {needing > 0 ? (
                      <Card
                        id="companies-needing-admin"
                        className="scroll-mt-24 gap-0 border-amber-200/80 bg-amber-50/20 shadow-xs py-0"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2.5 p-4 border-b border-amber-200/60">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7.5 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                              <UserRoundCog className="size-4" />
                            </span>
                            <div>
                              <h2 className="text-xs font-semibold text-foreground">
                                {number(needing)} nhà xe cần bổ sung admin
                              </h2>
                              <p className="text-[11px] text-amber-800/80">
                                Chưa có quản trị viên hoạt động
                              </p>
                            </div>
                          </div>
                          <Link
                            className={
                              buttonVariants({
                                variant: 'outline',
                                size: 'sm',
                              }) +
                              ' text-xs h-7 px-2 border-amber-300 text-amber-900 bg-white hover:bg-amber-100/50 font-medium shrink-0'
                            }
                            href="/admin-accounts"
                          >
                            Cấp tài khoản
                          </Link>
                        </div>
                        <ul className="divide-y divide-amber-200/50">
                          {overview.attentionCompanies.map((company) => (
                            <li
                              key={company.id}
                              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-50/50 transition-colors"
                            >
                              <p className="min-w-0 break-words text-xs font-medium truncate">
                                {company.name}
                              </p>
                              <span className="font-mono shrink-0 text-[11px] text-muted-foreground px-1 py-0.5 bg-amber-100/60 rounded">
                                {company.code}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t border-amber-200/60">
                          Tối đa 5 hồ sơ cũ nhất cần rà soát.
                        </p>
                      </Card>
                    ) : (
                      <Card className="border-border shadow-xs p-3.5">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-900">
                          <div className="grid size-7.5 place-items-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                            <CircleCheck className="size-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">
                              Quản trị viên đầy đủ
                            </p>
                            <p className="text-[11px] text-emerald-700/90 mt-0.5 leading-snug">
                              100% nhà xe hoạt động đã có quản trị viên tiếp quản.
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Lối tắt thao tác nhanh */}
                    <PlatformQuickActions />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
