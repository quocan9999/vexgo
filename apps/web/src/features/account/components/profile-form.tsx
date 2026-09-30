'use client';

import React, { useEffect, useState } from 'react';
import { useAuthSession } from '@/features/auth/auth-session';
import { customerApi, CustomerProfile } from '../services/customer.api';
import {
  User,
  Mail,
  Phone,
  Calendar,
  CreditCard,
  Save,
  RefreshCw,
} from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';
import { useRouter } from 'next/navigation';

export const ProfileForm: React.FC = () => {
  const router = useRouter();
  const { accessToken, isHydrated } = useAuthSession();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    variant: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [citizenId, setCitizenId] = useState('');

  useEffect(() => {
    if (!isHydrated) return;
    if (!accessToken) {
      router.replace('/auth/login?next=/account/profile');
      return;
    }

    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const { data } = await customerApi.getMe(accessToken);
        setProfile(data);
        setFullName(data.fullName || '');
        setEmail(data.email || '');
        setDateOfBirth(data.dateOfBirth || '');
        setCitizenId(data.citizenId || '');
      } catch (error) {
        console.error('Fetch profile error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [accessToken, isHydrated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    try {
      setIsSaving(true);
      await customerApi.updateMe(accessToken, {
        fullName: fullName.trim() || undefined,
        email: email.trim() || null,
        dateOfBirth: dateOfBirth || null,
        citizenId: citizenId.trim() || null,
      });
      setModalConfig({
        title: 'Thành công',
        message: 'Cập nhật thông tin tài khoản thành công!',
        variant: 'success',
      });
      setModalOpen(true);
    } catch (error: unknown) {
      setModalConfig({
        title: 'Có lỗi xảy ra',
        message:
          error instanceof Error
            ? error.message
            : 'Không thể cập nhật thông tin lúc này.',
        variant: 'error',
      });
      setModalOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (isHydrated && !accessToken) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-slate-500 font-medium">
          Đang chuyển đến trang đăng nhập...
        </p>
      </div>
    );
  }

  if (!isHydrated || isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Đang tải thông tin...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-red-500 font-medium">
          Không thể tải thông tin. Vui lòng thử lại sau.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="mb-8 border-b border-slate-100 pb-4">
        <h2 className="text-xl md:text-2xl font-black text-slate-900">
          Thông tin tài khoản
        </h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Quản lý thông tin hồ sơ để bảo mật tài khoản
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 pb-8 md:pb-0 md:pr-8">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-sm bg-slate-100 flex items-center justify-center">
            <User className="w-16 h-16 text-slate-300" />
          </div>
          <button
            type="button"
            className="px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            Chọn ảnh
          </button>
          <div className="text-center text-xs text-slate-500 max-w-[180px]">
            <p>Dung lượng file tối đa 1 MB</p>
            <p>Định dạng: JPEG, .PNG</p>
          </div>
        </div>

        {/* Form Fields Section */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-6">
          <div className="space-y-4">
            {/* Phone Number (Read only) */}
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" /> Số điện thoại
              </label>
              <input
                type="text"
                value={profile.phoneNumber}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-500 font-medium cursor-not-allowed"
              />
              <p className="text-xs text-slate-400 mt-1">
                Số điện thoại không thể thay đổi.
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" /> Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Nhập họ và tên"
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-medium hover:border-slate-300 focus:border-brand focus:ring-1 focus:ring-brand transition-colors outline-none"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập địa chỉ email"
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-medium hover:border-slate-300 focus:border-brand focus:ring-1 focus:ring-brand transition-colors outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date of Birth */}
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" /> Ngày sinh
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-medium hover:border-slate-300 focus:border-brand focus:ring-1 focus:ring-brand transition-colors outline-none cursor-text"
                />
              </div>

              {/* Citizen ID (CCCD) */}
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-1.5 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" /> Số CCCD
                </label>
                <input
                  type="text"
                  value={citizenId}
                  onChange={(e) => setCitizenId(e.target.value)}
                  placeholder="Nhập 12 số CCCD"
                  maxLength={12}
                  pattern="\d{12}"
                  title="CCCD phải bao gồm đúng 12 chữ số"
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 font-medium hover:border-slate-300 focus:border-brand focus:ring-1 focus:ring-brand transition-colors outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full md:w-auto bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-bold text-sm px-8 py-3 rounded-xl shadow-md shadow-accent/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
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
    </div>
  );
};
