'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Input } from '@/common/components/ui/Input';
import { Button } from '@/common/components/ui/Button';
import { useAuthStore, MOCK_LOGGED_IN_USER } from '@/context/useAuthStore';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login } = useAuthStore();
  const [phone, setPhone] = useState('0912.345.678');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      // Login with mock user profile
      login('mock-jwt-token-123', {
        ...MOCK_LOGGED_IN_USER,
        phone: phone || '0912.345.678',
      });
      router.push('/');
    }, 600);
  };

  const handleQuickLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      login('mock-jwt-token-123', MOCK_LOGGED_IN_USER);
      router.push('/');
    }, 400);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {/* Quick Demo Login Banner */}
      <div className="p-3.5 bg-emerald-50 border border-emerald-200/90 rounded-2xl flex items-center justify-between gap-2 text-xs mb-2">
        <div>
          <span className="font-extrabold text-emerald-950 block">⚡ Tài khoản mẫu (Demo):</span>
          <span className="text-emerald-800 font-medium">Nguyễn Văn Hùng - SĐT: 0912.345.678</span>
        </div>
        <button
          type="button"
          onClick={handleQuickLogin}
          className="px-3 py-1.5 bg-brand-hover hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-xs whitespace-nowrap"
        >
          Vào ngay
        </button>
      </div>

      <Input
        label="Số điện thoại"
        type="tel"
        placeholder="Nhập số điện thoại..."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        leftIcon={<Phone className="w-5 h-5" />}
      />

      <div className="space-y-1">
        <Input
          label="Mật khẩu"
          type={showPassword ? 'text' : 'password'}
          placeholder="Nhập mật khẩu..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="w-5 h-5" />}
          rightIcon={
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-md transition-colors"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
        />
        <div className="flex items-center justify-end mt-2">
          <a href="#" className="text-sm font-semibold text-brand hover:text-[#0e2a20] transition-colors">
            Quên mật khẩu?
          </a>
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
        Đăng nhập
      </Button>

      <div className="mt-8 pt-2">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500 font-medium">
              Hoặc đăng nhập nhanh bằng
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            size="lg"
            className="w-full font-bold bg-[#0068FF] text-white hover:bg-[#005CE6] active:bg-[#0054D1] focus:ring-[#0068FF] shadow-md hover:shadow-lg shadow-[#0068FF]/20 border-none !px-4"
            onClick={handleQuickLogin}
            leftIcon={
              <div className="bg-white text-[#0068FF] rounded-[4px] px-1.5 py-0.5 text-sm font-black tracking-tighter leading-none mr-1 flex items-center justify-center">
                Zalo
              </div>
            }
          >
            Đăng nhập bằng Zalo
          </Button>
        </div>
      </div>
    </form>
  );
};
