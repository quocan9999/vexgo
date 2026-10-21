'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Pencil, Search } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { AdminCreateAction, AdminRefreshAction } from '@/components/admin/admin-page-actions';
import { AdminStatusBadge } from '@/components/admin/admin-status-badge';
import { AdminTableSkeleton } from '@/components/admin/admin-table-skeleton';
import { DateRangeFilter, FilterToolbar, SearchInput, SelectFilter, type FilterOption } from '@/components/data-filters/data-filters';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { PromotionApiError, updatePromotionStatus } from '../services/promotion-service';
import type { Promotion, PromotionEffectiveState, PromotionSortKey, PromotionStatus } from '../types/promotion';
import { usePromotions } from '../hooks/use-promotions';
import { PromotionFormDialog } from './promotion-form-dialog';
import styles from '../promotions.module.css';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];
const EFFECTIVE_LABELS: Record<PromotionEffectiveState, string> = {
  UPCOMING: 'Chưa bắt đầu', ACTIVE: 'Đang hiệu lực', SUSPENDED: 'Tạm ngưng',
  EXPIRED: 'Hết hạn', EXHAUSTED: 'Hết lượt', UNAVAILABLE: 'Hết hiệu lực',
};
type Notice = { tone: 'success' | 'error'; message: string };
type StatusRequest = { promotion: Promotion; status: PromotionStatus };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatMoney(value: string): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const amount = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = fraction.replace(/0+$/, '');
  return `${amount}${cents ? `,${cents}` : ''} ₫`;
}

function formatDiscount(promotion: Promotion): string {
  return promotion.discountType === 'PHAN_TRAM'
    ? `${promotion.discountValue.replace(/\.00$/, '')}%${promotion.maxDiscount ? ` (tối đa ${formatMoney(promotion.maxDiscount)})` : ''}`
    : formatMoney(promotion.discountValue);
}

function hcmBusinessDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function canReactivate(promotion: Promotion): boolean {
  return promotion.status === 'TAM_NGUNG' &&
    promotion.effectiveState !== 'UNAVAILABLE' &&
    promotion.endsOn >= hcmBusinessDate() &&
    promotion.remainingUses > 0;
}

export function PromotionsManagement() {
  const { can } = useAdminPermissions();
  const canCreate = can('promotion:create');
  const canUpdate = can('promotion:update');
  const {
    promotionPage, error, loading, searchInput, status, dateRange, updateDateRange, sortBy, sortDirection,
    changePage, updateSearch, updateStatus, sortPromotions, resetFilters, refresh,
  } = usePromotions();
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusRequest, setStatusRequest] = useState<StatusRequest | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const statusUpdatingRef = useRef(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const items = promotionPage?.data ?? [];
  const hasFilters = Boolean(searchInput.trim() || status || dateRange);

  function handleCreated(promotion: Promotion) {
    setCreateDialogOpen(false);
    setNotice({ tone: 'success', message: `Đã tạo khuyến mãi ${promotion.code}.` });
    refresh();
  }

  function handleUpdated(promotion: Promotion) {
    setEditingPromotion(null);
    setNotice({ tone: 'success', message: `Đã cập nhật khuyến mãi ${promotion.code}.` });
    refresh();
  }

  function editAction(promotion: Promotion) {
    if (!canUpdate) return null;
    return <Button
      aria-label={`Chỉnh sửa ${promotion.code}`}
      onClick={() => { setNotice(null); setEditingPromotion(promotion); }}
      type="button"
      variant="secondary"
    ><Pencil aria-hidden="true" size={14} />Chỉnh sửa</Button>;
  }

  function openCreate() {
    setNotice(null);
    setCreateDialogOpen(true);
  }

  function openStatusRequest(promotion: Promotion, nextStatus: PromotionStatus) {
    if (nextStatus === 'HOAT_DONG' && !canReactivate(promotion)) return;
    setStatusRequest({ promotion, status: nextStatus });
  }

  async function confirmStatusUpdate() {
    if (!statusRequest || statusUpdatingRef.current) return;
    statusUpdatingRef.current = true;
    setStatusUpdating(true);
    try {
      const updated = await updatePromotionStatus(statusRequest.promotion.id, statusRequest.status);
      setStatusRequest(null);
      setNotice({ tone: 'success', message: `Đã ${updated.status === 'HOAT_DONG' ? 'bật lại' : 'tạm ngưng'} khuyến mãi ${updated.code}.` });
      refresh();
    } catch (requestError: unknown) {
      const message = requestError instanceof PromotionApiError
        ? requestError.code === 'PROMOTION_CONCURRENT_MODIFICATION'
          ? 'Khuyến mãi vừa thay đổi. Danh sách đã được làm mới, vui lòng kiểm tra lại.'
          : requestError.code === 'PROMOTION_UNAVAILABLE'
            ? 'Không thể đổi trạng thái khuyến mãi không khả dụng.'
            : requestError.message
        : 'Không thể cập nhật trạng thái khuyến mãi. Vui lòng thử lại.';
      setStatusRequest(null);
      setNotice({ tone: 'error', message });
      refresh();
    } finally {
      statusUpdatingRef.current = false;
      setStatusUpdating(false);
    }
  }

  function sortButton(label: string, field: PromotionSortKey) {
    const selected = sortBy === field;
    return <button aria-label={`Sắp xếp theo ${label}`} className="admin-resource-sort-button" onClick={() => sortPromotions(field)} type="button">
      {label}{selected ? sortDirection === 'asc' ? <ArrowUp aria-hidden="true" size={14} /> : <ArrowDown aria-hidden="true" size={14} /> : <ArrowUpDown aria-hidden="true" size={14} />}
    </button>;
  }

  function tableHeader(label: string, field?: PromotionSortKey) {
    const selected = field !== undefined && sortBy === field;
    return <th aria-sort={selected ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} scope="col">{field ? sortButton(label, field) : label}</th>;
  }

  function statusBadge(promotion: Promotion) {
    return <AdminStatusBadge tone={promotion.status === 'HOAT_DONG' ? 'active' : 'muted'}>{promotion.status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng'}</AdminStatusBadge>;
  }

  function effectiveBadge(promotion: Promotion) {
    return <AdminStatusBadge tone={promotion.effectiveState === 'ACTIVE' ? 'active' : 'muted'}>{EFFECTIVE_LABELS[promotion.effectiveState]}</AdminStatusBadge>;
  }

  function statusAction(promotion: Promotion) {
    if (!canUpdate) return null;
    const nextStatus: PromotionStatus = promotion.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    const disabled = nextStatus === 'HOAT_DONG' && !canReactivate(promotion);
    return <Button
      aria-label={`${nextStatus === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Bật lại'} ${promotion.code}`}
      className="admin-resource-status-action"
      disabled={disabled}
      onClick={() => openStatusRequest(promotion, nextStatus)}
      title={disabled ? 'Không thể bật lại khuyến mãi đã hết hạn, hết lượt hoặc không khả dụng.' : undefined}
      type="button"
      variant="secondary"
    >{nextStatus === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Bật lại'}</Button>;
  }

  return (
    <SuperAdminLayout activeSection="promotions">
      <div className="admin-page-content">
        <AdminPageHeader
          actions={<div className="page-intro-actions">
            {canCreate && <AdminCreateAction label="Thêm khuyến mãi" onClick={openCreate} />}
            <AdminRefreshAction loading={loading} onClick={refresh} />
          </div>}
          eyebrow="ƯU ĐÃI NHÀ XE"
          title="Quản lý khuyến mãi"
          titleId="promotions-title"
        />
        <p className={styles.description}>Tạo và theo dõi mã giảm giá dành cho khách đặt vé của nhà xe.</p>
        {notice && <p className={notice.tone === 'success' ? styles.successNotice : styles.errorNotice} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.tone === 'success' && <CheckCircle2 aria-hidden="true" size={17} />}{notice.message}</p>}
        <section aria-label="Danh sách khuyến mãi" className="admin-resource-panel">
          <FilterToolbar totalItems={promotionPage?.meta.totalItems ?? null}>
            <SearchInput label="Tìm khuyến mãi" onChange={updateSearch} placeholder="Tìm theo mã hoặc tên chương trình" value={searchInput} />
            <SelectFilter allLabel="Tất cả trạng thái" label="Lọc theo trạng thái" onChange={updateStatus} options={STATUS_OPTIONS} value={status} />
            <DateRangeFilter label="Thời hạn khuyến mãi" title="Thời hạn khuyến mãi" onApply={updateDateRange} value={dateRange} />
          </FilterToolbar>
          {loading && !promotionPage && <AdminTableSkeleton resourceLabel="khuyến mãi" />}
          {error && <div className={styles.listError} role="alert"><p>{error}</p><Button onClick={refresh} type="button" variant="secondary">Thử lại</Button></div>}
          {!loading && !error && promotionPage && items.length === 0 && <div className={styles.emptyState}>
            <span className={styles.emptyIcon}><Search aria-hidden="true" size={21} /></span>
            <h2>{hasFilters ? 'Không tìm thấy khuyến mãi phù hợp với bộ lọc.' : 'Chưa có khuyến mãi nào.'}</h2>
            {hasFilters && <Button onClick={resetFilters} type="button" variant="secondary">Xóa bộ lọc</Button>}
          </div>}
          {promotionPage && items.length > 0 && <>
            <div aria-busy={loading} className={`admin-resource-table-wrap${loading ? ' is-loading' : ''}`}>
              <table className="admin-resource-table">
                <thead><tr>
                  {tableHeader('Mã', 'code')}{tableHeader('Tên chương trình', 'name')}
                  {tableHeader('Mức giảm')}{tableHeader('Thời hạn', 'endsOn')}
                  {tableHeader('Lượt dùng', 'usageCount')}{tableHeader('Trạng thái', 'status')}
                  {tableHeader('Hiệu lực')}{tableHeader('Thao tác')}
                </tr></thead>
                <tbody>{items.map((promotion) => <tr key={promotion.id}>
                  <th className="admin-data-mono" scope="row">{promotion.code}</th>
                  <td><span className={styles.programName} title={promotion.name}>{promotion.name}</span></td>
                  <td>{formatDiscount(promotion)}</td>
                  <td>{formatDate(promotion.startsOn)} – {formatDate(promotion.endsOn)}</td>
                  <td>{promotion.usageCount.toLocaleString('vi-VN')} / {promotion.usageLimit.toLocaleString('vi-VN')}</td>
                  <td>{statusBadge(promotion)}</td>
                  <td>{effectiveBadge(promotion)}</td>
                  <td><div className={styles.rowActions}>
                    {editAction(promotion)}
                    {statusAction(promotion)}
                  </div></td>
                </tr>)}</tbody>
              </table>
            </div>
            <ul aria-label="Danh sách khuyến mãi dạng thẻ" className={styles.mobileCards}>
              {items.map((promotion) => <li className={styles.mobileCard} key={promotion.id}>
                <div className={styles.mobileCardHeader}><div><h2>{promotion.name}</h2><span className="admin-data-mono">{promotion.code}</span></div></div>
                <dl className={styles.mobileCardDetails}>
                  <div><dt>Mức giảm</dt><dd>{formatDiscount(promotion)}</dd></div>
                  <div><dt>Thời hạn</dt><dd>{formatDate(promotion.startsOn)} – {formatDate(promotion.endsOn)}</dd></div>
                  <div><dt>Lượt dùng</dt><dd>{promotion.usageCount.toLocaleString('vi-VN')} / {promotion.usageLimit.toLocaleString('vi-VN')}</dd></div>
                  <div><dt>Trạng thái</dt><dd>{statusBadge(promotion)}</dd></div>
                  <div><dt>Hiệu lực</dt><dd>{effectiveBadge(promotion)}</dd></div>
                </dl>
                <div className={styles.rowActions}>{editAction(promotion)}{statusAction(promotion)}</div>
              </li>)}
            </ul>
            <AdminPagination currentPage={promotionPage.meta.page} disabled={loading} onPageChange={changePage} pageSize={promotionPage.meta.pageSize} summaryLabel="khuyến mãi" totalItems={promotionPage.meta.totalItems} totalPages={promotionPage.meta.totalPages} />
          </>}
        </section>
      </div>
      {editingPromotion && canUpdate && <PromotionFormDialog
        key={editingPromotion.id}
        promotion={editingPromotion}
        onClose={() => setEditingPromotion(null)}
        onSaved={handleUpdated}
      />}
      {createDialogOpen && canCreate && <PromotionFormDialog onClose={() => setCreateDialogOpen(false)} onSaved={handleCreated} />}
      {statusRequest && <AdminConfirmDialog
        ariaLabelledBy="promotion-status-confirm-title"
        onClose={() => { if (!statusUpdating) setStatusRequest(null); }}
        preventDismiss={statusUpdating}
      >
        <div className="admin-confirm-dialog__content">
          <h2 id="promotion-status-confirm-title">{statusRequest.status === 'TAM_NGUNG' ? 'Tạm ngưng khuyến mãi?' : 'Bật lại khuyến mãi?'}</h2>
          <p>{statusRequest.status === 'TAM_NGUNG'
            ? `Khách hàng sẽ không thể sử dụng mã ${statusRequest.promotion.code} trong thời gian tạm ngưng.`
            : `Khách hàng có thể sử dụng lại mã ${statusRequest.promotion.code} theo điều kiện hiện tại.`}</p>
          <div className="admin-confirm-dialog__actions">
            <Button disabled={statusUpdating} onClick={() => setStatusRequest(null)} type="button" variant="secondary">Hủy</Button>
            <Button disabled={statusUpdating} onClick={() => void confirmStatusUpdate()} type="button">{statusUpdating ? 'Đang cập nhật…' : statusRequest.status === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Bật lại'}</Button>
          </div>
        </div>
      </AdminConfirmDialog>}
    </SuperAdminLayout>
  );
}
