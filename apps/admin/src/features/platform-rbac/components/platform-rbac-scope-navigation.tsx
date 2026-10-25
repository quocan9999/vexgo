'use client';

import { Building2, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/action-button';

const scopes = [
  {
    id: 'platform',
    href: '/rbac',
    label: 'Mặc định toàn hệ thống',
    Icon: Globe2,
  },
  {
    id: 'tenant',
    href: '/rbac/tenants',
    label: 'Theo nhà xe',
    Icon: Building2,
  },
] as const;

export function PlatformRbacScopeNavigation({
  activeScope,
}: {
  activeScope: 'platform' | 'tenant';
}) {
  return (
    <nav
      aria-label="Phạm vi phân quyền"
      className="grid grid-cols-1 gap-2 rounded-[var(--admin-radius-panel)] border bg-card p-2 sm:flex sm:flex-wrap"
    >
      {scopes.map((scope) => {
        const Icon = scope.Icon;
        const isActive = activeScope === scope.id;
        return (
          <Link
            key={scope.id}
            aria-current={isActive ? 'page' : undefined}
            className={buttonVariants({
              variant: isActive ? 'default' : 'outline',
              className: 'justify-start sm:justify-center',
            })}
            href={scope.href}
          >
            <Icon aria-hidden="true" size={17} />
            {scope.label}
          </Link>
        );
      })}
    </nav>
  );
}
