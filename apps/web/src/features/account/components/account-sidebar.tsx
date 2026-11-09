'use client';

import React from 'react';
import Link from 'next/link';
import { Award, KeyRound, Ticket, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthSession } from '@/features/auth/auth-session';

export function AccountSidebar() {
  const t = useTranslations('account.sidebar');
  let authContext: ReturnType<typeof useAuthSession> | null = null;
  try {
    authContext = useAuthSession();
  } catch {
    authContext = null;
  }
  const user = authContext?.user;

  const items = [
    { href: '/account/tickets', label: t('history'), icon: Ticket },
    { href: '/account/profile', label: t('profile'), icon: UserRound },
    { href: '/account/profile/password', label: t('security'), icon: KeyRound },
    { href: '/account/loyalty', label: t('loyalty'), icon: Award },
  ];

  return (
    <aside className="rounded-2xl border border-border bg-background p-3 shadow-sm">
      <div className="border-b border-border px-3 pb-4">
        <p className="text-xs font-bold text-muted-foreground">{t('accountArea')}</p>
        <p className="mt-1 font-black">{user?.fullName || user?.phoneNumber || t('profile')}</p>
      </div>
      <nav className="mt-3 grid gap-1">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-muted-foreground transition hover:bg-primary/5 hover:text-primary"
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
