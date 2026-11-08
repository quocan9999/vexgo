'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ResourceState } from '@/components/admin/resource-ui';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import { canAccessSupportChat } from '@/features/admin-auth/services/admin-access';
import { useTranslations } from 'next-intl';
import { AdminChatMessenger } from '@/features/support-chat/components/admin-chat-messenger';
import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';

export default function SupportChatPage() {
  return (
    <AdminSessionGuard>
      <SupportChatContent />
    </AdminSessionGuard>
  );
}

function SupportChatContent() {
  const t = useTranslations('supportChat');
  const router = useRouter();
  const authState = useAdminSession();

  useEffect(() => {
    if (authState.status === 'anonymous') {
      router.replace('/login');
    }
  }, [authState.status, router]);

  if (authState.status !== 'authenticated') {
    return null;
  }

  const session = authState.session;
  const scope = getAdminAccessScope(session);
  const isSuperAdmin = scope === 'platform';
  const hasChatPermission = canAccessSupportChat(session);

  // SUPER ADMIN OR ACCOUNTS WITHOUT CHAT PERMISSION ACCESS DENIED
  if (isSuperAdmin || !hasChatPermission) {
    return (
      <SuperAdminLayout activeSection="overview">
        <div className="admin-page-content admin-ui">
          <ResourceState error>
            <h1 className="text-lg font-semibold">{t('accessDenied')}</h1>
            <p className="max-w-md">
              {isSuperAdmin
                ? t('accessDeniedSuperAdmin')
                : t('accessDeniedTenant')}
            </p>
          </ResourceState>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout activeSection="support-chat">
      <div className="admin-page-content admin-ui space-y-4">
        <AdminPageHeader
          eyebrow={t('eyebrow')}
          title={t('pageTitle')}
          titleId="support-chat-heading"
        />
        <AdminChatMessenger key={session.accountId} session={session} />
      </div>
    </SuperAdminLayout>
  );
}
