// Adapted from shadcn/ui base-nova; VexGo theme and interaction contract.
'use client';

import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-11 sm:h-10 w-full min-w-0 rounded-[var(--admin-radius-control)] border border-input/90 bg-card px-3.5 py-1 text-sm text-foreground shadow-2xs transition-[color,box-shadow,border-color] duration-150 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-slate-400/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 aria-invalid:border-rose-500 aria-invalid:ring-3 aria-invalid:ring-rose-500/15 dark:bg-input/30 dark:hover:border-slate-600 dark:disabled:bg-input/80 dark:aria-invalid:border-rose-500/60 dark:aria-invalid:ring-rose-500/30',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
