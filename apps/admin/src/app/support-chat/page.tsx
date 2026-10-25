'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ResourceState } from '@/components/admin/resource-ui';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import { canAccessSupportChat } from '@/features/admin-auth/services/admin-access';
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

  // SUPER ADMIN HOẶC TÀI KHOẢN KHÔNG CÓ QUYỀN CHAT BỊ TỪ CHỐI TRUY CẬP
  if (isSuperAdmin || !hasChatPermission) {
    return (
      <SuperAdminLayout activeSection="overview">
        <div className="admin-page-content admin-ui">
          <ResourceState error>
            <h1 className="text-lg font-semibold">Truy cập bị từ chối</h1>
            <p className="max-w-md">
              {isSuperAdmin
                ? 'Tài khoản Quản trị hệ thống không có quyền truy cập chức năng chăm sóc khách hàng của nhà xe.'
                : 'Tài khoản của bạn không có quyền xem hoặc quản lý chức năng chăm sóc khách hàng.'}
            </p>
          </ResourceState>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout activeSection="support-chat">
      <div className="admin-page-content admin-ui space-y-5">
        <AdminPageHeader
          eyebrow="CHĂM SÓC KHÁCH HÀNG"
          title="Hỗ trợ khách hàng"
          titleId="support-chat-heading"
        />
        <p className="text-[13px] text-muted-foreground">
          Tiếp nhận và phản hồi tin nhắn hỗ trợ từ hành khách.
        </p>
        <AdminChatMessenger key={session.accountId} session={session} />
      </div>
    </SuperAdminLayout>
  );
}
