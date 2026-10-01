import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { RegisterForm } from '@/features/auth/components/register-form';
import { Bus } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 text-center">Đăng ký tài khoản</h1>
        <p className="text-slate-500 text-sm mt-2 text-center">
          Trải nghiệm đặt vé xe khách tiện lợi và nhanh chóng
        </p>
      </div>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-semibold text-[#E50012] hover:text-red-800 transition-colors underline underline-offset-4 decoration-2 decoration-red-200 hover:decoration-[#E50012]">
          Đăng nhập ngay
        </Link>
      </p>
    </AuthPageShell>
  );
}
