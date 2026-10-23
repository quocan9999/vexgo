'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Headphones, ShieldAlert } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Truy cập bị từ chối</h2>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            {isSuperAdmin
              ? 'Tài khoản Quản trị hệ thống (Super Admin) không có quyền truy cập vào chức năng Chăm sóc khách hàng của nhà xe.'
              : 'Tài khoản của bạn không có quyền xem hoặc quản lý chức năng Chăm sóc khách hàng (chat:read hoặc chat:manage).'}
          </p>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout activeSection="support-chat">
      <div className="admin-page-content py-4 md:py-6">
        <section aria-labelledby="support-chat-heading" className="page-intro mb-4 md:mb-5">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-[var(--admin-blue)]" />
              TỔNG ĐÀI CHĂM SÓC KHÁCH HÀNG REALTIME
            </p>
            <h1 id="support-chat-heading">Hỗ trợ khách hàng</h1>
            <p className="text-xs text-slate-500 mt-1">
              Tiếp nhận, xử lý và phản hồi tin nhắn hỗ trợ từ hành khách trong thời gian thực.
            </p>
          </div>
        </section>

        <AdminChatMessenger key={session.accountId} session={session} />
      </div>
    </SuperAdminLayout>
  );
}
