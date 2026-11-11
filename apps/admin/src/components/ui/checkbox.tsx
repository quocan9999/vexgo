// Adapted from shadcn/ui base-nova; VexGo focus contract.
'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { cn } from '@/lib/utils';

import { CheckIcon } from 'lucide-react';

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-input/90 bg-card transition-[color,box-shadow,border-color] duration-150 outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:ring-0 group-has-[:focus-visible]/field-label:not-data-checked:border-input after:absolute after:-inset-x-3 after:-inset-y-2 hover:border-slate-400/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-50 aria-invalid:border-rose-500 aria-invalid:ring-3 aria-invalid:ring-rose-500/15 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:hover:border-slate-600 dark:aria-invalid:border-rose-500/50 dark:aria-invalid:ring-rose-500/30 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground data-checked:shadow-2xs group-has-[:focus-visible]/field-label:data-checked:border-primary dark:data-checked:bg-primary',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
