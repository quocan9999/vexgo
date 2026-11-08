'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface LuggageSummaryProps {
  totalWeight: number;
  fee: number;
  hasCargo?: boolean;
}

export const LuggageSummary: React.FC<LuggageSummaryProps> = ({
  totalWeight,
  fee,
  hasCargo = false,
}) => {
  const t = useTranslations('booking');
  const locale = useLocale();

  const cargoIsPresent = hasCargo || totalWeight > 0 || fee > 0;
  if (!cargoIsPresent) return null;

  const formattedFee =
    fee > 0
      ? locale === 'vi'
        ? `${fee.toLocaleString('vi-VN')}đ`
        : `${fee.toLocaleString('en-US')} VND`
      : t('cargoFeeEstimatedAtTerminal');

  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500 font-semibold">
        {t('cargoHoldItems')} ({totalWeight}kg)
        <span className="block text-[11px] text-amber-600 font-normal">
          ({t('estimatedCargoFeeNotice')})
        </span>
      </span>
      <strong className={fee > 0 ? 'text-amber-700 font-bold' : 'text-slate-600'}>
        {formattedFee}
      </strong>
    </div>
  );
};
