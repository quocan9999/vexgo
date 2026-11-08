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
import { useLocale, useTranslations } from 'next-intl';
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
  const tReports = useTranslations('reports');
  return (
    <div aria-label={tReports('loadingTitle')} className={styles.loadingGrid}>
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
        aria-label={tReports('loadingChart')}
        className={styles.chartPanel}
      >
        <Skeleton aria-hidden="true" className={styles.chartSkeleton} />
      </Card>
      <Card
        role="region"
        aria-label={tReports('loadingService')}
        className={styles.tablePanel}
      >
        <ResourceTableSkeleton resourceLabel={tReports('loadingService')} />
      </Card>
      <Card
        role="region"
        aria-label={tReports('loadingTime')}
        className={styles.tablePanel}
      >
        <ResourceTableSkeleton resourceLabel={tReports('loadingTime')} />
      </Card>
      <p className="sr-only" role="status" aria-live="polite">
        {tReports('loadingTitle')}…
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
  tone = 'default',
}: {
  label: string;
  note: string;
  value: string;
  icon: LucideIcon;
  primary?: boolean;
  tone?: 'default' | 'success' | 'indigo' | 'destructive' | 'teal';
}) {
  return (
    <Card
      role="region"
      aria-label={label}
      className={styles.metricCard}
      data-primary={primary}
      data-tone={tone}
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
  const tReports = useTranslations('reports');
  const locale = useLocale();
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

  const groupOptions = [
    { value: 'day' as const, label: tReports('groupDay') },
    { value: 'month' as const, label: tReports('groupMonth') },
    { value: 'quarter' as const, label: tReports('groupQuarter') },
  ];

  function showExportPlaceholder() {
    toast.info(tReports('exportPlaceholderToast'));
  }

  const periodSummary = report
    ? `${formatReportRange(report.meta)}`
    : dateRange
      ? dateRange.from && dateRange.to
        ? dateRange.from === dateRange.to
          ? formatDateOnly(dateRange.from)
          : `${formatDateOnly(dateRange.from)} – ${formatDateOnly(dateRange.to)}`
        : dateRange.from
          ? `${tReports('fromPrefix')}${formatDateOnly(dateRange.from)}`
          : dateRange.to
            ? `${tReports('toPrefix')}${formatDateOnly(dateRange.to)}`
            : tReports('currentMonth')
      : tReports('currentMonth');

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
                {tReports('exportCsv')}
              </Button>
            </div>
          }
          eyebrow={tReports('eyebrow')}
          title={tReports('reportsTitle')}
          titleId="revenue-report-title"
        />

        <Card
          role="region"
          aria-label={tReports('filterPanelAria')}
          className={styles.filterPanel}
        >
          <div className={styles.filterControls}>
            <DateRangeFilter
              appearance="resource"
              label={tReports('dateRangeLabel')}
              emptyValueLabel={
                report && !dateRange
                  ? locale === 'en'
                    ? `Month ${report.meta.fromDate.slice(5, 7)}/${report.meta.fromDate.slice(0, 4)}`
                    : `Tháng ${report.meta.fromDate.slice(5, 7)}/${report.meta.fromDate.slice(0, 4)}`
                  : tReports('currentMonth')
              }
              onApply={updateDateRange}
              title={tReports('dateRangeTitle')}
              value={dateRange}
            />
            <LabeledSelectFilter
              appearance="resource"
              label={tReports('groupByLabel')}
              onChange={updateGroupBy}
              options={groupOptions}
              value={groupBy}
            />
          </div>
          <p aria-live="polite" className={styles.periodSummary}>
            <span className={styles.periodLabel}>{tReports('periodSummaryLabel')}</span>
            <span>
              {periodSummary}
              <span
                aria-label={tReports('recordedHint')}
                className={styles.definitionHint}
                role="note"
                tabIndex={0}
                title={tReports('recordedHint')}
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
                  ? tReports('accessDenied')
                  : tReports('reportLoadError')}
              </h2>
              <p>{error.message}</p>
              {error.retryable && (
                <Button onClick={retry} variant="outline">
                  {tReports('retry')}
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
  const tReports = useTranslations('reports');
  const locale = useLocale();
  const { totals, series, serviceBreakdown } = report;
  const noData =
    BigInt(totals.grossReceipts) === BigInt(0) &&
    BigInt(totals.refundAmount) === BigInt(0) &&
    totals.successfulPayments === 0 &&
    totals.soldTicketCount === 0 &&
    totals.issuedShipmentCount === 0;

  const serviceLabels: Record<RevenueReportServiceKind, string> = {
    ticket: tReports('serviceTicket'),
    standaloneShipment: tReports('serviceStandaloneShipment'),
    accompaniedShipment: tReports('serviceAccompaniedShipment'),
  };

  const groupUnitUpper =
    groupBy === 'day'
      ? tReports('dayUnitUpper')
      : groupBy === 'month'
        ? tReports('monthUnitUpper')
        : tReports('quarterUnitUpper');

  const groupUnit =
    groupBy === 'day'
      ? tReports('dayUnit')
      : groupBy === 'month'
        ? tReports('monthUnit')
        : tReports('quarterUnit');

  return (
    <div className={styles.content}>
      {report.reconciliation.refundCount > 0 && (
        <ResourceNotice kind="info">
          <div>
            <h2 className="mb-2 text-base font-semibold">
              {tReports('reconciliationTitle')}
            </h2>
            <p>
              {tReports('reconciliationDescription', {
                count: report.reconciliation.refundCount.toLocaleString(
                  locale === 'en' ? 'en-US' : 'vi-VN',
                ),
                amount: formatRevenueVnd(report.reconciliation.refundAmount),
              })}
            </p>
          </div>
        </ResourceNotice>
      )}
      <section
        aria-label={tReports('trendChart')}
        className={styles.metricGrid}
      >
        <MetricCard
          icon={Wallet}
          primary
          label={tReports('netRevenueCard')}
          note={tReports('netRevenueNote')}
          value={formatRevenueVnd(totals.netRevenue)}
        />
        <MetricCard
          icon={Ticket}
          tone="success"
          label={tReports('ticketRevenueCard')}
          note={tReports('ticketRevenueNote')}
          value={formatRevenueVnd(totals.netTicketRevenue)}
        />
        <MetricCard
          icon={Package}
          tone="indigo"
          label={tReports('cargoRevenueCard')}
          note={tReports('cargoRevenueNote')}
          value={formatRevenueVnd(totals.netShipmentRevenue)}
        />
        <MetricCard
          icon={ArrowDownLeft}
          tone="destructive"
          label={tReports('refundAmountCard')}
          note={tReports('refundAmountNote')}
          value={formatRevenueVnd(totals.refundAmount)}
        />
        <MetricCard
          icon={CircleCheck}
          tone="teal"
          label={tReports('successfulPaymentsCard')}
          note={tReports('successfulPaymentsNote')}
          value={totals.successfulPayments.toLocaleString(
            locale === 'en' ? 'en-US' : 'vi-VN',
          )}
        />
        <Card
          role="region"
          aria-label={tReports('volumeCardTitle')}
          className={`${styles.metricCard} ${styles.volumeCard}`}
        >
          <div className={styles.metricHeading}>
            <h2 className={styles.metricLabel}>{tReports('volumeCardTitle')}</h2>
            <span className={styles.metricIcon}>
              <ChartNoAxesCombined aria-hidden="true" size={18} />
            </span>
          </div>
          <div className={styles.countPair}>
            <p>
              <strong>
                {totals.soldTicketCount.toLocaleString(
                  locale === 'en' ? 'en-US' : 'vi-VN',
                )}
              </strong>
              <span>{tReports('soldTicketsLabel')}</span>
            </p>
            <p>
              <strong>
                {totals.issuedShipmentCount.toLocaleString(
                  locale === 'en' ? 'en-US' : 'vi-VN',
                )}
              </strong>
              <span>{tReports('issuedShipmentsLabel')}</span>
            </p>
          </div>
          <p className={styles.metricNote}>
            {tReports('volumeCardNote')}
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
              {tReports('chartEyebrow', { unit: groupUnitUpper })}
            </p>
            <h2 id="revenue-trend-title">{tReports('chartTitle')}</h2>
          </div>
          <span
            aria-label={tReports('chartAria')}
            className={styles.chartLegend}
          >
            <span aria-hidden="true" className={styles.legendLine} />
            {tReports('chartLegend')}
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
            <p className={styles.panelEyebrow}>{tReports('serviceBreakdownEyebrow')}</p>
            <h2 id="service-breakdown-title">{tReports('serviceBreakdownTitle')}</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <Table className="min-w-[680px] [&_td]:tabular-nums [&_td:not(:first-child)]:text-right [&_th:not(:first-child)]:text-right">
            <caption className="sr-only">
              {tReports('serviceBreakdownCaption')}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{tReports('colRevenueSource')}</TableHead>
                <TableHead scope="col">{tReports('colGrossReceipts')}</TableHead>
                <TableHead scope="col">{tReports('colRefundAmount')}</TableHead>
                <TableHead scope="col">{tReports('colNetRevenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serviceBreakdown.map((line) => (
                <TableRow key={line.kind}>
                  <TableHead
                    scope="row"
                    className="bg-transparent text-[13px] font-medium"
                  >
                    {serviceLabels[line.kind]}
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
                  {tReports('totalRow')}
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
            <p className={styles.panelEyebrow}>{tReports('timeBreakdownEyebrow')}</p>
            <h2 id="revenue-period-title">{tReports('timeBreakdownTitle')}</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <Table className="min-w-[680px] [&_td]:tabular-nums [&_td:not(:first-child)]:text-right [&_th:not(:first-child)]:text-right">
            <caption className="sr-only">
              {tReports('timeBreakdownCaption', { unit: groupUnit })}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{tReports('colPeriod')}</TableHead>
                <TableHead scope="col">{tReports('colTicketNet')}</TableHead>
                <TableHead scope="col">{tReports('colCargoNet')}</TableHead>
                <TableHead scope="col">{tReports('colGrossBeforeRefund')}</TableHead>
                <TableHead scope="col">{tReports('colRefund')}</TableHead>
                <TableHead scope="col">{tReports('colNet')}</TableHead>
                <TableHead scope="col">{tReports('colSuccessfulPayments')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {noData ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-40 whitespace-normal text-center [&_strong]:block [&_span]:mt-2 [&_span]:block [&_span]:text-muted-foreground"
                  >
                    <strong>{tReports('emptyTitle')}</strong>
                    <span>
                      {tReports('emptyDescription')}
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
                      {formatPeriod(item.period, groupBy, locale)}
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
                      {item.successfulPayments.toLocaleString(
                        locale === 'en' ? 'en-US' : 'vi-VN',
                      )}
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
