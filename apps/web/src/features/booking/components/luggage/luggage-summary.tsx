/* eslint-disable */
'use client';

import React from 'react';

interface LuggageSummaryProps {
  totalWeight: number;
  fee: number;
}

export const LuggageSummary: React.FC<LuggageSummaryProps> = ({ totalWeight, fee }) => {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500 font-semibold">
        Hành lý ({totalWeight}kg)
      </span>
      <strong className={fee === 0 ? 'text-emerald-600' : 'text-red-600'}>
        {fee === 0 ? 'Miễn phí' : `${fee.toLocaleString('vi-VN')}đ`}
      </strong>
    </div>
  );
};
