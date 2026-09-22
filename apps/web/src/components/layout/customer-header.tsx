'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bus, ChevronDown, FileText, Globe2, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { useDemoSession } from '@/features/auth/demo-session';

const navItems = [
  { href: '/', label: 'Trang chủ' },
  { href: '/trips', label: 'Chuyến xe' },
  { href: '/shipments/new', label: 'Gửi hàng' },
  { href: '/tickets/lookup', label: 'Tra cứu vé' },
  { href: '/tickets/ticket-001/cancel', label: 'Hủy vé' },
  { href: '/about', label: 'Giới thiệu' },
  { href: '/contact', label: 'Liên hệ' },
];

export function CustomerHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, signOut } = useDemoSession();
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-red-700 bg-red-600 text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}><span className="grid size-9 place-items-center rounded-lg border border-white/20 bg-white/10"><Bus className="size-5 text-white" /></span><span className="text-xl font-extrabold tracking-tight">Vex<span className="text-amber-400">Go</span></span></Link>
        <nav className="hidden items-center gap-5 text-sm font-bold lg:flex" aria-label="Điều hướng chính">{navItems.map((item) => <Link key={item.href} href={item.href} className={`transition-colors ${isActive(item.href) ? 'text-amber-400' : 'text-white hover:text-amber-300'}`}>{item.label}</Link>)}</nav>
        <div className="flex items-center gap-2 sm:gap-3"><button type="button" aria-label="Đổi ngôn ngữ" className="hidden size-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white sm:grid"><Globe2 className="size-4" /></button>{user ? <div className="relative hidden sm:block"><button type="button" onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1.5 transition hover:bg-white/20"><span className="grid size-7 place-items-center rounded-full bg-amber-400 text-xs font-extrabold text-slate-900">{user.fullName.charAt(0)}</span><span className="max-w-28 truncate text-xs font-bold">{user.fullName}</span><ChevronDown className="size-3.5 text-white/80" /></button>{accountOpen ? <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white py-2 text-slate-800 shadow-2xl"><div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5"><p className="text-xs text-slate-400">Đã đăng nhập tài khoản</p><p className="truncate text-sm font-bold text-slate-900">{user.fullName}</p><p className="text-xs font-semibold text-brand">{user.phone}</p></div><Link href="/account/tickets" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-brand"><FileText className="size-4 text-brand" /> Vé của tôi</Link><Link href="/account/profile" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-brand"><Settings className="size-4 text-slate-400" /> Thông tin cá nhân</Link><div className="mt-1 border-t border-slate-100 pt-1"><button type="button" onClick={signOut} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-bold text-rose-600 transition hover:bg-rose-50"><LogOut className="size-4" /> Đăng xuất</button></div></div> : null}</div> : <Link href="/auth/login" className="hidden items-center gap-1.5 text-sm font-bold text-white transition hover:text-amber-300 sm:flex"><User className="size-4" /> Đăng nhập</Link>}<button type="button" aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'} onClick={() => setMobileOpen((open) => !open)} className="grid size-9 place-items-center rounded-lg text-white transition hover:bg-white/10 lg:hidden">{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button></div>
      </div>
      {mobileOpen ? <div className="border-t border-red-700 bg-red-700 px-4 py-4 lg:hidden"><nav className="mx-auto grid max-w-[1140px] gap-1" aria-label="Điều hướng mobile">{navItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${isActive(item.href) ? 'bg-white/10 text-amber-300' : 'text-white hover:bg-white/10'}`}>{item.label}</Link>)}<Link href={user ? '/account/tickets' : '/auth/login'} onClick={() => setMobileOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm font-bold text-red-600">{user ? <FileText className="size-4" /> : <User className="size-4" />}{user ? 'Vé của tôi' : 'Đăng nhập'}</Link></nav></div> : null}
    </header>
  );
}
