'use client';

import React from 'react';
import { X, Ticket, CheckCircle2, Clock, ShieldAlert, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AvailablePromotion } from '@/features/promotions/services/promotions.api';

interface PromotionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotions: AvailablePromotion[];
  activeCode: string | null;
  onSelectPromotion: (code: string) => void;
  onRemovePromotion: () => void;
  isLoading?: boolean;
}

export const PromotionSelectorModal: React.FC<PromotionSelectorModalProps> = ({
  isOpen,
  onClose,
  promotions,
  activeCode,
  onSelectPromotion,
  onRemovePromotion,
  isLoading,
}) => {
  const t = useTranslations('promotions');
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-accent">
              <Ticket className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
                {t('modalTitle')}
                <span className="text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                  {promotions.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {t('modalDesc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 divide-y-0">
          {promotions.length === 0 ? (
            <div className="py-12 text-center">
              <Ticket className="mx-auto h-12 w-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">{t('noPromosAvailable')}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t('noPromosDesc')}
              </p>
            </div>
          ) : (
            promotions.map((promo) => {
              const isCurrentActive = activeCode === promo.code;
              const discountText =
                promo.discountType === 'PHAN_TRAM'
                  ? `Giảm ${Number(promo.discountValue)}%${
                      promo.maxDiscount
                        ? ` (tối đa ${Number(promo.maxDiscount).toLocaleString('vi-VN')}đ)`
                        : ''
                    }`
                  : `Giảm ${Number(promo.discountValue).toLocaleString('vi-VN')}đ`;

              return (
                <div
                  key={promo.id}
                  className={`group relative flex flex-col justify-between p-4 rounded-xl border-2 transition-all ${
                    isCurrentActive
                      ? 'border-accent bg-orange-50/40 shadow-xs ring-2 ring-accent/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-accent bg-orange-100 px-2.5 py-1 rounded-md tracking-wider border border-orange-200/80">
                          {promo.code}
                        </span>
                        {isCurrentActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> {t('applying')}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 pt-1">
                        {promo.name}
                      </h4>
                      <p className="text-sm font-extrabold text-accent">
                        {discountText}
                      </p>
                      {promo.minimumTicketAmount && Number(promo.minimumTicketAmount) > 0 && (
                        <p className="text-[11px] text-slate-500">
                          {t('minOrder', { amount: Number(promo.minimumTicketAmount).toLocaleString('vi-VN') + 'đ' })}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrentActive) {
                          onRemovePromotion();
                        } else {
                          onSelectPromotion(promo.code);
                          onClose();
                        }
                      }}
                      disabled={isLoading}
                      className={`shrink-0 rounded-lg px-4 py-2 text-xs font-black transition-all cursor-pointer ${
                        isCurrentActive
                          ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                          : 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                      }`}
                    >
                      {isCurrentActive ? t('remove') : t('apply')}
                    </button>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t('expiresOn', { date: promo.endsOn })}
                    </span>
                    <span className="font-semibold text-slate-500">
                      {t('remainingUses', { count: promo.remainingUses })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3.5 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {activeCode ? (
              <span>{t('selectingCode', { code: activeCode })}</span>
            ) : (
              <span>{t('noCodeApplied')}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};
