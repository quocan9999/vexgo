/* eslint-disable */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserCircle, History, Lock, LogOut } from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { ACCOUNT_NAVIGATION_ITEMS, isAccountNavigationItemActive } from '@/components/layout/customer-navigation';

export const ProfileSidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const menuIcons = {
    profile: <UserCircle className="w-5 h-5" />,
    history: <History className="w-5 h-5" />,
    security: <Lock className="w-5 h-5" />,
  };

  return (
    <>
      <div className="w-full bg-slate-50/80 rounded-xl shadow-sm border border-slate-200/60 p-3">
        <nav className="flex flex-col space-y-1">
          {ACCOUNT_NAVIGATION_ITEMS.map((item) => {
            const isActive = isAccountNavigationItemActive(item, pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-accent shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <div className={`${isActive ? 'text-accent' : 'text-slate-400'}`}>
                  {menuIcons[item.id]}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          <button
            type="button"
            onClick={() => setLogoutModalOpen(true)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 transition-all w-full text-left mt-2"
          >
            <div className="text-rose-500">
              <LogOut className="w-5 h-5 ml-0.5" />
            </div>
            <span>Đăng xuất</span>
          </button>
        </nav>
      </div>

      <ConfirmModal
        isOpen={logoutModalOpen}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất?"
        confirmText="Xác nhận"
        cancelText="Hủy"
        variant="danger"
        onConfirm={() => {
          signOut();
          setLogoutModalOpen(false);
          router.push('/');
        }}
        onClose={() => setLogoutModalOpen(false)}
      />
    </>
  );
};
