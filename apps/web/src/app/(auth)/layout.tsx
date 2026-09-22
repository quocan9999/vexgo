import Link from 'next/link';
import type { ReactNode } from 'react';
import { BusFront, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-border bg-background"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/" className="flex items-center gap-2 text-lg font-black"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><BusFront size={18} /></span>Vex<span className="text-accent">Go</span></Link><span className="flex items-center gap-2 text-xs font-bold text-muted-foreground"><ShieldCheck size={16} className="text-emerald-600" /> Trải nghiệm an toàn</span></div></header><main>{children}</main></div>;
}
