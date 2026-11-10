import type { ReactNode } from 'react';
import { CustomerShell } from '@/components/layout/customer-shell';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <CustomerShell>{children}</CustomerShell>;
}
