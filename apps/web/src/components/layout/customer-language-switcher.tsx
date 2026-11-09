'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, Globe } from 'lucide-react';

export type SupportedLocale = 'vi' | 'en';

type CustomerLanguageSwitcherProps = {
  className?: string;
  isMobile?: boolean;
};

const LANGUAGES: {
  code: SupportedLocale;
  label: string;
  badge: string;
}[] = [
  {
    code: 'vi',
    label: 'Tiếng Việt',
    badge: 'VI',
  },
  {
    code: 'en',
    label: 'English',
    badge: 'EN',
  },
];

export function getLocalizedPath(
  pathname: string,
  newLocale: SupportedLocale,
): string {
  const normalized = pathname || '/';
  const match = normalized.match(/^\/(vi|en)(\/.*|$)/);
  if (match) {
    const rest = match[2] || '';
    return `/${newLocale}${rest}`;
  }
  return `/${newLocale}${normalized === '/' ? '' : normalized}`;
}

export function CustomerLanguageSwitcher({
  className = '',
  isMobile = false,
}: CustomerLanguageSwitcherProps) {
  const router = useRouter();
  const rawPathname = usePathname() || '/';

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLocale: SupportedLocale = rawPathname.startsWith('/en')
    ? 'en'
    : 'vi';

  const currentLang =
    LANGUAGES.find((l) => l.code === currentLocale) ?? LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function handleSelect(code: SupportedLocale) {
    if (typeof document !== 'undefined') {
      document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const localizedPath = getLocalizedPath(rawPathname, code);
    const search =
      typeof window !== 'undefined' && window.location.search
        ? window.location.search
        : '';
    const targetPath = `${localizedPath}${search}`;

    router.replace(targetPath);
    (router as any).refresh?.();
    setOpen(false);
  }

  if (isMobile) {
    return (
      <div className={`space-y-1 ${className}`}>
        <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-white/80" />
          <span>Ngôn ngữ / Language</span>
        </div>
        <div className="grid grid-cols-2 gap-2 px-1">
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLocale;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-[#E60012] shadow-xs'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                aria-pressed={isSelected}
              >
                <span>{lang.label}</span>
                {isSelected && <Check className="w-4 h-4 text-[#E60012]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={
          currentLocale === 'en'
            ? `Change language (current: ${currentLang.label})`
            : `Đổi ngôn ngữ (đang chọn: ${currentLang.label})`
        }
        className="flex items-center gap-1.5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all text-sm font-semibold text-slate-100 px-3 cursor-pointer select-none"
      >
        <Globe className="w-4 h-4 text-slate-200" />
        <span>{currentLang.badge}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={currentLocale === 'en' ? 'Select language' : 'Lựa chọn ngôn ngữ'}
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 py-1.5 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Ngôn ngữ / Language
          </div>
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLocale;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-red-50 text-[#E60012] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-red-100 text-[#E60012]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {lang.badge}
                  </span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-[#E60012]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
