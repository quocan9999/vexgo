'use client';

import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Phone, UserRound, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}><Input label="Họ và tên" placeholder="Nhập họ tên" leftIcon={<UserRound size={18} />} required /><Input label="Số điện thoại" type="tel" placeholder="Nhập số điện thoại" leftIcon={<Phone size={18} />} required /><Input label="Mật khẩu" type={showPassword ? 'text' : 'password'} placeholder="Tạo mật khẩu" leftIcon={<LockKeyhole size={18} />} rightIcon={<button type="button" aria-label="Hiện mật khẩu" onClick={() => setShowPassword((value) => !value)} className="text-muted-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} required /><Input label="Xác nhận mật khẩu" type={showPassword ? 'text' : 'password'} placeholder="Nhập lại mật khẩu" leftIcon={<LockKeyhole size={18} />} required />{submitted ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Đã tạo tài khoản demo. Xác thực OTP sẽ được nối sau.</p> : null}<Button type="submit" variant="accent" className="w-full"><UserPlus size={17} /> Đăng ký tài khoản</Button></form>;
}
