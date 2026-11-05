/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '../auth-session';
import { authApi, ApiError } from '../services/auth.api';
import { sanitizeLoginRedirect } from '../services/login-redirect';

export function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isHydrated } = useAuthSession();

  const nextParam = searchParams.get('next') || searchParams.get('redirect');
  const nextUrl = sanitizeLoginRedirect(nextParam);
  const loginHref = nextParam
    ? `/login?next=${encodeURIComponent(nextParam)}`
    : '/login';

  // Step state: 1 = Phone, 2 = OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form fields
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Challenge and proof
  const [challengeId, setChallengeId] = useState('');
  const [otpProof, setOtpProof] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Field errors
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

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

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPhoneError('');

    const cleanedPhone = phone.replace(/\D/g, '');
    const isVietnamesePhone = /^(0|84)(3|5|7|8|9)\d{8}$/.test(cleanedPhone);

    if (!phone.trim()) {
      setPhoneError('Vui lòng nhập số điện thoại');
      return;
    }
    if (!isVietnamesePhone) {
      setPhoneError('Số điện thoại không hợp lệ');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.requestForgotPasswordOtp(phone);
      setChallengeId(res.data.challengeId);
      setOtp('');
      setOtpProof('');
      setCountdown(60);
      setStep(2);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Lỗi kết nối khi gửi yêu cầu khôi phục');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (countdown > 0 || isLoading) return;
    setIsLoading(true);
    setErrorMsg('');
    setOtpError('');
    try {
      const res = await authApi.requestForgotPasswordOtp(phone);
      setChallengeId(res.data.challengeId);
      setOtp('');
      setOtpProof('');
      setCountdown(60);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Lỗi kết nối khi gửi lại mã OTP');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setOtpError('');

    if (!otp.trim() || otp.length !== 6) {
      setOtpError('Mã OTP phải bao gồm 6 chữ số');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.verifyForgotPasswordOtp(phone, challengeId, otp);
      setOtpProof(res.data.otpProof);
      setStep(3);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Lỗi kết nối khi xác thực OTP');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPasswordError('');
    setConfirmPasswordError('');

    let hasError = false;
    const passwordBytes = new TextEncoder().encode(newPassword).length;

    if (!newPassword.trim()) {
      setPasswordError('Vui lòng nhập mật khẩu mới');
      hasError = true;
    } else if (passwordBytes < 8) {
      setPasswordError('Mật khẩu phải dài ít nhất 8 ký tự');
      hasError = true;
    } else if (passwordBytes > 72) {
      setPasswordError('Mật khẩu không được vượt quá 72 ký tự');
      hasError = true;
    }

    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Vui lòng xác nhận mật khẩu mới');
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Mật khẩu xác nhận không khớp');
      hasError = true;
    }

    if (hasError) return;

    setIsLoading(true);
    try {
      await authApi.resetForgotPassword({
        phoneNumber: phone,
        otpProof,
        newPassword,
      });
      setStep(4);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Lỗi kết nối khi đặt lại mật khẩu');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Success View
  if (step === 4) {
    return (
      <div className="space-y-6 text-center py-4">
        <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            Đặt lại mật khẩu thành công!
          </h2>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            Mật khẩu mới đã được cập nhật. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
          </p>
        </div>
        <div className="pt-4">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => router.push(loginHref)}
          >
            Đăng nhập ngay
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: New Password Form
  if (step === 3) {
    return (
      <form className="space-y-4" onSubmit={handleResetPassword}>
        <div className="text-sm text-slate-600 mb-4 text-center">
          Vui lòng nhập mật khẩu mới cho tài khoản <b>{phone}</b>.
        </div>

        {errorMsg && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        <Input
          label="Mật khẩu mới"
          type={showPassword ? 'text' : 'password'}
          placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)..."
          value={newPassword}
          error={passwordError}
          onChange={(e) => {
            setNewPassword(e.target.value);
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
          label="Xác nhận mật khẩu mới"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Nhập lại mật khẩu mới..."
          value={confirmPassword}
          error={confirmPasswordError}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setErrorMsg('');
            setConfirmPasswordError('');
          }}
          leftIcon={<ShieldCheck className="w-5 h-5" />}
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
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    );
  }

  // Step 2: OTP Verification Form
  if (step === 2) {
    return (
      <form className="space-y-4" onSubmit={handleVerifyOtp}>
        <div className="text-sm text-slate-600 mb-4 text-center">
          Mã xác thực (OTP) đã được gửi đến số điện thoại <b>{phone}</b>.<br />
        </div>

        {errorMsg && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {errorMsg}
          </div>
        )}

        <Input
          label="Mã OTP"
          type="text"
          placeholder="Nhập mã 6 số..."
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
          <span className="text-slate-500">Chưa nhận được mã?</span>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={countdown > 0 || isLoading}
            className="font-semibold text-emerald-600 hover:text-emerald-800 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            {countdown > 0 ? `Gửi lại sau (${countdown}s)` : 'Gửi lại mã OTP'}
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
            leftIcon={<ArrowLeft className="w-5 h-5" />}
          >
            Quay lại
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
          >
            Xác nhận
          </Button>
        </div>
      </form>
    );
  }

  // Step 1: Input Phone Number Form
  return (
    <form className="space-y-5" onSubmit={handleRequestOtp}>
      {errorMsg && (
        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {errorMsg}
        </div>
      )}

      <Input
        label="Số điện thoại"
        type="tel"
        placeholder="Nhập số điện thoại đã đăng ký..."
        value={phone}
        error={phoneError}
        onChange={(e) => {
          setPhone(e.target.value);
          setErrorMsg('');
          setPhoneError('');
        }}
        leftIcon={<Phone className="w-5 h-5" />}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full mt-2 !mt-8"
        isLoading={isLoading}
        rightIcon={<ArrowRight className="w-5 h-5" />}
      >
        Tiếp tục
      </Button>
    </form>
  );
}
