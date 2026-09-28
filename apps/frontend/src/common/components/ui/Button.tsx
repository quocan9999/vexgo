// /src/common/components/ui/Button.tsx
'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'lg',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 select-none rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2';

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm min-h-[38px] gap-1.5',
    md: 'px-4 py-2.5 text-base min-h-[46px] gap-2',
    lg: 'px-6 py-3 text-lg min-h-[52px] gap-2.5', // Chuẩn cho người lớn tuổi
    xl: 'px-8 py-4 text-xl min-h-[58px] gap-3',   // CTA to bản
  };

  const variantStyles = {
    primary:
      'bg-brand text-white hover:bg-brand-hover active:bg-brand-dark focus:ring-brand shadow-md hover:shadow-lg',
    accent:
      'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover focus:ring-[#FFC700] shadow-md hover:shadow-lg',
    success:
      'bg-brand text-white hover:bg-brand-hover active:bg-emerald-800 focus:ring-emerald-600 shadow-md',
    danger:
      'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-600 shadow-md',
    outline:
      'border-2 border-brand text-brand bg-transparent hover:bg-brand/5 active:bg-brand/10 focus:ring-brand',
    ghost:
      'text-brand bg-transparent hover:bg-slate-100 active:bg-slate-200 focus:ring-slate-300',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
