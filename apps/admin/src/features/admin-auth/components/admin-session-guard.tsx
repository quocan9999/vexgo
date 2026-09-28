'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useDemoAdminSession } from '../hooks/use-demo-admin-session';

type OperationsSection = 'vehicle-types' | 'vehicles' | 'routes' | 'fare-prices';

function getOperationsSection(pathname: string): OperationsSection | null {
  if (pathname.startsWith('/vehicle-types')) return 'vehicle-types';
  if (pathname.startsWith('/vehicles')) return 'vehicles';
  if (pathname.startsWith('/routes')) return 'routes';
  if (pathname.startsWith('/fare-prices')) return 'fare-prices';
  return null;
}

export function AdminSessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sessionStatus = useDemoAdminSession();
  const operationsSection = getOperationsSection(pathname);

  useEffect(() => {
    if (sessionStatus === 'anonymous') {
      router.replace('/login');
    } else if (sessionStatus === 'tenant-preview' && !operationsSection) {
      router.replace('/vehicle-types');
    }
  }, [operationsSection, router, sessionStatus]);

  if (sessionStatus === 'tenant-preview' && operationsSection) {
    return (
      <SuperAdminLayout activeSection={operationsSection}>
        <section
          aria-labelledby="tenant-operations-preview-title"
          className="admin-page-content panel tenant-operations-placeholder"
          role="status"
        >
          <span className="tenant-operations-placeholder__eyebrow">
            GIAO DIỆN XEM TRƯỚC · CHƯA CÓ PHÂN QUYỀN
          </span>
          <h1 id="tenant-operations-preview-title">Vận hành nhà xe</h1>
          <p>
            Dữ liệu vận hành theo nhà xe sẽ được kết nối sau khi hoàn thiện xác thực và phân quyền ở Feature 15–16.
          </p>
        </section>
      </SuperAdminLayout>
    );
  }

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="auth-loading" role="status">
        <span className="auth-loading-mark" aria-hidden="true">
          V
        </span>
        <span>Đang kiểm tra phiên quản trị…</span>
      </div>
    );
  }

  return children;
}
