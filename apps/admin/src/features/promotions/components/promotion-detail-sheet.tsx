'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AdminDetailSheet } from '@/components/admin/admin-detail-sheet';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { Button } from '@/components/ui/button';
import { getPromotionById } from '../services/promotion-service';
import type { Promotion, PromotionEffectiveState, PromotionStatus } from '../types/promotion';
import styles from '../promotions.module.css';

type Props = {
  promotionId: number;
  refreshKey: number;
  canUpdate: boolean;
  onClose: () => void;
  onRequestStatus: (promotion: Promotion, status: PromotionStatus) => void;
};

const EFFECTIVE_LABELS: Record<PromotionEffectiveState, string> = {
  UPCOMING: 'Chưa bắt đầu',
  ACTIVE: 'Đang hiệu lực',
  SUSPENDED: 'Tạm ngưng',
  EXPIRED: 'Hết hạn',
  EXHAUSTED: 'Hết lượt',
  UNAVAILABLE: 'Không khả dụng',
};

function businessDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function canReactivate(promotion: Promotion): boolean {
  return promotion.status === 'TAM_NGUNG' &&
    promotion.effectiveState !== 'UNAVAILABLE' &&
    promotion.endsOn >= businessDate() &&
    promotion.remainingUses > 0;
}

function formatMoney(value: string | null): string {
  if (value === null) return 'Không áp dụng';
  const [whole = '0', fraction = ''] = value.split('.');
  const amount = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = fraction.replace(/0+$/, '');
  return `${amount}${cents ? `,${cents}` : ''} ₫`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDiscount(promotion: Promotion): string {
  return promotion.discountType === 'PHAN_TRAM'
    ? `${promotion.discountValue.replace(/\.00$/, '')}%`
    : formatMoney(promotion.discountValue);
}

export function PromotionDetailSheet({ promotionId, refreshKey, canUpdate, onClose, onRequestStatus }: Props) {
  const [result, setResult] = useState<{ key: string; promotion: Promotion } | null>(null);
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${promotionId}:${refreshKey}:${retry}`;
  const promotion = result?.key === requestKey ? result.promotion : null;
  const error = requestError?.key === requestKey ? requestError.message : null;
  const loading = promotion === null && error === null;

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    getPromotionById(promotionId, controller.signal)
      .then((data) => { if (current) setResult({ key: requestKey, promotion: data }); })
      .catch((requestError: unknown) => {
        if (current && !controller.signal.aborted) {
          setRequestError({
            key: requestKey,
            message: requestError instanceof Error ? requestError.message : 'Không thể tải chi tiết khuyến mãi.',
          });
        }
      });
    return () => { current = false; controller.abort(); };
  }, [promotionId, refreshKey, requestKey]);

  const statusLabel = promotion?.status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng';
  const statusText = promotion?.status === 'HOAT_DONG' ? 'Tạm ngưng' : 'Bật lại';
  const nextStatus: PromotionStatus | null = promotion
    ? promotion.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG'
    : null;
  const reactivationBlocked = Boolean(promotion && promotion.status === 'TAM_NGUNG' && !canReactivate(promotion));

  return (
    <AdminDetailSheet ariaLabelledBy="promotion-detail-title" onClose={onClose}>
      <header className="admin-dialog-header">
        <div className="admin-dialog-header__copy">
          <h2 id="promotion-detail-title">Chi tiết khuyến mãi</h2>
        </div>
        <form method="dialog"><Button aria-label="Đóng chi tiết khuyến mãi" className="icon-button" type="submit" variant="secondary"><X aria-hidden="true" size={19} /></Button></form>
      </header>
      {loading && <p className={styles.detailState} role="status">Đang tải chi tiết khuyến mãi…</p>}
      {!loading && error && <div className={styles.detailError} role="alert"><p>{error}</p><Button onClick={() => setRetry((count) => count + 1)} type="button" variant="secondary">Thử tải lại</Button></div>}
      {!loading && !error && promotion && (
        <>
          <p className={styles.detailDescription}>{promotion.name}</p>
          <dl className={styles.detailList}>
            <div className={styles.detailItem}><dt>Mã khuyến mãi</dt><dd className="admin-data-mono">{promotion.code}</dd></div>
            <div className={styles.detailItem}><dt>Mức giảm</dt><dd>{formatDiscount(promotion)}</dd></div>
            <div className={styles.detailItem}><dt>Giảm tối đa</dt><dd>{formatMoney(promotion.maxDiscount)}</dd></div>
            <div className={styles.detailItem}><dt>Giá vé tối thiểu</dt><dd>{formatMoney(promotion.minimumTicketAmount)}</dd></div>
            <div className={styles.detailItem}><dt>Thời hạn</dt><dd>{formatDate(promotion.startsOn)} – {formatDate(promotion.endsOn)}</dd></div>
            <div className={styles.detailItem}><dt>Số lượt đã dùng</dt><dd>{promotion.usageCount.toLocaleString('vi-VN')} / {promotion.usageLimit.toLocaleString('vi-VN')}</dd></div>
            <div className={styles.detailItem}><dt>Trạng thái quản trị</dt><dd><AdminStatusBadge tone={promotion.status === 'HOAT_DONG' ? 'active' : 'muted'}>{statusLabel}</AdminStatusBadge></dd></div>
            <div className={styles.detailItem}><dt>Hiệu lực hiện tại</dt><dd><AdminStatusBadge tone={promotion.effectiveState === 'ACTIVE' ? 'active' : 'muted'}>{EFFECTIVE_LABELS[promotion.effectiveState]}</AdminStatusBadge></dd></div>
          </dl>
          {canUpdate && nextStatus && <div className={styles.detailActions}>
            <Button
              disabled={reactivationBlocked}
              onClick={() => onRequestStatus(promotion, nextStatus)}
              title={reactivationBlocked ? 'Không thể bật lại khuyến mãi đã hết hạn, hết lượt hoặc không khả dụng.' : undefined}
              type="button"
              variant="secondary"
            >{statusText}</Button>
            {reactivationBlocked && <p className={styles.fieldHint}>Không thể bật lại khuyến mãi đã hết hạn, hết lượt hoặc không khả dụng.</p>}
          </div>}
        </>
      )}
    </AdminDetailSheet>
  );
}
