'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowDownLeft, ChartNoAxesCombined, CircleAlert, CircleCheck, Info, Package, Ticket, Wallet, type LucideIcon } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import {
  DateRangeFilter,
  LabeledSelectFilter,
} from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
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
          <div className={`panel ${styles.metricSkeleton}`} data-wide={index === 0 || index === 5} key={index}>
            <span className={`skeleton ${styles.labelSkeleton}`} />
            <span className={`skeleton ${styles.valueSkeleton}`} />
            <span className={`skeleton ${styles.noteSkeleton}`} />
          </div>
        ))}
      </div>
      <section aria-label="Đang tải biểu đồ" className={`panel ${styles.chartPanel}`}>
        <span aria-hidden="true" className={`skeleton ${styles.chartSkeleton}`} />
      </section>
      <section aria-label="Đang tải cơ cấu doanh thu" className={`panel ${styles.tablePanel}`}>
        <AdminTableSkeleton resourceLabel="cơ cấu doanh thu" />
      </section>
      <section aria-label="Đang tải báo cáo theo thời gian" className={`panel ${styles.tablePanel}`}>
        <AdminTableSkeleton resourceLabel="báo cáo theo thời gian" />
      </section>
      <p className="sr-only" role="status" aria-live="polite">
        Đang tải báo cáo doanh thu…
      </p>
    </div>
  );
}

function MetricCard({ label, note, value, icon: Icon, primary = false }: {
  label: string;
  note: string;
  value: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <article className={`panel ${styles.metricCard}`} data-primary={primary}>
      <div className={styles.metricHeading}>
        <h2 className={styles.metricLabel}>{label}</h2>
        <span className={styles.metricIcon}><Icon aria-hidden="true" size={18} /></span>
      </div>
      <p className={styles.metricValue} data-negative={value.startsWith('−')}>
        {value}
      </p>
      <p className={styles.metricNote}>{note}</p>
    </article>
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
  const toastSequence = useRef(0);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showExportPlaceholder() {
    toastSequence.current += 1;
    setToast({
      id: toastSequence.current,
      message: 'Tính năng xuất báo cáo đang được triển khai',
    });
  }

  const periodSummary = report
    ? `${formatReportRange(report.meta)}`
    : dateRange
      ? `${formatDateOnly(dateRange.from)} – ${formatDateOnly(dateRange.to)}`
      : `Tháng hiện tại`;

  return (
    <SuperAdminLayout activeSection="revenue-reports">
      <div className={`admin-page-content ${styles.page}`}>
        {toast && (
          <div
            aria-atomic="true"
            aria-live="polite"
            className={styles.toast}
            key={toast.id}
            role="status"
          >
            {toast.message}
          </div>
        )}

        <AdminPageHeader
          actions={(
            <Button
              className={styles.exportButton}
              onClick={showExportPlaceholder}
              type="button"
              variant="secondary"
            >
              <ArrowDownToLine aria-hidden="true" size={16} />
              Xuất CSV
            </Button>
          )}
          eyebrow="BÁO CÁO NHÀ XE"
          title="Báo cáo doanh thu"
          titleId="revenue-report-title"
        />

        <section aria-label="Bộ lọc báo cáo doanh thu" className={`panel ${styles.filterPanel}`}>
          <div className={styles.filterControls}>
            <div className={styles.dateField}>
              <span className={styles.filterLabel}>Thời gian báo cáo</span>
              <DateRangeFilter
                label={report && !dateRange ? `Tháng ${report.meta.fromDate.slice(5, 7)}/${report.meta.fromDate.slice(0, 4)}` : 'Tháng hiện tại'}
                onApply={updateDateRange}
                title="Lọc báo cáo theo ngày"
                value={dateRange}
              />
            </div>
            <LabeledSelectFilter
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
        </section>

        {loading && <DashboardLoading />}

        {!loading && error && (
          <section className={`panel ${styles.errorPanel}`}>
            <CircleAlert aria-hidden="true" size={22} />
            <div>
              <h2>{error.accessDenied ? 'Không có quyền truy cập' : 'Không tải được báo cáo'}</h2>
              <p role="alert">{error.message}</p>
              {error.retryable && (
                <Button onClick={retry} type="button" variant="secondary">
                  Thử lại
                </Button>
              )}
            </div>
          </section>
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
        <section className={`panel ${styles.reconciliationNotice}`} role="status">
          <CircleAlert aria-hidden="true" size={20} />
          <div>
            <h2>Hoàn tiền cần đối soát nguồn thu</h2>
            <p>{report.reconciliation.refundCount.toLocaleString('vi-VN')} khoản hoàn thành công, tổng {formatRevenueVnd(report.reconciliation.refundAmount)}, chưa được trừ vào báo cáo vì thanh toán gốc chưa đủ điều kiện ghi nhận doanh thu F12. Cần xác minh lịch sử thanh toán trước khi đối soát.</p>
          </div>
        </section>
      )}
      <section aria-label="Chỉ số doanh thu trong kỳ" className={styles.metricGrid}>
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
        <article className={`panel ${styles.metricCard} ${styles.volumeCard}`}>
          <div className={styles.metricHeading}>
            <h2 className={styles.metricLabel}>Vé & vận đơn phát hành</h2>
            <span className={styles.metricIcon}><ChartNoAxesCombined aria-hidden="true" size={18} /></span>
          </div>
          <div className={styles.countPair}>
            <p><strong>{totals.soldTicketCount.toLocaleString('vi-VN')}</strong><span>Vé đã bán</span></p>
            <p><strong>{totals.issuedShipmentCount.toLocaleString('vi-VN')}</strong><span>Vận đơn đã phát</span></p>
          </div>
          <p className={styles.metricNote}>Phát hành hoặc quyết toán trong kỳ, không phải số còn hiệu lực.</p>
        </article>
      </section>

      <section
        aria-labelledby="revenue-trend-title"
        className={`panel ${styles.chartPanel}`}
      >
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>THEO {groupByLabel(groupBy).toLocaleUpperCase('vi-VN')}</p>
            <h2 id="revenue-trend-title">Biến động doanh thu ròng</h2>
          </div>
          <span aria-label="Đường biểu diễn doanh thu ròng" className={styles.chartLegend}>
            <span aria-hidden="true" className={styles.legendLine} />
            Doanh thu ròng
          </span>
        </div>
        <RevenueReportChart groupBy={groupBy} series={series} />
      </section>

      <section aria-labelledby="service-breakdown-title" className={`panel ${styles.tablePanel}`}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>NGUỒN THU</p>
            <h2 id="service-breakdown-title">Cơ cấu doanh thu dịch vụ</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <caption className="sr-only">Doanh thu vé xe và gửi hàng trong kỳ</caption>
            <thead>
              <tr>
                <th scope="col">Nguồn thu</th>
                <th scope="col">Tiền đã thu</th>
                <th scope="col">Tiền hoàn</th>
                <th scope="col">Doanh thu ròng</th>
              </tr>
            </thead>
            <tbody>
              {serviceBreakdown.map((line) => (
                <tr key={line.kind}>
                  <th scope="row">{SERVICE_LABELS[line.kind]}</th>
                  <td>{formatRevenueVnd(line.grossReceipts)}</td>
                  <td>{formatRevenueVnd(line.refundAmount)}</td>
                  <td>{formatRevenueVnd(line.netRevenue)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <th scope="row">Tổng cộng</th>
                <td>{formatRevenueVnd(totals.grossReceipts)}</td>
                <td>{formatRevenueVnd(totals.refundAmount)}</td>
                <td>{formatRevenueVnd(totals.netRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="revenue-period-title" className={`panel ${styles.tablePanel}`}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.panelEyebrow}>CÙNG DỮ LIỆU VỚI BIỂU ĐỒ</p>
            <h2 id="revenue-period-title">Báo cáo theo thời gian</h2>
          </div>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <caption className="sr-only">Doanh thu theo từng {groupByLabel(groupBy)}</caption>
            <thead>
              <tr>
                <th scope="col">Kỳ</th>
                <th scope="col">Vé ròng</th>
                <th scope="col">Gửi hàng ròng</th>
                <th scope="col">Thu trước hoàn</th>
                <th scope="col">Hoàn tiền</th>
                <th scope="col">Ròng</th>
                <th scope="col">Thanh toán thành công</th>
              </tr>
            </thead>
            <tbody>
              {noData ? (
                <tr><td colSpan={7} className={styles.emptyTableCell}>
                  <strong>Chưa có giao dịch trong kỳ báo cáo</strong>
                  <span>Thử chọn khoảng ngày khác để xem doanh thu đã ghi nhận.</span>
                </td></tr>
              ) : series.map((item) => (
                <tr key={item.period}>
                  <th scope="row">{formatPeriod(item.period, groupBy)}</th>
                  <td>{formatRevenueVnd(item.netTicketRevenue)}</td>
                  <td>{formatRevenueVnd(item.netShipmentRevenue)}</td>
                  <td>{formatRevenueVnd(item.grossReceipts)}</td>
                  <td>{formatRevenueVnd(item.refundAmount)}</td>
                  <td>{formatRevenueVnd(item.netRevenue)}</td>
                  <td>{item.successfulPayments.toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
