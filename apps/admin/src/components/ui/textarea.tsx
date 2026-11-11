// Adapted from shadcn/ui base-nova; VexGo field geometry and focus contract.
import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full resize-y rounded-[var(--admin-radius-control)] border border-input/90 bg-card px-3.5 py-2.5 text-sm text-foreground shadow-2xs transition-[color,box-shadow,border-color] duration-150 outline-none placeholder:text-muted-foreground hover:border-slate-400/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 aria-invalid:border-rose-500 aria-invalid:ring-3 aria-invalid:ring-rose-500/15 dark:bg-input/30 dark:hover:border-slate-600 dark:disabled:bg-input/80 dark:aria-invalid:border-rose-500/60 dark:aria-invalid:ring-rose-500/30',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
