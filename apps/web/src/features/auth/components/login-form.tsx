/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '../auth-session';
import { authApi, ApiError } from '../services/auth.api';

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuthSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
      setPhoneError('Vui lòng nhập số điện thoại');
      hasError = true;
    } else if (!isVietnamesePhone) {
      setPhoneError('Số điện thoại không hợp lệ');
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError('Vui lòng nhập mật khẩu');
      hasError = true;
    }
    if (hasError) return;

    setIsLoading(true);

    try {
      // Giữ luồng Demo: Nếu nhập đúng sđt Demo thì dùng luôn Demo Session (không gọi API)
      if (phone === '0912.345.678' && password === '123456') {
        setTimeout(() => {
          setIsLoading(false);
          signIn({
            user: { fullName: 'Nguyễn Văn Hùng', phoneNumber: phone, accountId: 0, customerId: 0, roles: ['KHACH_HANG'] },
            accessToken: 'demo_token',
            refreshToken: 'demo_refresh'
          });
          router.push('/');
        }, 600);
        return;
      }

      // Gọi API thật với dữ liệu người dùng nhập
      const response = await authApi.login(phone, password);
      
      // Lưu toàn bộ thông tin đăng nhập vào Auth Context
      signIn(response.data);
      router.push('/');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
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
        label="Số điện thoại"
        type="tel"
        placeholder="Nhập số điện thoại..."
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
          label="Mật khẩu"
          type={showPassword ? 'text' : 'password'}
          placeholder="Nhập mật khẩu..."
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
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
        />
        <div className="flex items-center justify-end mt-2">
          <a href="#" className="text-sm font-semibold text-emerald-600 hover:text-emerald-900 transition-colors">
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


    </form>
  );
}
