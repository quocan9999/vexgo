'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Building2,
  CircleCheck,
  UserRoundCog,
  UsersRound,
} from 'lucide-react';
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

  const needing = overview?.companies.needingAdministrator ?? 0;
  return (
    <SuperAdminLayout activeSection="overview">
      <div className="admin-ui admin-page-content space-y-6">
        <AdminPageHeader
          eyebrow="QUẢN TRỊ NỀN TẢNG"
          title="Tổng quan VexGo"
          titleId="platform-overview-title"
          actions={
            canRead ? (
              <div className="flex flex-wrap items-center gap-3">
                {overview && (
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={overview.generatedAt}
                    aria-label={
                      'Cập nhật ' +
                      displayTimestamp(
                        overview.generatedAt,
                        overview.timeZone,
                      ) +
                      ' · ' +
                      overview.timeZone
                    }
                    title={
                      displayTimestamp(
                        overview.generatedAt,
                        overview.timeZone,
                      ) +
                      ' · ' +
                      overview.timeZone
                    }
                  >
                    Cập nhật{' '}
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
            ) : undefined
          }
        />
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
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-emerald-600 animate-pulse"
                      />
                      {number(overview.companies.active)} hoạt động
                    </span>
                    {overview.companies.suspended > 0 && (
                      <span className="text-slate-500 font-medium">
                        · {number(overview.companies.suspended)} tạm ngưng
                      </span>
                    )}
                    {overview.companies.other > 0 && (
                      <span className="text-slate-500 font-medium">
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
                    <span className="text-slate-600 font-medium">
                      <strong className="text-foreground">{number(overview.administrators.active)}</strong> đang làm việc
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
                        className="font-semibold text-[var(--admin-status-warning)] underline underline-offset-4 hover:text-amber-800 transition-colors"
                        href="#companies-needing-admin"
                      >
                        Xem nhà xe cần xử lý →
                      </a>
                    ) : overview.companies.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CircleCheck className="size-3.5 text-emerald-600" /> Đầy đủ quản trị viên
                      </span>
                    ) : (
                      'Chưa có nhà xe cần rà soát'
                    )}
                  </Metric>
                </div>
                {needing > 0 && (
                  <Card
                    id="companies-needing-admin"
                    className="scroll-mt-24 gap-0 border-amber-200/80 bg-amber-50/20 shadow-sm py-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
                          <UserRoundCog className="size-4.5" />
                        </span>
                        <h2 className="text-base font-semibold text-foreground">
                          {number(needing)} nhà xe cần bổ sung quản trị viên
                        </h2>
                      </div>
                      <Link
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                        })}
                        href="/admin-accounts"
                      >
                        Quản lý tài khoản <ArrowUpRight aria-hidden />
                      </Link>
                    </div>
                    <ul className="divide-y divide-amber-200/50 border-t border-amber-200/60">
                      {overview.attentionCompanies.map((company) => (
                        <li
                          key={company.id}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-amber-50/50 transition-colors"
                        >
                          <p className="min-w-0 break-words text-[13px] font-medium">
                            {company.name}
                          </p>
                          <span className="admin-data-mono shrink-0 text-xs text-muted-foreground">
                            {company.code}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="border-t px-5 py-3 text-xs text-muted-foreground">
                      Tối đa 5 hồ sơ cũ nhất chưa có quản trị viên hoạt động.
                    </p>
                  </Card>
                )}
                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                  <Card className="min-w-0 gap-0 py-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
                      <h2 className="text-base font-semibold">
                        Nhà xe mới nhất
                      </h2>
                      <Link
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'sm',
                        })}
                        href="/bus-companies"
                      >
                        Xem tất cả <ArrowUpRight aria-hidden />
                      </Link>
                    </div>
                    <RecentCompanies
                      companies={overview.recentCompanies}
                      timeZone={overview.timeZone}
                    />
                  </Card>
                  <OnboardingChart overview={overview} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
}
