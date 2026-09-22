import Link from 'next/link';
import { Award, KeyRound, Ticket, UserRound } from 'lucide-react';

const items = [{ href: '/account/tickets', label: 'Vé của tôi', icon: Ticket }, { href: '/account/profile', label: 'Thông tin cá nhân', icon: UserRound }, { href: '/account/profile/password', label: 'Đổi mật khẩu', icon: KeyRound }, { href: '/account/loyalty', label: 'Điểm thưởng', icon: Award }];

export function AccountSidebar() {
  return <aside className="rounded-2xl border border-border bg-background p-3 shadow-sm"><div className="border-b border-border px-3 pb-4"><p className="text-xs font-bold text-muted-foreground">Khu vực tài khoản</p><p className="mt-1 font-black">Nguyễn Văn Hùng</p></div><nav className="mt-3 grid gap-1">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/5 hover:text-primary"><Icon size={18} />{label}</Link>)}</nav></aside>;
}
