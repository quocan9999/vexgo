import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'success' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-background text-foreground hover:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-destructive text-white hover:bg-destructive/90',
  accent: 'bg-accent text-white hover:bg-accent-dark',
  success: 'bg-brand text-white hover:bg-brand-hover',
  outline: 'border-2 border-brand bg-transparent text-brand hover:bg-brand/5',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-[52px] px-6 py-3 text-lg',
  xl: 'min-h-[58px] px-8 py-4 text-xl',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Button({ children, className, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', sizes[size], variants[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="size-5 animate-spin" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}

export function ButtonLink({ href, children, className, variant = 'primary' }: { href: string; children: ReactNode; className?: string; variant?: ButtonVariant }) {
  return <Link href={href} className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', variants[variant], className)}>{children}</Link>;
}
