'use client';

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
};

export function AdminAccountPopover({
  className,
  fullName,
  roleLabel,
}: AdminAccountPopoverProps) {
  const initial = fullName.trim().charAt(0).toLocaleUpperCase('vi-VN') || 'V';

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Xem thông tin tài khoản ${fullName}`}
        render={
          <Button
            className={cn('cursor-pointer rounded-full', className)}
            size="icon-lg"
            variant="ghost"
          />
        }
      >
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-full border border-primary/10 bg-[var(--admin-blue-soft)] text-[13px] font-semibold text-primary"
        >
          {initial}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverTitle>Thông tin tài khoản</PopoverTitle>
        <PopoverDescription className="sr-only">
          Họ tên và vai trò của tài khoản đang đăng nhập.
        </PopoverDescription>
        <dl className="min-w-0 shrink-0 space-y-4 text-[13px] leading-normal">
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Họ và tên</dt>
            <dd className="font-semibold break-words">{fullName}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs text-muted-foreground">Vai trò</dt>
            <dd className="break-words">{roleLabel}</dd>
          </div>
        </dl>
        <PopoverClose
          render={
            <Button className="w-full shrink-0 cursor-pointer" variant="outline" />
          }
        >
          Đóng
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
