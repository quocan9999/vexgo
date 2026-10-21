'use client';

import React from 'react';

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
  const cargoIsPresent = hasCargo || totalWeight > 0 || fee > 0;
  if (!cargoIsPresent) return null;

  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-500 font-semibold">
        Hàng gửi hầm xe ({totalWeight}kg)
      </span>
      <strong className={fee > 0 ? 'text-red-600' : 'text-slate-600'}>
        {fee > 0 ? `${fee.toLocaleString('vi-VN')}đ` : 'Tính khi đặt vé'}
      </strong>
    </div>
  );
};
