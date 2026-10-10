'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { authApi, ApiError } from '@/features/auth/services/auth.api';
import { AlertModal } from '@/components/ui/alert-modal';

interface FieldErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export const PasswordForm: React.FC = () => {
  const router = useRouter();
  const { user, accessToken, executeWithAuth } = useAuthSession();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState('');

  // Modal alert thành công
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    variant: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const clearFieldError = (field: keyof FieldErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const handleResetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    setGeneralError('');
  };

  const validate = (): boolean => {
    const errors: FieldErrors = {};

    if (!oldPassword) {
      errors.oldPassword = 'Vui lòng nhập mật khẩu cũ.';
    }

    if (!newPassword) {
      errors.newPassword = 'Vui lòng nhập mật khẩu mới.';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Mật khẩu mới phải có tối thiểu 8 ký tự.';
    } else if (newPassword === oldPassword) {
      errors.newPassword = 'Mật khẩu mới không được trùng với mật khẩu cũ.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.';
    } else if (confirmPassword !== newPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    if (!validate()) {
      return;
    }

    if (!accessToken) {
      router.replace('/auth/login?next=/account/profile/password');
      return;
    }

    try {
      setIsSubmitting(true);
      await executeWithAuth((token) =>
        authApi.changePassword(token, {
          oldPassword,
          newPassword,
        }),
      );

      handleResetForm();
      setModalConfig({
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu tài khoản của bạn đã được cập nhật thành công.',
        variant: 'success',
      });
      setModalOpen(true);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setModalConfig({
            title: 'Phiên đăng nhập hết hạn',
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            variant: 'error',
          });
          setModalOpen(true);
          router.replace('/auth/login?next=/account/profile/password');
          return;
        }

        // Ánh xạ lỗi nghiệp vụ cụ thể xuống từng input tương ứng
        if (error.error === 'INVALID_OLD_PASSWORD') {
          setFieldErrors((prev) => ({
            ...prev,
            oldPassword: 'Mật khẩu cũ không chính xác.',
          }));
          return;
        }

        if (error.error === 'SAME_PASSWORD') {
          setFieldErrors((prev) => ({
            ...prev,
            newPassword: 'Mật khẩu mới không được trùng với mật khẩu cũ.',
          }));
          return;
        }

        setGeneralError(error.message || 'Không thể đổi mật khẩu lúc này.');
        return;
      }

      setGeneralError(
        error instanceof Error ? error.message : 'Không thể đổi mật khẩu lúc này.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-black text-[#0060c4] tracking-tight">
          Đặt lại mật khẩu
        </h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 md:p-10 max-w-xl mx-auto transition-all">
        {user?.phoneNumber && (
          <div className="flex flex-col items-center justify-center mb-8 pb-6 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600 mb-3 shadow-2xs">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Số điện thoại tài khoản
            </div>
            <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-wide font-mono">
              {user.phoneNumber}
            </h3>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {generalError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-sm flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium leading-relaxed">{generalError}</span>
            </div>
          )}

          {/* Mật khẩu cũ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                <span className="text-rose-500 mr-1">*</span>Mật khẩu cũ
              </label>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock className={`w-4 h-4 ${fieldErrors.oldPassword ? 'text-rose-400' : 'text-slate-400'}`} />
              </div>
              <input
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  clearFieldError('oldPassword');
                }}
                placeholder="Nhập mật khẩu cũ"
                className={`w-full pl-10 pr-11 py-3 bg-slate-50/70 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white ${
                  fieldErrors.oldPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15 bg-rose-50/20 text-slate-900'
                    : 'border-slate-200 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md transition-colors"
                aria-label={showOldPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showOldPassword ? (
                  <Eye className="w-4 h-4 text-slate-500" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.oldPassword && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{fieldErrors.oldPassword}</span>
              </p>
            )}
          </div>

          {/* Mật khẩu mới */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                <span className="text-rose-500 mr-1">*</span>Mật khẩu mới
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Tối thiểu 8 ký tự</span>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock className={`w-4 h-4 ${fieldErrors.newPassword ? 'text-rose-400' : 'text-slate-400'}`} />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  clearFieldError('newPassword');
                }}
                placeholder="Nhập mật khẩu mới"
                className={`w-full pl-10 pr-11 py-3 bg-slate-50/70 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white ${
                  fieldErrors.newPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15 bg-rose-50/20 text-slate-900'
                    : 'border-slate-200 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md transition-colors"
                aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showNewPassword ? (
                  <Eye className="w-4 h-4 text-slate-500" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.newPassword && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{fieldErrors.newPassword}</span>
              </p>
            )}
          </div>

          {/* Xác nhận mật khẩu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-slate-700">
                <span className="text-rose-500 mr-1">*</span>Xác nhận mật khẩu
              </label>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock className={`w-4 h-4 ${fieldErrors.confirmPassword ? 'text-rose-400' : 'text-slate-400'}`} />
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError('confirmPassword');
                }}
                placeholder="Nhập lại mật khẩu mới"
                className={`w-full pl-10 pr-11 py-3 bg-slate-50/70 border rounded-xl text-sm transition-all focus:outline-none focus:bg-white ${
                  fieldErrors.confirmPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15 bg-rose-50/20 text-slate-900'
                    : 'border-slate-200 focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md transition-colors"
                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showConfirmPassword ? (
                  <Eye className="w-4 h-4 text-slate-500" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600 flex items-center gap-1.5 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>{fieldErrors.confirmPassword}</span>
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 justify-center pt-6">
            <button
              type="button"
              onClick={handleResetForm}
              disabled={isSubmitting}
              className="px-7 py-2.5 border border-slate-300 rounded-full text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-[#f05123] hover:bg-[#ea4a18] text-white rounded-full text-sm font-black shadow-md shadow-[#f05123]/25 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Xác nhận</span>
              )}
            </button>
          </div>
        </form>
      </div>

      <AlertModal
        isOpen={modalOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
