import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isRequired?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, helperText, leftIcon, rightIcon, isRequired = false, className, id, required, ...props }, ref) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? <label htmlFor={inputId} className="text-sm font-bold text-foreground">{label}{isRequired ? <span className="ml-1 text-rose-600">*</span> : null}</label> : null}
      <span className="relative block">
        {leftIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{leftIcon}</span> : null}
        <input ref={ref} id={inputId} required={isRequired || required} aria-invalid={Boolean(error)} className={cn('h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2', error ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-200' : 'border-input focus:border-primary focus:ring-primary/10', leftIcon && 'pl-11', rightIcon && 'pr-11', className)} {...props} />
        {rightIcon ? <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightIcon}</span> : null}
      </span>
      {error ? <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600"><AlertCircle className="size-4 shrink-0" />{error}</p> : null}
      {!error && helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
});
