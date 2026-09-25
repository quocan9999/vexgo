import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

type AdminStatusBadgeProps = {
  children: ReactNode;
  tone?: 'active' | 'muted';
};

export function AdminStatusBadge({
  children,
  tone = 'muted',
}: AdminStatusBadgeProps) {
  return (
    <Badge
      className={`admin-status-badge${tone === 'active' ? ' is-active' : ''}`}
    >
      {children}
    </Badge>
  );
}
