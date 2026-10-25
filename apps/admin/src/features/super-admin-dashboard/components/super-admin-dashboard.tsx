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
  primary = false,
  attention = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  children?: ReactNode;
  primary?: boolean;
  attention?: boolean;
}) {
  return (
    <div
      className={
        primary ? 'space-y-4 bg-primary/5 p-5 sm:p-6' : 'space-y-4 p-5 sm:p-6'
      }
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span
          aria-hidden
          className={
            attention ? 'text-[var(--admin-status-warning)]' : 'text-primary'
          }
        >
          {icon}
        </span>
        <h2>{label}</h2>
      </div>
      <p
        className={
          attention
            ? 'text-[32px] font-semibold leading-tight tabular-nums text-[var(--admin-status-warning)]'
            : 'text-[32px] font-semibold leading-tight tabular-nums text-foreground'
        }
      >
        {number(value)}
      </p>
      {children && (
        <div className="text-xs text-muted-foreground">{children}</div>
      )}
    </div>
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
                  <p className="break-words font-semibold">{company.name}</p>
                  <p className="admin-data-mono mt-1 break-all text-xs text-muted-foreground">
                    {company.code}
                  </p>
                </TableCell>
                <TableCell>
                  <CompanyStatus status={company.status} />
                </TableCell>
                <TableCell>
                  <span
                    className="tabular-nums"
                    title="Tài khoản hoạt động, nhân viên đang làm việc"
                  >
                    {number(company.activeAdministratorCount)} hoạt động
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {companies.map((company) => (
          <li key={company.id} className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold">{company.name}</p>
                <p className="admin-data-mono mt-1 break-all text-xs text-muted-foreground">
                  {company.code}
                </p>
              </div>
              <CompanyStatus status={company.status} />
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
              <p>
                {number(company.activeAdministratorCount)} quản trị viên hoạt
                động
              </p>
              <time dateTime={company.createdAt}>
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
    <Card className="min-w-0 gap-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Nhà xe mới theo tháng</h2>
          <p className="text-xs text-muted-foreground">
            {first?.label} — {last?.label}
          </p>
        </div>
        <span className="rounded-md bg-primary/5 px-2 py-1 text-xs font-medium text-primary">
          6 tháng
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
            className="min-w-0 text-center"
          >
            <div className="flex h-44 flex-col items-center justify-end gap-2 border-b border-border">
              <span
                className={
                  item.count
                    ? 'text-[13px] font-semibold tabular-nums'
                    : 'text-xs tabular-nums text-muted-foreground'
                }
              >
                {number(item.count)}
              </span>
              <span
                aria-hidden
                className={
                  item.currentMonth
                    ? 'w-3/4 max-w-10 rounded-t-md bg-primary'
                    : 'w-3/4 max-w-10 rounded-t-md bg-primary/25'
                }
                style={{
                  height: item.count
                    ? Math.max(6, (item.count / maximum) * 140) + 'px'
                    : '0px',
                }}
              />
            </div>
            <p
              className={
                item.currentMonth
                  ? 'mt-3 text-xs font-semibold text-primary'
                  : 'mt-3 text-xs text-muted-foreground'
              }
            >
              T{Number(item.label.slice(0, 2))}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
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
              <Card
                role="status"
                aria-label="Đang tải tổng quan nền tảng"
                className="grid gap-0 divide-y p-0 md:grid-cols-3 md:divide-x md:divide-y-0"
              >
                {[0, 1, 2].map((item) => (
                  <div key={item} className="space-y-4 p-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </Card>
            )}
            {overview && (
              <>
                <Card
                  role="region"
                  aria-label="Chỉ số nền tảng hiện tại"
                  aria-busy={loading}
                  className="grid gap-0 divide-y p-0 md:grid-cols-3 md:divide-x md:divide-y-0"
                >
                  <Metric
                    label="Nhà xe trên nền tảng"
                    value={overview.companies.total}
                    icon={<Building2 className="size-4" />}
                    primary
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-[var(--admin-status-success)]"
                      />
                      {number(overview.companies.active)} hoạt động
                    </span>
                    {overview.companies.suspended > 0 && (
                      <span>
                        {' '}
                        · {number(overview.companies.suspended)} tạm ngưng
                      </span>
                    )}
                    {overview.companies.other > 0 && (
                      <span>
                        {' '}
                        · {number(overview.companies.other)} trạng thái khác
                      </span>
                    )}
                  </Metric>
                  <Metric
                    label="Quản trị viên nhà xe"
                    value={overview.administrators.total}
                    icon={<UsersRound className="size-4" />}
                  >
                    {number(overview.administrators.active)} đang làm việc, tài
                    khoản hoạt động
                  </Metric>
                  <Metric
                    label="Cần bổ sung quản trị viên"
                    value={needing}
                    icon={
                      needing ? (
                        <UserRoundCog className="size-4" />
                      ) : (
                        <CircleCheck className="size-4" />
                      )
                    }
                    attention={needing > 0}
                  >
                    {needing ? (
                      <a
                        className="font-medium text-[var(--admin-status-warning)] underline underline-offset-4"
                        href="#companies-needing-admin"
                      >
                        Xem nhà xe cần xử lý
                      </a>
                    ) : overview.companies.active ? (
                      'Nhà xe đang hoạt động đã có quản trị viên'
                    ) : (
                      'Chưa có nhà xe cần rà soát'
                    )}
                  </Metric>
                </Card>
                {needing > 0 && (
                  <Card
                    id="companies-needing-admin"
                    className="scroll-mt-24 gap-0 border-[var(--admin-status-warning)]/20 py-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <h2 className="text-base font-semibold">
                        {number(needing)} nhà xe cần bổ sung quản trị viên
                      </h2>
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
                    <ul className="divide-y border-t">
                      {overview.attentionCompanies.map((company) => (
                        <li
                          key={company.id}
                          className="flex items-center justify-between gap-4 px-5 py-3"
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
