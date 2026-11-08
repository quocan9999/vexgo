// frontend/src/modules/client/common/components/CustomerHeader.tsx
'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  User,
  Bus,
  Menu,
  X,
  ChevronDown,
  FileText,
  Package,
  Settings,
  LogOut,
  Award,
  Globe,
  Clock,
  QrCode,
  Ticket,
} from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { getMobileMenuLabel, RESET_PASSWORD_PATH } from '@/components/layout/customer-navigation';
import { getLatestActivePaymentDraft } from '@/features/booking/services/payment-draft';
import { CustomerLanguageSwitcher } from './customer-language-switcher';

const emptySubscribe = () => () => {};
const getClientSearch = () => (typeof window !== 'undefined' ? window.location.search : '');
const getServerSearch = () => '';

function stripLocale(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  const match = pathname.match(/^\/(vi|en)(\/.*|$)/);
  if (match) return match[2] || '/';
  return pathname;
}

interface NavLinksNavProps {
  onItemClick?: () => void;
  isMobile?: boolean;
}

const NavLinksList: React.FC<NavLinksNavProps> = ({ onItemClick, isMobile }) => {
  const t = useTranslations('header');
  const rawPathname = usePathname() || '/';
  const pathname = stripLocale(rawPathname);
  const searchQuery = useSyncExternalStore(emptySubscribe, getClientSearch, getServerSearch);
  const [lookupOpen, setLookupOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setLookupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinksBefore = [
    { href: '/', label: t('home') },
    { href: '/shipments/new', label: t('shipment') },
    { href: '/promotions', label: t('promotions') },
    { href: '/news', label: t('news') },
  ];

  const navLinksAfter = [
    { href: '/cancel-ticket', label: t('cancelTicket') },
    { href: '/contact', label: t('contact') },
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

  const isLookupActive =
    pathname.startsWith('/tickets/lookup') ||
    pathname.startsWith('/tra-cuu-ve') ||
    (pathname.startsWith('/send-freight') && searchQuery.includes('tab=lookup'));

  if (isMobile) {
    return (
      <div className="space-y-1">
        {navLinksBefore.map((link) => {
          const isActive = checkIsActive(link.href);
          return (
            <Link
              key={link.label}
              href={link.href}
              onClick={onItemClick}
              className={`block px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-amber-300 font-bold bg-black/15 border-l-4 border-amber-400 pl-3'
                  : 'text-white/90 hover:bg-black/10 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          );
        })}

        {/* Tra cứu section for mobile */}
        <div className="pt-2 pb-1 border-y border-white/10 my-2 space-y-1">
          <div className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-white/50">
            {t('lookupInfo')}
          </div>
          <Link
            href="/tickets/lookup"
            onClick={onItemClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pathname.startsWith('/tickets/lookup') ||
              pathname.startsWith('/tra-cuu-ve')
                ? 'text-amber-300 font-bold bg-black/15 border-l-4 border-amber-400 pl-3'
                : 'text-white/90 hover:bg-black/10 hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4 text-sky-400" />
            <span>{t('lookupTicket')}</span>
          </Link>
          <Link
            href="/send-freight?tab=lookup"
            onClick={onItemClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pathname.startsWith('/send-freight') &&
              searchQuery.includes('tab=lookup')
                ? 'text-amber-300 font-bold bg-black/15 border-l-4 border-amber-400 pl-3'
                : 'text-white/90 hover:bg-black/10 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4 text-orange-400" />
            <span>{t('lookupShipment')}</span>
          </Link>
        </div>

        {navLinksAfter.map((link) => {
          const isActive = checkIsActive(link.href);
          return (
            <Link
              key={link.label}
              href={link.href}
              onClick={onItemClick}
              className={`block px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-amber-300 font-bold bg-black/15 border-l-4 border-amber-400 pl-3'
                  : 'text-white/90 hover:bg-black/10 hover:text-white'
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
    <nav className="hidden lg:flex items-center gap-4 xl:gap-7 text-sm xl:text-[15px] font-semibold">
      {navLinksBefore.map((link) => {
        const isActive = checkIsActive(link.href);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`relative py-1.5 transition-all duration-200 cursor-pointer ${
              isActive
                ? 'text-white font-extrabold after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-amber-400 after:rounded-full'
                : 'text-white/85 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      {/* Tra cứu Dropdown */}
      <div
        ref={dropdownRef}
        className="relative"
        onMouseEnter={() => setLookupOpen(true)}
        onMouseLeave={() => setLookupOpen(false)}
      >
        <button
          type="button"
          onClick={() => setLookupOpen((prev) => !prev)}
          className={`flex items-center gap-1 py-1.5 transition-all duration-200 cursor-pointer ${
            isLookupActive
              ? 'text-white font-extrabold after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-amber-400 after:rounded-full'
              : 'text-white/85 hover:text-white'
          }`}
          aria-expanded={lookupOpen}
        >
          <span>{t('lookup')}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              lookupOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {lookupOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
            <div className="w-72 bg-white rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.18)] border border-slate-100 p-2 text-slate-800 animate-in fade-in zoom-in-95 duration-150 origin-top">
              <Link
                href="/tickets/lookup"
                onClick={() => {
                  setLookupOpen(false);
                  onItemClick?.();
                }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-[#0060c4] group-hover:text-white transition-all">
                  <Ticket className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-[#0060c4] transition-colors">
                    {t('lookupTicket')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {t('lookupTicketDesc')}
                  </span>
                </div>
              </Link>

              <Link
                href="/send-freight?tab=lookup"
                onClick={() => {
                  setLookupOpen(false);
                  onItemClick?.();
                }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors group mt-1"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 group-hover:bg-[#FF7D42] group-hover:text-white transition-all">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-slate-900 group-hover:text-[#FF7D42] transition-colors">
                    {t('lookupShipment')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {t('lookupShipmentDesc')}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>

      {navLinksAfter.map((link) => {
        const isActive = checkIsActive(link.href);
        return (
          <Link
            key={link.label}
            href={link.href}
            className={`relative py-1.5 transition-all duration-200 cursor-pointer ${
              isActive
                ? 'text-white font-extrabold after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-amber-400 after:rounded-full'
                : 'text-white/85 hover:text-white'
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
  const t = useTranslations('header');
  const router = useRouter();
  const rawPathname = usePathname() || '/';
  const pathname = stripLocale(rawPathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [dismissedDraftId, setDismissedDraftId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchQuery = useSyncExternalStore(emptySubscribe, getClientSearch, getServerSearch);
  const { user, signOut } = useAuthSession();

  const shouldHidePaymentBar =
    !pathname ||
    pathname.startsWith('/payment') ||
    pathname.startsWith('/invoice') ||
    pathname.startsWith('/account/tickets') ||
    pathname.startsWith('/account/shipments') ||
    pathname.startsWith('/auth');

  useEffect(() => {
    if (shouldHidePaymentBar) return;
    const initialTimer = setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const handleDraftsChanged = () => {
      setNowMs(Date.now());
    };
    window.addEventListener('vexgo:payment-drafts-changed', handleDraftsChanged);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(timer);
      window.removeEventListener('vexgo:payment-drafts-changed', handleDraftsChanged);
    };
  }, [shouldHidePaymentBar, pathname]);

  const activeDraftInfo =
    !shouldHidePaymentBar && nowMs > 0
      ? getLatestActivePaymentDraft(nowMs)
      : null;
  const visibleDraftInfo =
    activeDraftInfo && activeDraftInfo.draft.id !== dismissedDraftId
      ? activeDraftInfo
      : null;

  useEffect(() => {
    if (!userDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userDropdownOpen]);

  const currentPath =
    pathname && !pathname.startsWith('/auth')
      ? `${pathname}${searchQuery}`
      : '';
  const loginHref = currentPath
    ? `/auth/login?next=${encodeURIComponent(currentPath)}`
    : '/auth/login';

  return (
    <header className="sticky top-0 z-50 bg-[#E60012] text-white border-b border-[#CC0010] shadow-md font-sans">
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
          <CustomerLanguageSwitcher className="hidden sm:inline-block" />
          {user ? (
            /* User Avatar Dropdown */
            <div ref={userDropdownRef} className="relative">
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
                      <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">{t('membershipTier')}</span>
                    </Link>

                    <Link
                      href="/account/profile"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">{t('accountInfo')}</span>
                    </Link>

                    <Link
                      href="/account/tickets"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-sky-400 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-sky-500 transition-colors">{t('myTickets')}</span>
                    </Link>

                    <Link
                      href="/account/shipments"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-emerald-600 transition-colors">{t('myShipments')}</span>
                    </Link>

                    <Link
                      href={RESET_PASSWORD_PATH}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-orange-400 flex items-center justify-center shrink-0">
                        <Settings className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-orange-500 transition-colors">{t('resetPassword')}</span>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserDropdownOpen(false);
                        signOut();
                        router.push('/');
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group w-full text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
                        <LogOut className="w-4 h-4 text-white ml-0.5" />
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-rose-600 transition-colors">{t('logout')}</span>
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
              <span>{t('login')}</span>
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
        <div id="customer-mobile-menu" className="lg:hidden bg-[#B3000E] border-t border-white/15 px-4 py-4 space-y-3">
          <NavLinksList isMobile onItemClick={() => setMobileMenuOpen(false)} />
          <div className="pt-2 border-t border-white/15 space-y-2">
            {user ? (
              <>
                <Link
                  href="/account/tickets"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-amber-300 bg-white/10 rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t('myTickets')}</span>
                </Link>
                <Link
                  href="/account/shipments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-emerald-300 bg-white/10 rounded-lg"
                >
                  <Package className="w-4 h-4" />
                  <span>{t('myShipments')}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                    router.push('/');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('logout')} ({user.fullName})</span>
                </button>
              </>
            ) : (
              <Link
                href={loginHref}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:text-white"
              >
                <User className="w-4 h-4" />
                <span>{t('login')}</span>
              </Link>
            )}
          </div>
          <div className="pt-2 border-t border-white/15">
            <CustomerLanguageSwitcher isMobile />
          </div>
        </div>
      )}

      {visibleDraftInfo && (() => {
        const remainingSec = Math.max(
          0,
          Math.ceil((visibleDraftInfo.expiresAtMs - nowMs) / 1000),
        );
        const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
        const ss = String(remainingSec % 60).padStart(2, '0');
        const draft = visibleDraftInfo.draft;
        if (draft.kind === 'shipment') {
          return null;
        }
        const isHexCode = (val?: string | null) => Boolean(val && /^[0-9a-f]{16,}$/i.test(val.trim()));
        const friendlyCode = draft.bookingCode && !isHexCode(draft.bookingCode)
          ? draft.bookingCode
          : null;
        const routeName = draft.legs?.[0]?.route ?? null;

        return (
          <div className="bg-amber-50 border-t border-amber-200 text-slate-900">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold text-amber-950 truncate">
                  Bạn đang có đơn đặt vé
                  {friendlyCode ? (
                    <> <strong className="font-mono text-amber-900">{friendlyCode}</strong></>
                  ) : routeName ? (
                    <> chuyến <strong className="text-amber-900">{routeName}</strong></>
                  ) : null}{' '}
                  đang chờ thanh toán
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200/80 text-amber-900 shrink-0">
                  Còn {mm}:{ss}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/payment?draftId=${encodeURIComponent(visibleDraftInfo.draft.id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-extrabold transition-colors shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Tiếp tục thanh toán</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setDismissedDraftId(visibleDraftInfo.draft.id)}
                  title="Ẩn thông báo này"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </header>
  );
};

export default CustomerHeader;
