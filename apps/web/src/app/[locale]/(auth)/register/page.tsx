import { Suspense } from 'react';
import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { RegisterForm } from '@/features/auth/components/register-form';
import { Bus } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; redirect?: string }>;
}) {
  const t = await getTranslations('auth.register');
  const locale = await getLocale();
  const resolvedParams = searchParams ? await searchParams : {};
  const nextTarget = resolvedParams.next || resolvedParams.redirect;
  const loginHref = nextTarget
    ? `/${locale}/login?next=${encodeURIComponent(nextTarget)}`
    : `/${locale}/login`;

  return (
    <AuthPageShell>
      <div className="mb-10 flex flex-col items-center">
        <Link href={`/${locale}`} className="inline-flex items-center gap-3 mb-6 group">
          <div className="bg-slate-700 border border-slate-600 p-2 rounded-xl group-hover:scale-105 transition-transform shadow-md shadow-slate-700/20">
            <Bus className="w-6 h-6 text-white" />
          </div>
          <span className="text-3xl font-black tracking-tight">
            <span className="text-slate-900">Vex </span>
            <span className="text-[#FFB300]">Go</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 text-center">{t('title')}</h1>
        <p className="text-slate-500 text-sm mt-2 text-center">
          {t('subtitle')}
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-slate-400">{t('loading')}</div>}>
        <RegisterForm />
      </Suspense>

      <p className="mt-8 text-center text-sm text-slate-600">
        {t('alreadyHaveAccount')}{' '}
        <Link href={loginHref} className="font-semibold text-[#E50012] hover:text-red-800 transition-colors underline underline-offset-4 decoration-2 decoration-red-200 hover:decoration-[#E50012]">
          {t('loginNow')}
        </Link>
      </p>
    </AuthPageShell>
  );
}
