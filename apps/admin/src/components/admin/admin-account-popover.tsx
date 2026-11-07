'use client';

import {
  ChevronDown,
  LoaderCircle,
  LogOut,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type AdminAccountPopoverProps = {
  className?: string;
  fullName: string;
  roleLabel: string;
  email?: string | null;
  phoneNumber?: string | null;
  onLogout?: () => void;
  signingOut?: boolean;
};

export function AdminAccountPopover({
  className,
  fullName,
  roleLabel,
  email,
  phoneNumber,
  onLogout,
  signingOut = false,
}: AdminAccountPopoverProps) {
  const initial = fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'V';

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Xem thông tin tài khoản ${fullName}`}
        render={
          <Button
            className={cn(
              'group inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-1 pl-1 pr-2.5 shadow-xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-primary/20',
              className,
            )}
            variant="ghost"
          />
        }
      >
        <div className="relative">
          <span
            role="img"
            aria-label={`Tài khoản ${fullName}`}
            className="grid size-8 place-items-center rounded-full border border-primary/10 bg-[var(--admin-blue-soft)] text-[13px] font-bold text-primary transition-transform group-hover:scale-105"
          >
            {initial}
          </span>
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-white"
          />
        </div>
        <ChevronDown
          aria-hidden="true"
          size={14}
          className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
        <span className="sr-only">{roleLabel}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-76 p-0 overflow-hidden rounded-xl border border-slate-200/90 shadow-xl"
      >
        <PopoverTitle className="sr-only">Thông tin tài khoản</PopoverTitle>
        <PopoverDescription className="sr-only">
          Họ tên, vai trò và đăng xuất tài khoản đang đăng nhập.
        </PopoverDescription>
        <div className="border-b border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-full border border-primary/10 bg-[var(--admin-blue-soft)] text-base font-bold text-primary shadow-xs"
              >
                {initial}
              </span>
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900" title={fullName}>
                {fullName}
              </p>
              <div className="mt-1">
                <span
                  className="inline-flex max-w-full truncate items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-700/10"
                  title={roleLabel}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          {(email || phoneNumber) && (
            <div className="mt-3 space-y-1 border-t border-slate-200/60 pt-2.5 text-xs text-muted-foreground">
              {email && (
                <div className="flex items-center gap-1.5 truncate" title={email}>
                  <Mail size={12} className="shrink-0 text-slate-400" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {phoneNumber && (
                <div className="flex items-center gap-1.5 truncate" title={phoneNumber}>
                  <Phone size={12} className="shrink-0 text-slate-400" />
                  <span>{phoneNumber}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1 p-2">
          {onLogout && (
            <Button
              className="h-9 w-full cursor-pointer justify-start gap-2 rounded-lg font-medium text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
              variant="ghost"
              disabled={signingOut}
              aria-busy={signingOut}
              onClick={onLogout}
            >
              {signingOut ? (
                <LoaderCircle size={15} className="motion-safe:animate-spin" />
              ) : (
                <LogOut size={15} />
              )}
              <span>{signingOut ? 'Đang thoát…' : 'Đăng xuất'}</span>
            </Button>
          )}
          <PopoverClose
            render={
              <Button
                className="h-8 w-full shrink-0 cursor-pointer text-xs text-slate-600"
                variant="outline"
              />
            }
          >
            Đóng
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
