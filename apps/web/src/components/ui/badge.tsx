import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-rose-50 text-rose-700 ring-rose-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function Badge({ children, tone = 'blue', className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1', tones[tone], className)}>{children}</span>;
}
