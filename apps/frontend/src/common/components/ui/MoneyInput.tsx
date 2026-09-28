// /src/common/components/ui/MoneyInput.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Coins, AlertCircle } from 'lucide-react';

export interface MoneyInputProps {
  label?: string;
  value?: number;
  onChange?: (value: number) => void;
  placeholder?: string;
  error?: string;
  isRequired?: boolean;
  className?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Ví dụ: 2500000000 (2.5 Tỷ)',
  error,
  isRequired = false,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState<string>(
    value ? value.toLocaleString('vi-VN') : ''
  );

  useEffect(() => {
    setDisplayValue(value ? value.toLocaleString('vi-VN') : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ''); // chỉ giữ lại chữ số
    if (!rawValue) {
      setDisplayValue('');
      onChange?.(0);
      return;
    }

    const numericValue = parseInt(rawValue, 10);
    setDisplayValue(numericValue.toLocaleString('vi-VN'));
    onChange?.(numericValue);
  };

  const numericVal = value || 0;

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-base font-medium text-slate-800 flex items-center gap-1">
          {label}
          {isRequired && <span className="text-rose-600 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full bg-white text-slate-900 text-base font-semibold min-h-[50px] px-4 pr-16 rounded-xl border transition-colors outline-none
            ${error ? 'border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20'}
            ${className}
          `}
        />
        <span className="absolute right-4 text-sm font-bold text-slate-500 pointer-events-none">
          VNĐ
        </span>
      </div>

      {/* Dòng đọc số tiền bằng chữ tiếng Việt */}
      {numericVal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1 flex items-center gap-2">
          <span className="text-amber-700 font-bold text-sm inline-flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Bằng chữ:</span>
          </span>
          <span className="text-brand font-extrabold text-base">
            {formatCurrency(numericVal)}
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold text-rose-600 flex items-center gap-1.5 mt-0.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};
