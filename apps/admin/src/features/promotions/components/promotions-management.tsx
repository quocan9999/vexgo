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
import { useTranslations } from 'next-intl';
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

function formatDiscount(promotion: Promotion, tPromotions?: (key: any, options?: any) => string): string {
  if (promotion.discountType !== 'PHAN_TRAM') {
    return formatMoney(promotion.discountValue);
  }
  const maxSuffix = promotion.maxDiscount
    ? tPromotions
      ? ` ${tPromotions('maxDiscountUpTo', { amount: formatMoney(promotion.maxDiscount) })}`
      : ` (max ${formatMoney(promotion.maxDiscount)})`
    : '';
  return `${promotion.discountValue.replace(/\.00$/, '')}%${maxSuffix}`;
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
  const tPromotions = useTranslations('promotions');
  const tCommon = useTranslations('common');
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

  const statusOptions: FilterOption[] = [
    { value: 'HOAT_DONG', label: tPromotions('statusActive') },
    { value: 'TAM_NGUNG', label: tPromotions('statusSuspended') },
  ];

  function getEffectiveLabel(effectiveState: PromotionEffectiveState): string {
    switch (effectiveState) {
      case 'UPCOMING':
        return tPromotions('stateUpcoming');
      case 'ACTIVE':
        return tPromotions('stateActive');
      case 'SUSPENDED':
        return tPromotions('stateSuspended');
      case 'EXPIRED':
        return tPromotions('stateExpired');
      case 'EXHAUSTED':
        return tPromotions('stateExhausted');
      case 'UNAVAILABLE':
        return tPromotions('stateUnavailable');
    }
  }

  const items = promotionPage?.data ?? [];
  const hasFilters = Boolean(searchInput.trim() || status || dateRange);

  function handleCreated(promotion: Promotion) {
    setCreateDialogOpen(false);
    toast.success(tPromotions('toastCreated', { code: promotion.code }));
    refresh();
  }

  function handleUpdated(promotion: Promotion) {
    setEditingPromotion(null);
    toast.success(tPromotions('toastUpdated', { code: promotion.code }));
    refresh();
  }

  function editAction(promotion: Promotion) {
    if (!canUpdate) return null;
    return (
      <Button
        aria-label={`${tCommon('edit')} ${promotion.code}`}
        onClick={() => {
          setEditingPromotion(promotion);
        }}
        type="button"
        variant="ghost"
        size="sm"
      >
        <Pencil aria-hidden="true" size={14} />
        {tCommon('edit')}
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
        updated.status === 'HOAT_DONG'
          ? tPromotions('toastReactivated', { code: updated.code })
          : tPromotions('toastSuspended', { code: updated.code }),
      );
      refresh();
    } catch (requestError: unknown) {
      const message =
        requestError instanceof PromotionApiError
          ? requestError.code === 'PROMOTION_CONCURRENT_MODIFICATION'
            ? tPromotions('errors.concurrentChanged')
            : requestError.code === 'PROMOTION_UNAVAILABLE'
              ? tPromotions('errors.cannotChangeUnavailable')
              : requestError.message
          : tPromotions('errors.updateStatusFailed');
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
        aria-label={`${tCommon('sort')} ${label}`}
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
        {promotion.status === 'HOAT_DONG'
          ? tPromotions('statusActive')
          : tPromotions('statusSuspended')}
      </ResourceStatusBadge>
    );
  }

  function effectiveBadge(promotion: Promotion) {
    return (
      <ResourceStatusBadge
        tone={promotion.effectiveState === 'ACTIVE' ? 'active' : 'muted'}
      >
        {getEffectiveLabel(promotion.effectiveState)}
      </ResourceStatusBadge>
    );
  }

  function statusAction(promotion: Promotion) {
    if (!canUpdate) return null;
    const nextStatus: PromotionStatus =
      promotion.status === 'HOAT_DONG' ? 'TAM_NGUNG' : 'HOAT_DONG';
    const disabled = nextStatus === 'HOAT_DONG' && !canReactivate(promotion);
    const actionLabel =
      nextStatus === 'TAM_NGUNG'
        ? tPromotions('actionSuspend')
        : tPromotions('actionReactivate');
    return (
      <Button
        aria-label={`${actionLabel} ${promotion.code}`}
        disabled={disabled}
        onClick={() => openStatusRequest(promotion, nextStatus)}
        type="button"
        variant="outline"
        size="sm"
      >
        {actionLabel}
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
                  label={tPromotions('createPromotion')}
                  onClick={openCreate}
                />
              )}
              <ResourceRefreshAction loading={loading} onClick={refresh} />
            </div>
          }
          eyebrow={tPromotions('eyebrow')}
          title={tPromotions('promotionsTitle')}
          titleId="promotions-title"
        />
        <section
          aria-label={tPromotions('promotionsTitle')}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <FilterToolbar>
            <SearchInput
              label={tPromotions('searchPromotions')}
              onChange={updateSearch}
              placeholder={tPromotions('searchPlaceholder')}
              value={searchInput}
            />
            <SelectFilter
              allLabel={tPromotions('filterStatus')}
              label={tPromotions('promotionStatus')}
              onChange={updateStatus}
              options={statusOptions}
              value={status}
            />
            <DateRangeFilter
              appearance="resource"
              label={tPromotions('filterDateLabel')}
              title={tPromotions('filterDateLabel')}
              onApply={updateDateRange}
              value={dateRange}
            />
          </FilterToolbar>
          {loading && !promotionPage && (
            <ResourceTableSkeleton resourceLabel={tPromotions('resourceLabel')} />
          )}
          {error && (
            <ResourceState error>
              <p>{error}</p>
              <Button onClick={refresh} type="button" variant="outline">
                {tCommon('retry')}
              </Button>
            </ResourceState>
          )}
          {!loading && !error && promotionPage && items.length === 0 && (
            <ResourceState>
              <p>
                {hasFilters
                  ? tPromotions('emptyFiltered')
                  : tPromotions('emptyNoData')}
              </p>
              {hasFilters && (
                <Button onClick={resetFilters} variant="outline">
                  {tCommon('clearFilters')}
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
                <Table aria-label={tPromotions('promotionsTitle')}>
                  <TableHeader>
                    <TableRow>
                      {tableHeader(tPromotions('colCode'), 'code')}
                      {tableHeader(tPromotions('colName'), 'name')}
                      {tableHeader(tPromotions('colDiscount'))}
                      {tableHeader(tPromotions('colValidity'), 'endsOn')}
                      {tableHeader(tPromotions('colUsage'), 'usageCount')}
                      {tableHeader(tPromotions('colStatus'), 'status')}
                      {tableHeader(tPromotions('colEffective'))}
                      {tableHeader(tCommon('actions'))}
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
                          {formatDiscount(promotion, tPromotions)}
                        </TableCell>
                        <TableCell>
                          <span className="block">
                            {formatDate(promotion.startsOn)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            – {formatDate(promotion.endsOn)}
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
                aria-label={tPromotions('cardListAria')}
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
                          <dt>{tPromotions('colDiscount')}</dt>
                          <dd>{formatDiscount(promotion, tPromotions)}</dd>
                        </div>
                        <div>
                          <dt>{tPromotions('colValidity')}</dt>
                          <dd>
                            {formatDate(promotion.startsOn)} –{' '}
                            {formatDate(promotion.endsOn)}
                          </dd>
                        </div>
                        <div>
                          <dt>{tPromotions('colUsage')}</dt>
                          <dd>
                            {promotion.usageCount.toLocaleString('vi-VN')} /{' '}
                            {promotion.usageLimit.toLocaleString('vi-VN')}
                          </dd>
                        </div>
                        <div>
                          <dt>{tPromotions('colStatus')}</dt>
                          <dd>{statusBadge(promotion)}</dd>
                        </div>
                        <div>
                          <dt>{tPromotions('colEffective')}</dt>
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
                summaryLabel={tPromotions('resourceLabel')}
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
              ? tPromotions('confirmSuspendTitle')
              : tPromotions('confirmReactivateTitle')
          }
          description={
            statusRequest.status === 'TAM_NGUNG'
              ? tPromotions('confirmSuspendMessage', { code: statusRequest.promotion.code })
              : tPromotions('confirmReactivateMessage', { code: statusRequest.promotion.code })
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
              ? tCommon('saving')
              : statusRequest.status === 'TAM_NGUNG'
                ? tPromotions('actionSuspend')
                : tPromotions('actionReactivate')}
          </Button>
        </ResourceConfirmation>
      )}
    </SuperAdminLayout>
  );
}
