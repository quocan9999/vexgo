'use client';

import { Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TicketItem } from '@/features/account/services/tickets.api';

const STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  MOI_TAO: { vi: 'Mới tạo', en: 'New' },
  DA_TIEP_NHAN: { vi: 'Đã tiếp nhận', en: 'Accepted' },
  DANG_VAN_CHUYEN: { vi: 'Đang vận chuyển', en: 'In transit' },
  DA_GIAO: { vi: 'Đã giao', en: 'Delivered' },
  DA_HUY: { vi: 'Đã hủy', en: 'Cancelled' },
};

export function BookingCargoCancellation({
  ticket,
  locale,
  selectedIds,
  onSelectionChange,
  willCancelAllTickets,
}: {
  ticket: TicketItem;
  locale: string;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  willCancelAllTickets: boolean;
}) {
  const t = useTranslations('tickets');
  const items = ticket.cargoItems ?? [];
  const isCancelled = ticket.cargoStatus === 'DA_HUY';
  const canSelectItems =
    ticket.cargoStatus === 'MOI_TAO' &&
    !willCancelAllTickets &&
    items.every((item) => typeof item.id === 'number');
  const statusLabel = ticket.cargoStatus
    ? (STATUS_LABELS[ticket.cargoStatus]?.[locale === 'en' ? 'en' : 'vi'] ??
      t('cargoStatusOther'))
    : t('cargoStatusOther');

  if (items.length === 0 && !isCancelled) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
      aria-labelledby="booking-cargo-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-[#0060c4]">
            <Package className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3
              id="booking-cargo-title"
              className="text-base font-bold text-slate-900"
            >
              {t('bookingCargoTitle')}
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              {t('bookingCargoScope')}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${isCancelled ? 'bg-slate-200 text-slate-700' : 'bg-blue-50 text-blue-800'}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {ticket.cargoWaybillCode && (
          <p className="text-sm text-slate-600">
            {t('cargoWaybillLabel')}:{' '}
            <strong className="break-all font-mono text-slate-900">
              {ticket.cargoWaybillCode}
            </strong>
          </p>
        )}

        {isCancelled ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {t('cargoAlreadyCancelled')}
          </p>
        ) : (
          <>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {t('cargoItemsCount', { count: items.length })}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {willCancelAllTickets && ticket.cargoStatus === 'MOI_TAO'
                  ? t('cargoAllTicketsNotice')
                  : canSelectItems
                    ? t('cargoStageSelectionHint')
                    : ticket.cargoStatus !== 'MOI_TAO'
                      ? t('cargoCannotCancelOnline')
                      : t('cargoSelectUnavailable')}
              </p>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => {
                const checked =
                  canSelectItems && selectedIds.includes(item.id!);
                const itemDetails = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">
                        {item.quantity ?? 1} ×{' '}
                        {item.name || t('cargoItemFallback')}
                      </span>
                      <span className="block text-xs text-slate-600">
                        {typeof item.weight === 'number'
                          ? `${item.weight} kg`
                          : t('cargoWeightUnknown')}
                        {item.note ? ` · ${item.note}` : ''}
                      </span>
                    </span>
                    {(checked ||
                      (willCancelAllTickets &&
                        ticket.cargoStatus === 'MOI_TAO')) && (
                      <span className="shrink-0 text-xs font-semibold text-rose-700">
                        {t('cargoMarkedForCancel')}
                      </span>
                    )}
                  </>
                );

                return canSelectItems ? (
                  <label
                    key={item.id}
                    className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:border-blue-300 ${checked ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200 bg-white'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onSelectionChange(
                          checked
                            ? selectedIds.filter((id) => id !== item.id)
                            : [...selectedIds, item.id!],
                        )
                      }
                      aria-label={t('cargoSelectItem', {
                        name: item.name || t('cargoItemFallback'),
                        index: index + 1,
                      })}
                      className="size-5 shrink-0 rounded border-slate-300 text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-500"
                    />
                    {itemDetails}
                  </label>
                ) : (
                  <div
                    key={item.id ?? index}
                    className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    {itemDetails}
                  </div>
                );
              })}
            </div>

            {typeof ticket.cargoFee === 'number' && ticket.cargoFee > 0 && (
              <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-slate-600">{t('cargoCurrentFee')}</span>
                <strong className="text-slate-900">
                  {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
                    style: 'currency',
                    currency: 'VND',
                  }).format(ticket.cargoFee)}
                </strong>
              </div>
            )}

            {selectedIds.length > 0 && canSelectItems && (
              <p
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-900"
                role="status"
              >
                {t('cargoSelectionStaged', { count: selectedIds.length })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
