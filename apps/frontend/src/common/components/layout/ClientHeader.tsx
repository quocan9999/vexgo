// /src/common/components/layout/ClientHeader.tsx
'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { User, Bus, Menu, X, ChevronDown, FileText, Settings, LogOut } from 'lucide-react';
import { useAuthStore } from '../../../context/useAuthStore';

interface NavLinksNavProps {
  onItemClick?: () => void;
  isMobile?: boolean;
}

const NavLinksList: React.FC<NavLinksNavProps> = ({ onItemClick, isMobile }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const needType = searchParams?.get('needType');

  const handleHomeClick = (e?: React.MouseEvent) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('busss_hasSearched');
      window.dispatchEvent(new Event('clearSearch'));
    }
  };

  const navLinks = [
    { href: '/', label: 'Trang chủ', onClick: handleHomeClick },
    { href: '/posts?needType=RENT', label: 'Gửi hàng' },
    { href: '/about', label: 'Giới thiệu' },
    { href: '/contact', label: 'Liên hệ' },
  ];

  const checkIsActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/posts?needType=RENT') {
      return pathname === '/posts' && needType === 'RENT';
    }
    return pathname.startsWith(href);
  };

  if (isMobile) {
    return (
      <div className="space-y-1">
        {navLinks.map((link) => {
          const isActive = checkIsActive(link.href);
          return (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => {
                if(link.onClick) link.onClick();
                if(onItemClick) onItemClick();
              }}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'text-amber-400 font-bold bg-white/5'
                  : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium">
      {navLinks.map((link) => {
        const isActive = checkIsActive(link.href);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`transition-colors cursor-pointer ${
              isActive
                ? 'text-amber-400 font-bold'
                : 'text-slate-200 hover:text-amber-300'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};

export const ClientHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 bg-red-600 text-white border-b border-red-700 shadow-md font-sans">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Logo bên trái */}
        <Link href="/" className="flex items-center gap-2.5" onClick={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('busss_hasSearched');
            window.dispatchEvent(new Event('clearSearch'));
          }
        }}>
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-brand-light">
            <Bus className="w-5 h-5 text-brand-light" />
          </div>
          <div className="flex items-center gap-1.5 font-bold text-lg sm:text-xl tracking-tight">
            <span className="text-white">Bus</span>
            <span className="text-amber-400">Way</span>
          </div>
        </Link>

        {/* Menu giữa */}
        <Suspense fallback={<div className="hidden lg:flex gap-6 text-sm text-slate-300">Đang tải...</div>}>
          <NavLinksList />
        </Suspense>

        {/* Nút bên phải */}
        <div className="flex items-center gap-3 sm:gap-4">
          {isAuthenticated && user ? (
            /* User Avatar Dropdown */
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left pr-1">
                  <span className="text-xs font-bold text-white leading-none">
                    {user.fullName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              </button>

              {/* Dropdown Menu Popup */}
              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 text-slate-800 z-50 animate-in fade-in duration-150"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 rounded-t-2xl">
                    <p className="text-xs text-slate-400 font-medium">Đã đăng nhập tài khoản</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{user.fullName}</p>
                    <p className="text-xs text-brand font-semibold">{user.phone}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/my-posts"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                      <span>Vé của tôi</span>
                    </Link>

                    <Link
                      href="/profile"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span>Thông tin cá nhân</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-200 hover:text-white transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập</span>
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0e2a20] border-t border-emerald-900/60 px-4 py-4 space-y-3">
          <Suspense fallback={null}>
            <NavLinksList isMobile onItemClick={() => setMobileMenuOpen(false)} />
          </Suspense>
          <div className="pt-2 border-t border-emerald-900/60 space-y-2">
            {isAuthenticated && user ? (
              <>
                <Link
                  href="/my-posts"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-amber-300 bg-white/5 rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  <span>Vé của tôi</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-300"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất ({user.fullName})</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200"
              >
                <User className="w-4 h-4" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default ClientHeader;
