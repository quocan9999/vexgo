/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  KeyRound,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '../auth-session';
import { authApi, ApiError } from '../services/auth.api';
import { sanitizeLoginRedirect } from '../services/login-redirect';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.register');
  const { signIn, isAuthenticated, isHydrated } = useAuthSession();

  const nextParam = searchParams.get('next') || searchParams.get('redirect');
  const nextUrl = sanitizeLoginRedirect(nextParam);

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Field errors
  const [fullNameError, setFullNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [otpError, setOtpError] = useState('');

  // Flow state
  const [step, setStep] = useState<1 | 2>(1); // 1: Input details, 2: Input OTP
  const [challengeId, setChallengeId] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Caching verified OTP proof for resilient retry
  const [cachedOtpProof, setCachedOtpProof] = useState<string | null>(null);
  const [cachedOtpChallengeId, setCachedOtpChallengeId] = useState<string | null>(null);
  const [cachedOtpPhone, setCachedOtpPhone] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace(nextUrl);
    }
  }, [isHydrated, isAuthenticated, nextUrl, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear old errors
    setErrorMsg('');
    setFullNameError('');
    setPhoneError('');
    setPasswordError('');
    setConfirmPasswordError('');

    let hasError = false;

    if (!fullName.trim()) {
      setFullNameError(t('fullNameRequired'));
      hasError = true;
    }

    const cleanedPhone = phone.replace(/\D/g, '');
    const isVietnamesePhone = /^(0|84)(3|5|7|8|9)\d{8}$/.test(cleanedPhone);

    if (!phone.trim()) {
      setPhoneError(t('phoneRequired'));
      hasError = true;
    } else if (!isVietnamesePhone) {
      setPhoneError(t('phoneInvalid'));
      hasError = true;
    }

    const passwordBytes = new TextEncoder().encode(password).length;
    if (!password.trim()) {
      setPasswordError(t('passwordRequired'));
      hasError = true;
    } else if (passwordBytes < 8) {
      setPasswordError(t('passwordMinLength'));
      hasError = true;
    } else if (passwordBytes > 72) {
      setPasswordError(t('passwordMaxLength'));
      hasError = true;
    }

    if (!confirmPassword.trim()) {
      setConfirmPasswordError(t('confirmPasswordRequired'));
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError(t('passwordsDoNotMatch'));
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);

    try {
      const res = await authApi.requestOtp(phone);
      setChallengeId(res.data.challengeId);
      setCachedOtpProof(null);
      setOtp('');
      setCountdown(60);
      setStep(2);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(t('otpRequestError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg('');
    setOtpError('');
    try {
      const res = await authApi.requestOtp(phone);
      setChallengeId(res.data.challengeId);
      setCachedOtpProof(null);
      setOtp('');
      setCountdown(60);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(t('otpResendError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    setOtpError('');
    setErrorMsg('');

    setIsLoading(true);

    try {
      let proofToUse = cachedOtpProof;
      if (!proofToUse || cachedOtpChallengeId !== challengeId || cachedOtpPhone !== phone) {
        if (!otp.trim() || otp.length !== 6) {
          setOtpError(t('otpMinLength'));
          setIsLoading(false);
          return;
        }

        const verifyRes = await authApi.verifyOtp(phone, challengeId, otp);
        proofToUse = verifyRes.data.otpProof;
        setCachedOtpProof(proofToUse);
        setCachedOtpChallengeId(challengeId);
        setCachedOtpPhone(phone);
      }

      const registerRes = await authApi.register({
        fullName,
        phoneNumber: phone,
        password,
        otpProof: proofToUse!,
      });

      signIn(registerRes.data);
      router.push(nextUrl);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(t('registerError'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <form className="space-y-4" onSubmit={handleVerifyOtpAndRegister}>
        <div className="text-sm text-slate-600 mb-4 text-center">
          {t('otpSentTo', { phone })}<br />
        </div>

        {errorMsg && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        <Input
          label={t('otpLabel')}
          type="text"
          placeholder={t('otpPlaceholder')}
          value={otp}
          error={otpError}
          onChange={(e) => {
            setOtp(e.target.value);
            setErrorMsg('');
            setOtpError('');
          }}
          maxLength={6}
          leftIcon={<KeyRound className="w-5 h-5" />}
        />

        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-slate-500">{t('didNotReceiveOtp')}</span>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={countdown > 0 || isLoading}
            className="font-semibold text-emerald-600 hover:text-emerald-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {countdown > 0 ? t('resendIn', { countdown }) : t('resendOtp')}
          </button>
        </div>

        <div className="pt-2 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep(1);
              setErrorMsg('');
              setOtpError('');
            }}
            disabled={isLoading}
          >
            {t('backButton')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
          >
            {t('confirmButton')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={handleRequestOtp}>
      {errorMsg && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {errorMsg}
        </div>
      )}

      <Input
        label={t('fullNameLabel')}
        type="text"
        placeholder={t('fullNamePlaceholder')}
        value={fullName}
        error={fullNameError}
        onChange={(e) => {
          setFullName(e.target.value);
          setErrorMsg('');
          setFullNameError('');
        }}
        leftIcon={<User className="w-5 h-5" />}
      />

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

      <Input
        label={t('confirmPasswordLabel')}
        type={showConfirmPassword ? 'text' : 'password'}
        placeholder={t('confirmPasswordPlaceholder')}
        value={confirmPassword}
        error={confirmPasswordError}
        onChange={(e) => {
          setConfirmPassword(e.target.value);
          setErrorMsg('');
          setConfirmPasswordError('');
        }}
        leftIcon={<Lock className="w-5 h-5" />}
        rightIcon={
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-md transition-colors"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        }
      />

      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          leftIcon={<UserPlus className="w-5 h-5" />}
        >
          {t('continueButton')}
        </Button>
      </div>
    </form>
  );
}
