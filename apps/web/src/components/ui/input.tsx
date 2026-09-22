import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Input({ label, leftIcon, rightIcon, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; leftIcon?: ReactNode; rightIcon?: ReactNode }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-bold text-foreground">{label}</span> : null}
      <span className="relative block">
        {leftIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{leftIcon}</span> : null}
        <input className={cn('h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10', leftIcon && 'pl-11', rightIcon && 'pr-11', className)} {...props} />
        {rightIcon ? <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightIcon}</span> : null}
      </span>
    </label>
  );
}
