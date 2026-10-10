// frontend/src/modules/client/common/components/CustomerHeader.tsx
'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, Bus, Menu, X, ChevronDown, FileText, Settings, LogOut, Award, Globe } from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { getMobileMenuLabel, RESET_PASSWORD_PATH } from '@/components/layout/customer-navigation';

const emptySubscribe = () => () => {};
const getClientSearch = () => (typeof window !== 'undefined' ? window.location.search : '');
const getServerSearch = () => '';

interface NavLinksNavProps {
  onItemClick?: () => void;
  isMobile?: boolean;
}

const NavLinksList: React.FC<NavLinksNavProps> = ({ onItemClick, isMobile }) => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/shipments/new', label: 'Gửi hàng' },
    { href: '/tickets/lookup', label: 'Tra cứu vé' },
    { href: '/cancel-ticket', label: 'Hủy vé' },
    { href: '/about', label: 'Giới thiệu' },
    { href: '/contact', label: 'Liên hệ' },
  ];

  const checkIsActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/cancel-ticket') {
      return pathname === '/cancel-ticket' || pathname.endsWith('/cancel');
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
              onClick={onItemClick}
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
    <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-base font-semibold">
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

export const CustomerHeader: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const searchQuery = useSyncExternalStore(emptySubscribe, getClientSearch, getServerSearch);
  const { user, signOut } = useAuthSession();

  const currentPath =
    pathname && !pathname.startsWith('/auth')
      ? `${pathname}${searchQuery}`
      : '';
  const loginHref = currentPath
    ? `/auth/login?next=${encodeURIComponent(currentPath)}`
    : '/auth/login';

  return (
    <header className="sticky top-0 z-50 bg-red-600 text-white border-b border-red-700 shadow-md font-sans">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Logo bên trái */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0 mr-2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-brand-light">
            <Bus className="w-5 h-5 sm:w-6 sm:h-6 text-brand-light" />
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 font-bold text-lg sm:text-2xl tracking-tight truncate">
            <span className="text-white truncate">Vex</span>
            <span className="text-amber-400 truncate">Go</span>
          </div>
        </Link>

        {/* Menu giữa PC */}
        <NavLinksList />

        {/* Nút bên phải */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Nút chuyển đổi ngôn ngữ */}
          <button className="hidden sm:flex items-center gap-1.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all text-sm font-semibold text-slate-100 px-3 cursor-pointer">
            <Globe className="w-4 h-4 text-slate-200" />
            VI
          </button>
          {user ? (
            /* User Avatar Dropdown */
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 sm:pl-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-extrabold flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:flex flex-col text-left pr-1">
                  <span className="text-sm font-bold text-white leading-none">
                    {user.fullName}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
              </button>

              {/* Dropdown Menu Popup */}
              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 py-2 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right"
                  onClick={() => setUserDropdownOpen(false)}
                >
                  <div className="flex flex-col">
                    <Link
                      href="/account/loyalty"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                        <Award className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">Hạng thành viên</span>
                    </Link>

                    <Link
                      href="/account/profile"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">Thông tin tài khoản</span>
                    </Link>

                    <Link
                      href="/account/tickets"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-sky-500 transition-colors">Vé của tôi</span>
                    </Link>

                    <Link
                      href={RESET_PASSWORD_PATH}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-400 flex items-center justify-center shrink-0">
                        <Settings className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-orange-500 transition-colors">Đặt lại mật khẩu</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserDropdownOpen(false);
                        setLogoutModalOpen(true);
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group w-full text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4 text-white ml-0.5" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-rose-600 transition-colors">Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={loginHref}
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
            className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label={getMobileMenuLabel(mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="customer-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="customer-mobile-menu" className="lg:hidden bg-[#0e2a20] border-t border-emerald-900/60 px-4 py-4 space-y-3">
          <NavLinksList isMobile onItemClick={() => setMobileMenuOpen(false)} />
          <div className="pt-2 border-t border-emerald-900/60 space-y-2">
            {user ? (
              <>
                <Link
                  href="/account/tickets"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-amber-300 bg-white/5 rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  <span>Vé của tôi</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                    router.push('/');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-300"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất ({user.fullName})</span>
                </button>
              </>
            ) : (
              <Link
                href={loginHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:text-white"
              >
                <User className="w-4 h-4" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      )}

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
    </header>
  );
};

export default CustomerHeader;
