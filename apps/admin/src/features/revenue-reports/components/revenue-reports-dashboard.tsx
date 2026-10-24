'use client';

import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowDownLeft,
  ChartNoAxesCombined,
  CircleCheck,
  Info,
  Package,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceTableSkeleton,
  ResourceState,
  ResourceNotice,
  ResourceRefreshAction,
} from '@/components/admin/resource-ui';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  DateRangeFilter,
  LabeledSelectFilter,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/action-button';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  formatDateOnly,
  formatPeriod,
  formatReportRange,
  formatRevenueVnd,
  groupByLabel,
} from '../format';
import { useRevenueReport } from '../hooks/use-revenue-report';
import type { RevenueReportServiceKind } from '../types/revenue-report';
import { RevenueReportChart } from './revenue-report-chart';
import styles from './revenue-reports.module.css';

const GROUP_OPTIONS = [
  { value: 'day', label: 'Ngày' },
  { value: 'month', label: 'Tháng' },
  { value: 'quarter', label: 'Quý' },
] as const;

const SERVICE_LABELS: Record<RevenueReportServiceKind, string> = {
  ticket: 'Vé xe',
  standaloneShipment: 'Gửi hàng độc lập',
  accompaniedShipment: 'Gửi hàng kèm vé',
};

function DashboardLoading() {
  return (
    <div aria-label="Đang tải báo cáo doanh thu" className={styles.loadingGrid}>
      <div aria-hidden="true" className={styles.metricGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <Card
            className={styles.metricSkeleton}
            data-wide={index === 0 || index === 5}
            key={index}
          >
            <Skeleton className={styles.labelSkeleton} />
            <Skeleton className={styles.valueSkeleton} />
            <Skeleton className={styles.noteSkeleton} />
          </Card>
        ))}
      </div>
      <Card
        role="region"
        aria-label="Đang tải biểu đồ"
        className={styles.chartPanel}
      >
        <Skeleton aria-hidden="true" className={styles.chartSkeleton} />
      </Card>
      <Card
        role="region"
        aria-label="Đang tải cơ cấu doanh thu"
        className={styles.tablePanel}
      >
        <ResourceTableSkeleton resourceLabel="cơ cấu doanh thu" />
      </Card>
      <Card
        role="region"
        aria-label="Đang tải báo cáo theo thời gian"
        className={styles.tablePanel}
      >
        <ResourceTableSkeleton resourceLabel="báo cáo theo thời gian" />
      </Card>
      <p className="sr-only" role="status" aria-live="polite">
        Đang tải báo cáo doanh thu…
      </p>
    </div>
  );
}

function MetricCard({
  label,
  note,
  value,
  icon: Icon,
  primary = false,
}: {
  label: string;
  note: string;
  value: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Card
      role="region"
      aria-label={label}
      className={styles.metricCard}
      data-primary={primary}
    >
      <div className={styles.metricHeading}>
        <h2 className={styles.metricLabel}>{label}</h2>
        <span className={styles.metricIcon}>
          <Icon aria-hidden="true" size={18} />
        </span>
      </div>
      <p className={styles.metricValue} data-negative={value.startsWith('−')}>
        {value}
      </p>
      <p className={styles.metricNote}>{note}</p>
    </Card>
  );
}

export function RevenueReportsDashboard() {
  const {
    dateRange,
    error,
    groupBy,
    loading,
    report,
    retry,
    updateDateRange,
    updateGroupBy,
  } = useRevenueReport();
  function showExportPlaceholder() {
    toast.info('Tính năng xuất báo cáo đang được triển khai');
  }

  const periodSummary = report
    ? `${formatReportRange(report.meta)}`
    : dateRange
      ? `${formatDateOnly(dateRange.from)} – ${formatDateOnly(dateRange.to)}`
      : `Tháng hiện tại`;

  return (
    <SuperAdminLayout activeSection="revenue-reports">
      <div className={`admin-page-content admin-ui ${styles.page}`}>
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              <ResourceRefreshAction loading={loading} onClick={retry} />
              <Button
                onClick={showExportPlaceholder}
                type="button"
                variant="outline"
              >
                <ArrowDownToLine aria-hidden="true" size={16} />
                Xuất CSV
              </Button>
            </div>
          }
          eyebrow="BÁO CÁO NHÀ XE"
          title="Báo cáo doanh thu"
          titleId="revenue-report-title"
        />

        <Card
          role="region"
          aria-label="Bộ lọc báo cáo doanh thu"
          className={styles.filterPanel}
        >
          <div className={styles.filterControls}>
            <DateRangeFilter
              appearance="resource"
              label="Thời gian báo cáo"
              emptyValueLabel={
                report && !dateRange
                  ? `Tháng ${report.meta.fromDate.slice(5, 7)}/${report.meta.fromDate.slice(0, 4)}`
                  : 'Tháng hiện tại'
              }
              onApply={updateDateRange}
              title="Lọc báo cáo theo ngày"
              value={dateRange}
            />
            <LabeledSelectFilter
              appearance="resource"
              label="Gom số liệu theo"
              onChange={updateGroupBy}
              options={GROUP_OPTIONS}
              value={groupBy}
            />
          </div>
          <p aria-live="polite" className={styles.periodSummary}>
            <span className={styles.periodLabel}>Kỳ đang xem</span>
            <span>
              {periodSummary}
              <span
                aria-label="Theo giao dịch đã ghi nhận"
                className={styles.definitionHint}
                role="note"
                tabIndex={0}
                title="Theo giao dịch đã ghi nhận"
              >
                <Info aria-hidden="true" size={15} />
              </span>
            </span>
          </p>
        </Card>

        {loading && <DashboardLoading />}

        {!loading && error && (
          <Card>
            <ResourceState error>
              <h2 className="text-base font-semibold text-foreground">
                {error.accessDenied
                  ? 'Không có quyền truy cập'
                  : 'Không tải được báo cáo'}
              </h2>
              <p>{error.message}</p>
              {error.retryable && (
                <Button onClick={retry} variant="outline">
                  Thử lại
                </Button>
              )}
            </ResourceState>
          </Card>
        )}

        {!loading && !error && report && (
          <RevenueReportContent
            groupBy={report.meta.groupBy}
            report={report.data}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}

function RevenueReportContent({
  groupBy,
  report,
}: {
  groupBy: 'day' | 'month' | 'quarter';
  report: NonNullable<ReturnType<typeof useRevenueReport>['report']>['data'];
}) {
  const { totals, series, serviceBreakdown } = report;
  const noData =
    BigInt(totals.grossReceipts) === BigInt(0) &&
    BigInt(totals.refundAmount) === BigInt(0) &&
    totals.successfulPayments === 0 &&
    totals.soldTicketCount === 0 &&
    totals.issuedShipmentCount === 0;

  return (
    <div className={styles.content}>
      {report.reconciliation.refundCount > 0 && (
        <ResourceNotice kind="info">
          <div>
            <h2 className="mb-2 text-base font-semibold">
              Hoàn tiền cần đối soát nguồn thu
            </h2>
            <p>
              {report.reconciliation.refundCount.toLocaleString('vi-VN')} khoản
              hoàn thành công, tổng{' '}
              {formatRevenueVnd(report.reconciliation.refundAmount)}, chưa được
              trừ vào báo cáo vì thanh toán gốc chưa đủ điều kiện ghi nhận doanh
              thu F12. Cần xác minh lịch sử thanh toán trước khi đối soát.
            </p>
          </div>
        </ResourceNotice>
      )}
      <section
        aria-label="Chỉ số doanh thu trong kỳ"
        className={styles.metricGrid}
      >
        <MetricCard
          icon={Wallet}
          primary
          label="Doanh thu ròng"
          note="Sau khi trừ tiền hoàn thành công"
          value={formatRevenueVnd(totals.netRevenue)}
        />
        <MetricCard
          icon={Ticket}
          label="Doanh thu vé"
          note="Vé đã thu, sau tiền hoàn"
          value={formatRevenueVnd(totals.netTicketRevenue)}
        />
        <MetricCard
          icon={Package}
          label="Doanh thu gửi hàng"
          note="Phí gửi hàng, sau tiền hoàn"
          value={formatRevenueVnd(totals.netShipmentRevenue)}
        />
        <MetricCard
          icon={ArrowDownLeft}
          label="Tiền đã hoàn"
          note="Khoản hoàn tiền thành công trong kỳ"
          value={formatRevenueVnd(totals.refundAmount)}
        />
        <MetricCard
          icon={CircleCheck}
          label="Thanh toán thành công"
          note="Không gồm hoàn tiền, đơn 0đ hoặc đối soát"
          value={totals.successfulPayments.toLocaleString('vi-VN')}
        />
        <Card
          role="region"
          aria-label="Vé và vận đơn phát hành"
          className={`${styles.metricCard} ${styles.volumeCard}`}
        >
          <div className={styles.metricHeading}>
            <h2 className={styles.metricLabel}>Vé & vận đơn phát hành</h2>
            <span className={styles.metricIcon}>
              <ChartNoAxesCombined aria-hidden="true" size={18} />
            </span>
          </div>
          <div className={styles.countPair}>
            <p>
              <strong>{totals.soldTicketCount.toLocaleString('vi-VN')}</strong>
              <span>Vé đã bán</span>
            </p>
            <p>
              <strong>
                {totals.issuedShipmentCount.toLocaleString('vi-VN')}
              </strong>
              <span>Vận đơn đã phát</span>
            </p>
          </div>
          <p className={styles.metricNote}>
            Phát hành hoặc quyết toán trong kỳ, không phải số còn hiệu lực.
          </p>
        </Card>
      </section>

      <Card
        role="region"
        aria-labelledby="revenue-trend-title"
        className={styles.chartPanel}
      >
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>
              THEO {groupByLabel(groupBy).toLocaleUpperCase('vi-VN')}
            </p>
            <h2 id="revenue-trend-title">Biến động doanh thu ròng</h2>
          </div>
          <span
            aria-label="Đường biểu diễn doanh thu ròng"
            className={styles.chartLegend}
          >
            <span aria-hidden="true" className={styles.legendLine} />
            Doanh thu ròng
          </span>
        </div>
        <RevenueReportChart groupBy={groupBy} series={series} />
      </Card>

      <Card
        role="region"
        aria-labelledby="service-breakdown-title"
        className={styles.tablePanel}
      >
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>NGUỒN THU</p>
            <h2 id="service-breakdown-title">Cơ cấu doanh thu dịch vụ</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <Table className="min-w-[680px] [&_td]:tabular-nums [&_td:not(:first-child)]:text-right [&_th:not(:first-child)]:text-right">
            <caption className="sr-only">
              Doanh thu vé xe và gửi hàng trong kỳ
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Nguồn thu</TableHead>
                <TableHead scope="col">Tiền đã thu</TableHead>
                <TableHead scope="col">Tiền hoàn</TableHead>
                <TableHead scope="col">Doanh thu ròng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceBreakdown.map((line) => (
                <TableRow key={line.kind}>
                  <TableHead
                    scope="row"
                    className="bg-transparent text-[13px] font-medium"
                  >
                    {SERVICE_LABELS[line.kind]}
                  </TableHead>
                  <TableCell>{formatRevenueVnd(line.grossReceipts)}</TableCell>
                  <TableCell>{formatRevenueVnd(line.refundAmount)}</TableCell>
                  <TableCell>{formatRevenueVnd(line.netRevenue)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 bg-muted/40 font-semibold">
                <TableHead
                  scope="row"
                  className="bg-transparent text-[13px] font-medium"
                >
                  Tổng cộng
                </TableHead>
                <TableCell>{formatRevenueVnd(totals.grossReceipts)}</TableCell>
                <TableCell>{formatRevenueVnd(totals.refundAmount)}</TableCell>
                <TableCell>{formatRevenueVnd(totals.netRevenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card
        role="region"
        aria-labelledby="revenue-period-title"
        className={styles.tablePanel}
      >
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>CÙNG DỮ LIỆU VỚI BIỂU ĐỒ</p>
            <h2 id="revenue-period-title">Báo cáo theo thời gian</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <Table className="min-w-[680px] [&_td]:tabular-nums [&_td:not(:first-child)]:text-right [&_th:not(:first-child)]:text-right">
            <caption className="sr-only">
              Doanh thu theo từng {groupByLabel(groupBy)}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Kỳ</TableHead>
                <TableHead scope="col">Vé ròng</TableHead>
                <TableHead scope="col">Gửi hàng ròng</TableHead>
                <TableHead scope="col">Thu trước hoàn</TableHead>
                <TableHead scope="col">Hoàn tiền</TableHead>
                <TableHead scope="col">Ròng</TableHead>
                <TableHead scope="col">Thanh toán thành công</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {noData ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 whitespace-normal text-center [&_strong]:block [&_span]:mt-2 [&_span]:block [&_span]:text-muted-foreground"
                  >
                    <strong>Chưa có giao dịch trong kỳ báo cáo</strong>
                    <span>
                      Thử chọn khoảng ngày khác để xem doanh thu đã ghi nhận.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                series.map((item) => (
                  <TableRow key={item.period}>
                    <TableHead
                      scope="row"
                      className="bg-transparent text-[13px] font-medium"
                    >
                      {formatPeriod(item.period, groupBy)}
                    </TableHead>
                    <TableCell>
                      {formatRevenueVnd(item.netTicketRevenue)}
                    </TableCell>
                    <TableCell>
                      {formatRevenueVnd(item.netShipmentRevenue)}
                    </TableCell>
                    <TableCell>
                      {formatRevenueVnd(item.grossReceipts)}
                    </TableCell>
                    <TableCell>{formatRevenueVnd(item.refundAmount)}</TableCell>
                    <TableCell>{formatRevenueVnd(item.netRevenue)}</TableCell>
                    <TableCell>
                      {item.successfulPayments.toLocaleString('vi-VN')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
