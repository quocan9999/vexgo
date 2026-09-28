import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { RegisterForm } from '@/features/auth/components/register-form';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <AuthPageShell>
      <div className="mb-8 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          Tạo tài khoản mới
        </h2>
        <p className="text-slate-500 text-base">
          Trải nghiệm đặt vé xe khách tiện lợi và nhanh chóng.
        </p>
      </div>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-900 transition-colors underline underline-offset-4 decoration-2 decoration-emerald-200 hover:decoration-[#143D30]">
          Đăng nhập ngay
        </Link>
      </p>
    </AuthPageShell>
  );
}
