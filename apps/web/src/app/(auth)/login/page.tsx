import { Suspense } from 'react';
import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import { Bus } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 text-center">Đăng nhập tài khoản</h1>
        <p className="text-slate-500 text-sm mt-2 text-center">Chào mừng bạn quay trở lại Vex Go</p>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-slate-400">Đang tải...</div>}>
        <LoginForm />
      </Suspense>
      <p className="mt-10 text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-semibold text-[#E50012] hover:text-red-800 transition-colors underline underline-offset-4 decoration-2 decoration-red-200 hover:decoration-[#E50012]">
          Đăng ký ngay miễn phí
        </Link>
      </p>
    </AuthPageShell>
  );
}
