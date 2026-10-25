'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceConfirmation,
  ResourcePagination,
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceStatusBadge,
  ResourceTableSkeleton,
  ResourceState,
} from '@/components/admin/resource-ui';
import { DateRangeFilter } from '@/components/data-filters/data-filters';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
  type FilterOption,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/features/admin-auth/hooks/use-admin-permissions';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  PromotionApiError,
  updatePromotionStatus,
} from '../services/promotion-service';
import type {
  Promotion,
  PromotionEffectiveState,
  PromotionSortKey,
  PromotionStatus,
} from '../types/promotion';
import { usePromotions } from '../hooks/use-promotions';
import { PromotionFormDialog } from './promotion-form-dialog';

const STATUS_OPTIONS: FilterOption[] = [
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
];
const EFFECTIVE_LABELS: Record<PromotionEffectiveState, string> = {
  UPCOMING: 'Chưa bắt đầu',
  ACTIVE: 'Đang hiệu lực',
  SUSPENDED: 'Tạm ngưng',
  EXPIRED: 'Hết hạn',
  EXHAUSTED: 'Hết lượt',
  UNAVAILABLE: 'Hết hiệu lực',
};

type StatusRequest = { promotion: Promotion; status: PromotionStatus };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(`${value}T00:00:00.000Z`))
    .replaceAll('/', '-');
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
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function canReactivate(promotion: Promotion): boolean {
  return (
    promotion.status === 'TAM_NGUNG' &&
    promotion.effectiveState !== 'UNAVAILABLE' &&
    promotion.endsOn >= hcmBusinessDate() &&
    promotion.remainingUses > 0
  );
}

export function PromotionsManagement() {
  const { can } = useAdminPermissions();
  const canCreate = can('promotion:create');
  const canUpdate = can('promotion:update');
  const {
    promotionPage,
    error,
    loading,
    searchInput,
    status,
    dateRange,
    updateDateRange,
    sortBy,
    sortDirection,
    changePage,
    updateSearch,
    updateStatus,
    sortPromotions,
    resetFilters,
    refresh,
  } = usePromotions();
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(
    null,
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusRequest, setStatusRequest] = useState<StatusRequest | null>(
    null,
  );
  const [statusUpdating, setStatusUpdating] = useState(false);
  const statusUpdatingRef = useRef(false);

  const items = promotionPage?.data ?? [];
  const hasFilters = Boolean(searchInput.trim() || status || dateRange);

  function handleCreated(promotion: Promotion) {
    setCreateDialogOpen(false);
    toast.success(`Đã tạo khuyến mãi ${promotion.code}.`);
    refresh();
  }

  function handleUpdated(promotion: Promotion) {
    setEditingPromotion(null);
    toast.success(`Đã cập nhật khuyến mãi ${promotion.code}.`);
    refresh();
  }

  function editAction(promotion: Promotion) {
    if (!canUpdate) return null;
    return (
      <Button
        aria-label={`Chỉnh sửa ${promotion.code}`}
        onClick={() => {
          setEditingPromotion(promotion);
        }}
        type="button"
        variant="ghost"
        size="sm"
      >
        <Pencil aria-hidden="true" size={14} />
        Chỉnh sửa
      </Button>
    );
  }

  function openCreate() {
    setCreateDialogOpen(true);
  }

  function openStatusRequest(
    promotion: Promotion,
    nextStatus: PromotionStatus,
  ) {
    if (nextStatus === 'HOAT_DONG' && !canReactivate(promotion)) return;
    setStatusRequest({ promotion, status: nextStatus });
  }

  async function confirmStatusUpdate() {
    if (!statusRequest || statusUpdatingRef.current) return;
    statusUpdatingRef.current = true;
    setStatusUpdating(true);
    try {
      const updated = await updatePromotionStatus(
        statusRequest.promotion.id,
        statusRequest.status,
      );
      setStatusRequest(null);
      toast.success(
        `Đã ${updated.status === 'HOAT_DONG' ? 'bật lại' : 'tạm ngưng'} khuyến mãi ${updated.code}.`,
      );
      refresh();
    } catch (requestError: unknown) {
      const message =
        requestError instanceof PromotionApiError
          ? requestError.code === 'PROMOTION_CONCURRENT_MODIFICATION'
            ? 'Khuyến mãi vừa thay đổi. Danh sách đã được làm mới, vui lòng kiểm tra lại.'
            : requestError.code === 'PROMOTION_UNAVAILABLE'
              ? 'Không thể đổi trạng thái khuyến mãi không khả dụng.'
              : requestError.message
          : 'Không thể cập nhật trạng thái khuyến mãi. Vui lòng thử lại.';
      setStatusRequest(null);
      toast.error(message);
      refresh();
    } finally {
      statusUpdatingRef.current = false;
      setStatusUpdating(false);
    }
  }

  function sortButton(label: string, field: PromotionSortKey) {
    const selected = sortBy === field;
    return (
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold"
        onClick={() => sortPromotions(field)}
        type="button"
      >
        {label}
        {selected ? (
          sortDirection === 'asc' ? (
            <ArrowUp aria-hidden="true" size={14} />
          ) : (
            <ArrowDown aria-hidden="true" size={14} />
          )
        ) : (
          <ArrowUpDown aria-hidden="true" size={14} />
        )}
      </button>
    );
  }

  function tableHeader(label: string, field?: PromotionSortKey) {
    const selected = field !== undefined && sortBy === field;
    return (
      <TableHead
        aria-sort={
          selected
            ? sortDirection === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        scope="col"
      >
        {field ? sortButton(label, field) : label}
      </TableHead>
    );
  }

  function statusBadge(promotion: Promotion) {
    return (
      <ResourceStatusBadge
        tone={promotion.status === 'HOAT_DONG' ? 'active' : 'muted'}
      >
        {promotion.status === 'HOAT_DONG' ? 'Hoạt động' : 'Tạm ngưng'}
      </ResourceStatusBadge>
    );
  }

  function effectiveBadge(promotion: Promotion) {
    return (
      <ResourceStatusBadge
        tone={promotion.effectiveState === 'ACTIVE' ? 'active' : 'muted'}
      >
        {EFFECTIVE_LABELS[promotion.effectiveState]}
      </ResourceStatusBadge>
    );
  }

  function statusAction(promotion: Promotion) {
    if (!canUpdate) return null;
    const nextStatus: PromotionStatus =
      promotion.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    const disabled = nextStatus === 'HOAT_DONG' && !canReactivate(promotion);
    return (
      <Button
        aria-label={`${nextStatus === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Bật lại'} ${promotion.code}`}

        disabled={disabled}
        onClick={() => openStatusRequest(promotion, nextStatus)}
        title={
          disabled
            ? 'Không thể bật lại khuyến mãi đã hết hạn, hết lượt hoặc không khả dụng.'
            : undefined
        }
        type="button"
        variant="outline"
        size="sm"
      >
        {nextStatus === 'TAM_NGUNG' ? 'Tạm ngưng' : 'Bật lại'}
      </Button>
    );
  }

  return (
    <SuperAdminLayout activeSection="promotions">
      <div className="admin-page-content admin-ui space-y-6">
        <AdminPageHeader
          actions={
            <div className="page-intro-actions">
              {canCreate && (
                <ResourceCreateAction
                  label="Thêm khuyến mãi"
                  onClick={openCreate}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow="ƯU ĐÃI NHÀ XE"
          title="Quản lý khuyến mãi"
          titleId="promotions-title"
        />
        <section
          aria-label="Danh sách khuyến mãi"
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <FilterToolbar>
            <SearchInput
              label="Tìm khuyến mãi"
              onChange={updateSearch}
              placeholder="Tìm theo mã hoặc tên chương trình"
              value={searchInput}
            />
            <SelectFilter
              allLabel="Tất cả trạng thái"
              label="Lọc theo trạng thái"
              onChange={updateStatus}
              options={STATUS_OPTIONS}
              value={status}
            />
            <DateRangeFilter
              appearance="resource"
              label="Thời hạn khuyến mãi"
              title="Thời hạn khuyến mãi"
              onApply={updateDateRange}
              value={dateRange}
            />
          </FilterToolbar>
          {loading && !promotionPage && (
            <ResourceTableSkeleton resourceLabel="khuyến mãi" />
          )}
          {error && (
            <ResourceState error>
              <p>{error}</p>
              <Button onClick={refresh} type="button" variant="outline">
                Thử lại
              </Button>
            </ResourceState>
          )}
          {!loading && !error && promotionPage && items.length === 0 && (
            <ResourceState>
              <p>
                {hasFilters
                  ? 'Không tìm thấy khuyến mãi phù hợp với bộ lọc.'
                  : 'Chưa có khuyến mãi nào.'}
              </p>
              {hasFilters && (
                <Button onClick={resetFilters} variant="outline">
                  Xóa bộ lọc
                </Button>
              )}
            </ResourceState>
          )}
          {promotionPage && items.length > 0 && (
            <>
              <div
                aria-busy={loading}
                className={`hidden lg:block ${loading ? 'opacity-60' : ''}`}
              >
                <Table aria-label="Danh sách khuyến mãi">
                  <TableHeader>
                    <TableRow>
                      {tableHeader('Mã', 'code')}
                      {tableHeader('Tên chương trình', 'name')}
                      {tableHeader('Mức giảm')}
                      {tableHeader('Thời hạn', 'endsOn')}
                      {tableHeader('Lượt dùng', 'usageCount')}
                      {tableHeader('Trạng thái', 'status')}
                      {tableHeader('Hiệu lực')}
                      {tableHeader('Thao tác')}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((promotion) => (
                      <TableRow key={promotion.id}>
                        <TableCell className="admin-data-mono font-semibold">
                          {promotion.code}
                        </TableCell>
                        <TableCell>
                          <span
                            className="block w-40 truncate"
                            title={promotion.name}
                          >
                            {promotion.name}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-28 max-w-40 whitespace-normal">
                          {formatDiscount(promotion)}
                        </TableCell>
                        <TableCell>
                          <span className="block">
                            {formatDate(promotion.startsOn)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            đến {formatDate(promotion.endsOn)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {promotion.usageCount.toLocaleString('vi-VN')} /{' '}
                          {promotion.usageLimit.toLocaleString('vi-VN')}
                        </TableCell>
                        <TableCell>{statusBadge(promotion)}</TableCell>
                        <TableCell>{effectiveBadge(promotion)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            {editAction(promotion)}
                            {statusAction(promotion)}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul
                aria-label="Danh sách khuyến mãi dạng thẻ"
                className="grid gap-4 p-4 lg:hidden"
              >
                {items.map((promotion) => (
                  <li key={promotion.id}>
                    <Card className="gap-4 p-4">
                      <div className="min-w-0 [&_h2]:break-words [&_h2]:text-base [&_h2]:font-semibold [&_span]:mt-2 [&_span]:block [&_span]:break-all [&_span]:text-xs [&_span]:text-muted-foreground">
                        <div>
                          <h2>{promotion.name}</h2>
                          <span className="admin-data-mono">
                            {promotion.code}
                          </span>
                        </div>
                      </div>
                      <dl className="grid gap-3 text-[13px] [&>div]:grid [&>div]:grid-cols-[100px_minmax(0,1fr)] [&>div]:gap-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:min-w-0 [&_dd]:break-words">
                        <div>
                          <dt>Mức giảm</dt>
                          <dd>{formatDiscount(promotion)}</dd>
                        </div>
                        <div>
                          <dt>Thời hạn</dt>
                          <dd>
                            {formatDate(promotion.startsOn)} –{' '}
                            {formatDate(promotion.endsOn)}
                          </dd>
                        </div>
                        <div>
                          <dt>Lượt dùng</dt>
                          <dd>
                            {promotion.usageCount.toLocaleString('vi-VN')} /{' '}
                            {promotion.usageLimit.toLocaleString('vi-VN')}
                          </dd>
                        </div>
                        <div>
                          <dt>Trạng thái</dt>
                          <dd>{statusBadge(promotion)}</dd>
                        </div>
                        <div>
                          <dt>Hiệu lực</dt>
                          <dd>{effectiveBadge(promotion)}</dd>
                        </div>
                      </dl>
                      <div className="flex flex-wrap items-center gap-2">
                        {editAction(promotion)}
                        {statusAction(promotion)}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <ResourcePagination
                currentPage={promotionPage.meta.page}
                disabled={loading}
                onPageChange={changePage}
                pageSize={promotionPage.meta.pageSize}
                summaryLabel="khuyến mãi"
                totalItems={promotionPage.meta.totalItems}
                totalPages={promotionPage.meta.totalPages}
              />
            </>
          )}
        </section>
      </div>
      {editingPromotion && canUpdate && (
        <PromotionFormDialog
          key={editingPromotion.id}
          promotion={editingPromotion}
          onClose={() => setEditingPromotion(null)}
          onSaved={handleUpdated}
        />
      )}
      {createDialogOpen && canCreate && (
        <PromotionFormDialog
          onClose={() => setCreateDialogOpen(false)}
          onSaved={handleCreated}
        />
      )}
      {statusRequest && (
        <ResourceConfirmation
          title={
            statusRequest.status === 'TAM_NGUNG'
              ? 'Tạm ngưng khuyến mãi?'
              : 'Bật lại khuyến mãi?'
          }
          description={
            statusRequest.status === 'TAM_NGUNG'
              ? `Khách hàng sẽ không thể sử dụng mã ${statusRequest.promotion.code} trong thời gian tạm ngưng.`
              : `Khách hàng có thể sử dụng lại mã ${statusRequest.promotion.code} theo điều kiện hiện tại.`
          }
          busy={statusUpdating}
          onClose={() => {
            if (!statusUpdating) setStatusRequest(null);
          }}
        >
          <Button
            disabled={statusUpdating}
            aria-busy={statusUpdating}
            onClick={() => void confirmStatusUpdate()}
            type="button"
          >
            {statusUpdating
              ? 'Đang cập nhật…'
              : statusRequest.status === 'TAM_NGUNG'
                ? 'Tạm ngưng'
                : 'Bật lại'}
          </Button>
        </ResourceConfirmation>
      )}
    </SuperAdminLayout>
  );
}
