import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { Bus } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Quên mật khẩu - VexGo',
  description: 'Khôi phục mật khẩu tài khoản VexGo',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; redirect?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const nextTarget = resolvedParams.next || resolvedParams.redirect;
  const loginHref = nextTarget
    ? `/login?next=${encodeURIComponent(nextTarget)}`
    : '/login';

  return (
    <AuthPageShell>
      <div className="mb-10 flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
          <div className="bg-slate-700 border border-slate-600 p-2 rounded-xl group-hover:scale-105 transition-transform shadow-md shadow-slate-700/20">
            <Bus className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-black tracking-tight">
            <span className="text-slate-900">Vex </span>
            <span className="text-[#FFB300]">Go</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 text-center">Quên mật khẩu</h1>
        <p className="text-slate-500 text-sm mt-2 text-center">
          Nhập số điện thoại để nhận mã xác thực đặt lại mật khẩu
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
        <ForgotPasswordForm />
      </Suspense>

      <p className="mt-8 text-center text-sm text-slate-600">
        Nhớ mật khẩu rồi?{' '}
        <Link
          href={loginHref}
          className="font-semibold text-[#E50012] hover:text-red-800 transition-colors underline underline-offset-4 decoration-2 decoration-red-200 hover:decoration-[#E50012]"
        >
          Đăng nhập ngay
        </Link>
      </p>
    </AuthPageShell>
  );
}
