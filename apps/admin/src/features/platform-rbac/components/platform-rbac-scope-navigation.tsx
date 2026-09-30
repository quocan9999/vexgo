'use client';

import { Building2, Globe2 } from 'lucide-react';
import Link from 'next/link';
import styles from './platform-rbac-scope-navigation.module.css';

export function PlatformRbacScopeNavigation({
  activeScope,
}: {
  activeScope: 'platform' | 'tenant';
}) {
  return (
    <nav aria-label="Phạm vi phân quyền" className={styles.navigation}>
      <Link
        aria-current={activeScope === 'platform' ? 'page' : undefined}
        className={styles.link}
        href="/rbac"
      >
        <Globe2 aria-hidden="true" size={17} />
        Mặc định toàn hệ thống
      </Link>
      <Link
        aria-current={activeScope === 'tenant' ? 'page' : undefined}
        className={styles.link}
        href="/rbac/tenants"
      >
        <Building2 aria-hidden="true" size={17} />
        Theo nhà xe
      </Link>
    </nav>
  );
}
