'use client';

import { useState } from 'react';
import { AccountSidebar } from '@/features/account/components/account-sidebar';
import { Button } from '@/components/ui/button';

export default function AccountPasswordPage() {
  const [saved, setSaved] = useState(false);
  return <div className="bg-slate-50"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[240px_1fr] lg:px-8"><AccountSidebar /><section className="rounded-3xl border border-border bg-background p-5 shadow-sm sm:p-8"><p className="text-xs font-black uppercase tracking-[0.18em] text-accent">Bảo mật</p><h1 className="mt-2 text-2xl font-black">Đổi mật khẩu</h1><p className="mt-2 text-sm text-muted-foreground">Màn hình demo, chưa cập nhật tài khoản thật.</p><form className="mt-8 max-w-xl space-y-5" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>{['Mật khẩu hiện tại', 'Mật khẩu mới', 'Xác nhận mật khẩu mới'].map((label) => <label className="block space-y-2" key={label}><span className="text-sm font-bold">{label}</span><input type="password" required className="h-12 w-full rounded-xl border border-input px-4 outline-none focus:border-primary" /></label>)}{saved ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">Đã ghi nhận thay đổi demo.</p> : null}<Button variant="accent">Cập nhật mật khẩu</Button></form></section></div></div>;
}
