'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserCircle, Wallet, History, Lock, LogOut } from 'lucide-react';
import { useAuthStore } from '@/context/useAuthStore';
import { ConfirmModal } from '@/common/components/ui/ConfirmModal';

export const ProfileSidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const menuItems = [
    {
      id: 'profile',
      label: 'Thông tin tài khoản',
      icon: <UserCircle className="w-5 h-5" />,
      href: '/profile',
      iconColor: 'text-slate-500',
      active: pathname === '/profile',
    },
    {
      id: 'history',
      label: 'Lịch sử mua vé',
      icon: <History className="w-5 h-5" />,
      href: '/my-posts',
      iconColor: 'text-slate-500',
      active: pathname === '/my-posts',
    },
    {
      id: 'security',
      label: 'Đặt lại mật khẩu',
      icon: <Lock className="w-5 h-5" />,
      href: '/profile/password',
      iconColor: 'text-slate-500',
      active: pathname === '/profile/password',
    }
  ];

  return (
    <>
      <div className="w-full bg-slate-50/80 rounded-xl shadow-sm border border-slate-200/60 p-3">
        <nav className="flex flex-col space-y-1">
          {menuItems.map((item) => {
            const isActive = item.active;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-accent shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                }`}
              >
                <div className={`${isActive ? 'text-accent' : 'text-slate-400'}`}>
                  {item.icon}
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
          logout();
          setLogoutModalOpen(false);
          router.push('/');
        }}
        onClose={() => setLogoutModalOpen(false)}
      />
    </>
  );
};
