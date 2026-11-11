import type { ReactNode } from 'react';
import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { SupportWidget } from '@/components/layout/support-widget';

export function CustomerShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-background text-foreground"><CustomerHeader /><main className="flex-1">{children}</main><CustomerFooter /><SupportWidget /></div>;
}
