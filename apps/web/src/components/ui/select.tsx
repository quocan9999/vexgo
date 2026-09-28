// /src/common/components/ui/Select.tsx
'use client';

import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
  isRequired?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      placeholder = '--- Chọn giá trị ---',
      isRequired = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label ? label?.toLowerCase().replace(/\s+/g, '-') : undefined;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-base font-medium text-slate-800 flex items-center gap-1">
            {label}
            {isRequired && <span className="text-rose-600 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none bg-white text-slate-900 text-base font-normal min-h-[50px] px-4 pr-10 rounded-xl border transition-colors outline-none cursor-pointer
              ${error ? 'border-rose-500 focus:border-rose-600 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 hover:border-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/20'}
              disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="absolute right-3.5 text-slate-500 pointer-events-none flex items-center">
            <ChevronDown className="w-5 h-5" />
          </div>
        </div>

        {error && (
          <p className="text-sm font-semibold text-rose-600 flex items-center gap-1.5 mt-0.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
