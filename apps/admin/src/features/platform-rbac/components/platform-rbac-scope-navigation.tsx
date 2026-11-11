'use client';

import { Building2, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/action-button';

export function PlatformRbacScopeNavigation({
  activeScope,
}: {
  activeScope: 'platform' | 'tenant';
}) {
  const tRbac = useTranslations('rbac');

  const scopes = [
    {
      id: 'platform',
      href: '/rbac',
      label: tRbac('platformDefaultScope'),
      Icon: Globe2,
    },
    {
      id: 'tenant',
      href: '/rbac/tenants',
      label: tRbac('tenantScope'),
      Icon: Building2,
    },
  ] as const;

  return (
    <nav
      aria-label={tRbac('scopeNavLabel')}
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
