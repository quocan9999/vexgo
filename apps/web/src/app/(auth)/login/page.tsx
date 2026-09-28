import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { LoginForm } from '@/features/auth/components/login-form';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <AuthPageShell>
      <LoginForm />
      <p className="mt-10 text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="font-semibold text-emerald-600 hover:text-emerald-900 transition-colors underline underline-offset-4 decoration-2 decoration-emerald-200 hover:decoration-[#143D30]">
          Đăng ký ngay miễn phí
        </Link>
      </p>
    </AuthPageShell>
  );
}
