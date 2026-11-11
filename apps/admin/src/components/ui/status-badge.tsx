// Adapted from shadcn/ui base-nova; VexGo theme and interaction contract.
'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        success:
          'border-[var(--admin-success-border)] bg-[var(--admin-status-success-soft)] text-[var(--admin-status-success)]',
        warning:
          'border-[var(--admin-warning-border)] bg-[var(--admin-status-warning-soft)] text-[var(--admin-status-warning)]',
        default: 'border-transparent bg-primary text-primary-foreground shadow-2xs [a]:hover:bg-primary/90',
        secondary:
          'border-border bg-secondary text-secondary-foreground [a]:hover:bg-muted',
        legacy:
          'border-transparent bg-slate-600 text-white font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded shadow-xs',
        destructive:
          'border-[var(--admin-danger-border)] bg-[var(--admin-danger-soft)] text-[var(--admin-danger)] focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20',
        outline:
          'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost:
          'border-transparent hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'border-transparent text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  render,
  ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: 'badge',
      variant,
    },
  });
}

export function LegacyBadge({
  className,
  children = 'CŨ',
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
