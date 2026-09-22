'use client';

import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LogIn, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDemoSession } from '@/features/auth/demo-session';

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useDemoSession();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('0912 345 678');
  const submit = (event: React.FormEvent) => { event.preventDefault(); signIn({ phone }); router.push('/'); };
  return <form className="space-y-5" onSubmit={submit}><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-black text-emerald-900">Tài khoản demo</p><p className="mt-1 text-emerald-800">Nguyễn Văn Hùng · 0912 345 678</p><button type="button" onClick={() => { signIn(); router.push('/'); }} className="mt-3 text-xs font-black text-emerald-700 underline">Vào nhanh không cần nhập</button></div><Input label="Số điện thoại" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} leftIcon={<Phone size={18} />} required /><Input label="Mật khẩu" type={showPassword ? 'text' : 'password'} defaultValue="123456" leftIcon={<LockKeyhole size={18} />} rightIcon={<button type="button" aria-label="Hiện mật khẩu" onClick={() => setShowPassword((value) => !value)} className="text-muted-foreground">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} required /><div className="flex justify-end"><Link href="#" className="text-xs font-bold text-primary hover:underline">Quên mật khẩu?</Link></div><Button type="submit" variant="accent" className="w-full"><LogIn size={17} /> Đăng nhập</Button></form>;
}
