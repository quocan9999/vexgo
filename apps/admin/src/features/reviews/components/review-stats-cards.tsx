'use client';

import { AlertTriangle, MessageSquareQuote, Star, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { AdminReviewStats } from '../types/review';

function MetricItem({
  label,
  value,
  icon,
  children,
  highlight = 'default',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  children?: ReactNode;
  highlight?: 'default' | 'success' | 'warning' | 'primary';
}) {
  const getIconColor = () => {
    switch (highlight) {
      case 'success':
        return 'text-[var(--admin-status-success)]';
      case 'warning':
        return 'text-[var(--admin-status-warning)]';
      case 'primary':
        return 'text-primary';
      default:
        return 'text-amber-500';
    }
  };

  const getValueColor = () => {
    switch (highlight) {
      case 'success':
        return 'text-[var(--admin-status-success)]';
      case 'warning':
        return 'text-[var(--admin-status-warning)]';
      case 'primary':
        return 'text-primary';
      default:
        return 'text-foreground';
    }
  };

  return (
    <div className="space-y-3 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <span aria-hidden className={getIconColor()}>
          {icon}
        </span>
        <h2>{label}</h2>
      </div>
      <p
        className={`text-[28px] sm:text-[32px] font-bold leading-tight tabular-nums ${getValueColor()}`}
      >
        {value}
      </p>
      {children && (
        <div className="text-xs text-muted-foreground">{children}</div>
      )}
    </div>
  );
}

export function ReviewStatsCards({ stats }: { stats: AdminReviewStats | null }) {
  if (!stats) return null;

  return (
    <Card className="grid grid-cols-1 divide-y border sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
      <MetricItem
        highlight="default"
        icon={<Star className="fill-amber-400 text-amber-500" size={18} />}
        label="Điểm trung bình (CSAT)"
        value={`${stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0.0'} / 5.0`}
      >
        <span>
          {stats.ratingDistribution[5] ?? 0} lượt 5 sao ·{' '}
          {stats.ratingDistribution[4] ?? 0} lượt 4 sao
        </span>
      </MetricItem>

      <MetricItem
        highlight="primary"
        icon={<MessageSquareQuote size={18} />}
        label="Tổng lượt đánh giá"
        value={stats.totalReviews.toLocaleString('vi-VN')}
      >
        <span>
          {stats.visibleCount} công khai · {stats.hiddenCount} đã ẩn
        </span>
      </MetricItem>

      <MetricItem
        highlight="success"
        icon={<ThumbsUp size={18} />}
        label="Tỷ lệ hài lòng"
        value={`${stats.satisfactionRate}%`}
      >
        <span>Đánh giá tốt từ 4–5 sao</span>
      </MetricItem>

      <MetricItem
        highlight={stats.negativeCount > 0 ? 'warning' : 'default'}
        icon={<AlertTriangle size={18} />}
        label="Cần chú ý / Đã ẩn"
        value={`${stats.negativeCount} tiêu cực`}
      >
        <span>{stats.hiddenCount} đánh giá bị ẩn khỏi khách hàng</span>
      </MetricItem>
    </Card>
  );
}
