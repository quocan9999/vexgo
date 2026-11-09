'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SupportedLocale = 'vi' | 'en';

type AdminLanguageSwitcherProps = {
  className?: string;
  value?: SupportedLocale;
  onChange?: (locale: SupportedLocale) => void;
};

const LANGUAGES: {
  code: SupportedLocale;
  label: string;
  badge: string;
  badgeClass: string;
}[] = [
  {
    code: 'vi',
    label: 'Tiếng Việt',
    badge: 'VI',
    badgeClass: 'bg-red-50 text-red-600 border-red-200/60',
  },
  {
    code: 'en',
    label: 'English',
    badge: 'EN',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-200/60',
  },
];

export function getLocalizedPath(pathname: string, newLocale: SupportedLocale): string {
  const normalized = pathname || '/';
  const match = normalized.match(/^\/(vi|en)(\/.*|$)/);
  if (match) {
    const rest = match[2] || '';
    return `/${newLocale}${rest}`;
  }
  return `/${newLocale}${normalized === '/' ? '' : normalized}`;
}

function setLocaleCookie(code: SupportedLocale) {
  if (typeof document !== 'undefined') {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function AdminLanguageSwitcher({
  className,
  value,
  onChange,
}: AdminLanguageSwitcherProps) {
  const router = useRouter();
  const rawPathname = usePathname() || '/';

  const [internalLocale, setInternalLocale] = useState<SupportedLocale>('vi');
  const [open, setOpen] = useState(false);

  const currentLocale =
    value ??
    (rawPathname.startsWith('/en')
      ? 'en'
      : rawPathname.startsWith('/vi')
        ? 'vi'
        : internalLocale);

  const currentLang =
    LANGUAGES.find((l) => l.code === currentLocale) ?? LANGUAGES[0];

  function handleSelect(code: SupportedLocale) {
    if (value === undefined) {
      setInternalLocale(code);
    }
    setLocaleCookie(code);
    const localizedPath = getLocalizedPath(rawPathname, code);
    const search = typeof window !== 'undefined' && window.location.search ? window.location.search : '';
    const targetPath = `${localizedPath}${search}`;

    router.replace(targetPath);
    router.refresh();
    onChange?.(code);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Đổi ngôn ngữ (đang chọn: ${currentLang.label})`}
        render={
          <Button
            className={cn(
              'group inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-2.5 shadow-xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/20',
              className,
            )}
            variant="ghost"
          />
        }
      >
        <Languages
          size={16}
          className="text-slate-600 transition-colors group-hover:text-primary"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold tracking-wider text-slate-700">
          {currentLang.badge}
        </span>
        <ChevronDown
          size={12}
          className="text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-48 p-1 overflow-hidden rounded-xl border border-slate-200/90 shadow-xl"
      >
        <PopoverTitle className="sr-only">Lựa chọn ngôn ngữ</PopoverTitle>
        <PopoverDescription className="sr-only">
          Chuyển đổi giao diện giữa Tiếng Việt và English
        </PopoverDescription>
        <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Ngôn ngữ / Language
        </div>
        <div className="space-y-0.5" role="menu">
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLocale;
            return (
              <button
                key={lang.code}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors',
                  isSelected
                    ? 'bg-blue-50/70 font-semibold text-blue-900'
                    : 'text-slate-700 hover:bg-slate-100/80',
                )}
              >
                <span
                  className={cn(
                    'grid size-5.5 place-items-center rounded border text-[10px] font-bold',
                    lang.badgeClass,
                  )}
                  aria-hidden="true"
                >
                  {lang.badge}
                </span>
                <span className="flex-1 text-left">{lang.label}</span>
                {isSelected && (
                  <Check
                    size={14}
                    className="text-blue-600 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
