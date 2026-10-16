'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Headphones, ShieldAlert } from 'lucide-react';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import { canAccessSupportChat } from '@/features/admin-auth/services/admin-access';
import { AdminChatMessenger } from '@/features/support-chat/components/admin-chat-messenger';

export default function SupportChatPage() {
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
      <div className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Headphones className="w-5 h-5 text-brand" /> Chăm sóc khách hàng
          </h1>
          <p className="text-xs text-slate-500">
            Tiếp nhận và phản hồi tin nhắn hỗ trợ từ hành khách trong thời gian thực.
          </p>
        </div>

        <AdminChatMessenger session={session} />
      </div>
    </SuperAdminLayout>
  );
}
