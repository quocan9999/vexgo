'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import type {
  RevenueReportGroupBy,
  RevenueReportSeriesItem,
} from '../types/revenue-report';
import {
  formatCompactRevenueVnd,
  formatPeriod,
  formatRevenueVnd,
} from '../format';
import styles from './revenue-reports.module.css';

type RevenueReportChartProps = {
  groupBy: RevenueReportGroupBy;
  series: RevenueReportSeriesItem[];
};

type ChartPoint = {
  item: RevenueReportSeriesItem;
  x: number;
  y: number;
};

function scaledRatio(value: bigint, minimum: bigint, maximum: bigint): number {
  return Number(((value - minimum) * BigInt(1_000_000)) / (maximum - minimum)) /
    1_000_000;
}

function getTickValues(minimum: bigint, maximum: bigint): bigint[] {
  const span = maximum - minimum;
  const ticks = [0, 1, 2, 3, 4].reduce<bigint[]>((result, step) => {
    const value = minimum + (span * BigInt(step)) / BigInt(4);
    if (!result.some((tick) => tick === value)) result.push(value);
    return result;
  }, []);
  if (
    minimum <= BigInt(0) &&
    maximum >= BigInt(0) &&
    !ticks.includes(BigInt(0))
  ) {
    ticks.push(BigInt(0));
  }
  return ticks.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function getPeriodLabelIndices(length: number): number[] {
  if (length <= 3) return Array.from({ length }, (_, index) => index);
  const indices = [0, Math.floor((length - 1) / 2), length - 1];
  return [...new Set(indices)];
}

function plotY(value: bigint, minimum: bigint, maximum: bigint): number {
  return 5 + (1 - scaledRatio(value, minimum, maximum)) * 90;
}

export function RevenueReportChart({
  groupBy,
  series,
}: RevenueReportChartProps) {
  const pointRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activePointIndex, setActivePointIndex] = useState(0);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [focusedPointIndex, setFocusedPointIndex] = useState<number | null>(null);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const tooltipId = useId();

  const amounts = series.map(({ netRevenue }) => BigInt(netRevenue));
  let minimum = amounts.reduce(
    (current, value) => (value < current ? value : current),
    BigInt(0),
  );
  let maximum = amounts.reduce(
    (current, value) => (value > current ? value : current),
    BigInt(0),
  );
  if (minimum === maximum) {
    minimum = BigInt(0);
    maximum = BigInt(1_000_000);
  }

  const ticks = getTickValues(minimum, maximum);
  const points: ChartPoint[] = series.map((item, index) => ({
    item,
    x: series.length === 1 ? 50 : 4 + (index / (series.length - 1)) * 92,
    y: plotY(amounts[index], minimum, maximum),
  }));
  const polyline = points.length === 0
    ? '4,95 96,95'
    : points.length === 1
    ? `4,${points[0].y} 96,${points[0].y}`
    : points
    .map(({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`)
    .join(' ');
  const periodLabels = getPeriodLabelIndices(series.length);
  const focusablePointIndex = Math.min(activePointIndex, points.length - 1);

  const tooltipIndex = hoveredPointIndex ?? focusedPointIndex;
  const tooltipPoint = !tooltipDismissed && tooltipIndex !== null ? points[tooltipIndex] : undefined;

  function focusPoint(index: number) {
    const nextIndex = Math.max(0, Math.min(points.length - 1, index));
    setActivePointIndex(nextIndex);
    pointRefs.current[nextIndex]?.focus();
  }

  function handlePointKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === 'Escape') {
      setTooltipDismissed(true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusPoint(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusPoint(index + 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusPoint(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusPoint(points.length - 1);
    }
  }

  return (
    <div className={styles.chartFrame}>
      <div aria-hidden="true" className={styles.chartYAxis}>
        {ticks.map((tick) => {
          const top = plotY(tick, minimum, maximum);
          return (
            <span
              className={styles.chartTick}
              key={tick.toString()}
              style={{ top: `${top}%` }}
            >
              {formatCompactRevenueVnd(tick)}
            </span>
          );
        })}
      </div>
      <div className={styles.chartPlot} onPointerLeave={() => setHoveredPointIndex(null)}>
        {ticks.map((tick) => {
          const top = plotY(tick, minimum, maximum);
          return (
            <span
              aria-hidden="true"
              className={`${styles.chartGridLine}${tick === BigInt(0) ? ` ${styles.chartZeroLine}` : ''}`}
              key={tick.toString()}
              style={{ top: `${top}%` }}
            />
          );
        })}
        <svg
          aria-hidden="true"
          className={styles.chartLine}
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          <polyline points={polyline} />
        </svg>
        {points.map(({ item, x, y }, index) => {
          const tooltip = `${formatPeriod(item.period, groupBy)}: ${formatRevenueVnd(item.netRevenue)}`;
          return (
            <button
              aria-label={tooltip}
              aria-describedby={tooltipPoint?.item.period === item.period ? tooltipId : undefined}
              className={styles.chartPoint}
              key={item.period}
              onFocus={() => {
                setActivePointIndex(index);
                setFocusedPointIndex(index);
                setTooltipDismissed(false);
              }}
              onBlur={() => setFocusedPointIndex(null)}
              onKeyDown={(event) => handlePointKeyDown(event, index)}
              onPointerEnter={() => {
                setHoveredPointIndex(index);
                setTooltipDismissed(false);
              }}
              ref={(element) => {
                pointRefs.current[index] = element;
              }}
              type="button"
              style={{ left: `${x}%`, top: `${y}%` }}
              tabIndex={focusablePointIndex === index ? 0 : -1}
            />
          );
        })}
        {tooltipPoint && (
          <div
            className={styles.chartTooltip}
            id={tooltipId}
            role="tooltip"
            style={{
              left: `clamp(0px, ${tooltipPoint.x}%, max(0px, calc(100% - 260px)))`,
              ...(tooltipPoint.y >= 50
                ? { bottom: `${100 - tooltipPoint.y}%`, transform: 'translateY(-16px)' }
                : { top: `${tooltipPoint.y}%`, transform: 'translateY(16px)' }),
            }}
          >
            <strong>{groupBy === 'day' ? 'Ngày ' : groupBy === 'month' ? 'Tháng ' : ''}{formatPeriod(tooltipPoint.item.period, groupBy)}</strong>
            <dl>
              <div><dt>Doanh thu ròng</dt><dd>{formatRevenueVnd(tooltipPoint.item.netRevenue)}</dd></div>
              <div><dt>Tiền đã thu</dt><dd>{formatRevenueVnd(tooltipPoint.item.grossReceipts)}</dd></div>
              <div><dt>Tiền hoàn</dt><dd>{formatRevenueVnd(tooltipPoint.item.refundAmount)}</dd></div>
            </dl>
          </div>
        )}
      </div>
      <div aria-hidden="true" className={styles.chartXAxis}>
        {periodLabels.map((index) => (
          <span
            className={styles.chartPeriodTick}
            data-single={series.length === 1}
            data-edge={
              series.length === 1
                ? 'center'
                : index === 0
                  ? 'start'
                  : index === series.length - 1
                    ? 'end'
                    : 'center'
            }
            key={series[index].period}
            style={{ left: `${points[index].x}%` }}
          >
            {formatPeriod(series[index].period, groupBy)}
          </span>
        ))}
      </div>
      <p className="sr-only">
        Biểu đồ doanh thu ròng theo {groupBy === 'day' ? 'ngày' : groupBy === 'month' ? 'tháng' : 'quý'}. Dùng phím mũi tên trái và phải để xem từng kỳ; phím Home và End để đến kỳ đầu hoặc cuối. Bảng báo cáo bên dưới có đầy đủ dữ liệu.
      </p>
    </div>
  );
}
