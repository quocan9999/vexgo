'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, Eye, EyeOff, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDemoSession } from '@/features/auth/demo-session';

export function RegisterForm() {
  const router = useRouter();
  const { signIn } = useDemoSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate register API call
    setTimeout(() => {
      setIsLoading(false);
      signIn({ phone: phone || '0912.345.678' });
      router.push('/');
    }, 1500);
  };

  const handleQuickRegister = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      signIn();
      router.push('/');
    }, 400);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Input
        label="Số điện thoại"
        type="tel"
        placeholder="Nhập số điện thoại..."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        leftIcon={<Phone className="w-5 h-5" />}
      />

      <Input
        label="Mật khẩu"
        type={showPassword ? 'text' : 'password'}
        placeholder="Nhập mật khẩu..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
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

      <Input
        label="Xác nhận mật khẩu"
        type={showConfirmPassword ? 'text' : 'password'}
        placeholder="Nhập lại mật khẩu..."
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        leftIcon={<Lock className="w-5 h-5" />}
        rightIcon={
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-md transition-colors"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
          Đăng ký tài khoản
        </Button>
      </div>

      <div className="mt-6 pt-2">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-slate-500 font-medium">
              Hoặc đăng ký nhanh bằng
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            size="lg"
            className="w-full font-bold bg-[#0068FF] text-white hover:bg-[#005CE6] active:bg-[#0054D1] focus:ring-[#0068FF] shadow-md hover:shadow-lg shadow-[#0068FF]/20 border-none !px-4"
            onClick={handleQuickRegister}
            leftIcon={
              <div className="bg-white text-[#0068FF] rounded-[4px] px-1.5 py-0.5 text-sm font-black tracking-tighter leading-none mr-1 flex items-center justify-center">
                Zalo
              </div>
            }
          >
            Đăng ký với Zalo
          </Button>
        </div>
      </div>
    </form>
  );
}
