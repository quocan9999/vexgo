/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '../auth-session';
import { authApi, ApiError } from '../services/auth.api';
import { sanitizeLoginRedirect } from '../services/login-redirect';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.login');
  const locale = useLocale();
  const { signIn, isAuthenticated, isHydrated } = useAuthSession();
  const nextParam = searchParams.get('next') || searchParams.get('redirect');
  const nextUrl = sanitizeLoginRedirect(nextParam);
  const basePath = `/${locale}`;
  const forgotPasswordHref = nextParam
    ? `${basePath}/forgot-password?next=${encodeURIComponent(nextParam)}`
    : `${basePath}/forgot-password`;

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace(nextUrl);
    }
  }, [isHydrated, isAuthenticated, nextUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear old errors
    setErrorMsg('');
    setPhoneError('');
    setPasswordError('');

    let hasError = false;

    const cleanedPhone = phone.replace(/\D/g, '');
    const isVietnamesePhone = /^(0|84)(3|5|7|8|9)\d{8}$/.test(cleanedPhone);

    if (!phone.trim()) {
      setPhoneError(t('phoneRequired'));
      hasError = true;
    } else if (!isVietnamesePhone) {
      setPhoneError(t('phoneInvalid'));
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError(t('passwordRequired'));
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);

    try {
      const response = await authApi.login(phone, password);

      signIn(response.data);
      const nextUrl = sanitizeLoginRedirect(
        searchParams.get('next') || searchParams.get('redirect'),
      );
      router.push(nextUrl);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(t('connectionError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {errorMsg && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {errorMsg}
        </div>
      )}

      <Input
        label={t('phoneLabel')}
        type="tel"
        placeholder={t('phonePlaceholder')}
        value={phone}
        error={phoneError}
        onChange={(e) => {
          setPhone(e.target.value);
          setErrorMsg('');
          setPhoneError('');
        }}
        leftIcon={<Phone className="w-5 h-5" />}
      />

      <div className="space-y-1">
        <Input
          label={t('passwordLabel')}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('passwordPlaceholder')}
          value={password}
          error={passwordError}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrorMsg('');
            setPasswordError('');
          }}
          leftIcon={<Lock className="w-5 h-5" />}
          rightIcon={
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-md transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          }
        />
        <div className="flex items-center justify-end mt-2">
          <Link
            href={forgotPasswordHref}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-900 transition-colors"
          >
            {t('forgotPassword')}
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-2 !mt-8"
        isLoading={isLoading}
        leftIcon={<LogIn className="w-5 h-5" />}
      >
        {t('loginButton')}
      </Button>
    </form>
  );
}
