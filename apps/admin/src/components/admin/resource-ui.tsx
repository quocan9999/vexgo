'use client';

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  LoaderCircle,
  Plus,
  RefreshCw,
  SearchX,
} from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/action-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/status-badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

export function ResourceSheet({
  children,
  title,
  description,
  busy = false,
  preventDismiss = false,
  onClose,
}: {
  children: ReactNode;
  title: string;
  description: string;
  busy?: boolean;
  preventDismiss?: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open, event) => {
        if (!open && preventDismiss) event.cancel();
        else if (!open) onClose();
      }}
    >
      <SheetContent aria-busy={busy} showCloseButton={!preventDismiss}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ResourceConfirmation({
  title,
  description,
  children,
  busy = false,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog
      open
      onOpenChange={(open, event) => {
        if (!open && busy) event.cancel();
        else if (!open) onClose();
      }}
    >
      <AlertDialogContent aria-busy={busy} initialFocus={cancelRef}>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        {children}
        <Button
          disabled={busy}
          onClick={onClose}
          ref={cancelRef}
          variant="outline"
        >
          Hủy
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResourceStatusBadge({
  tone,
  children,
}: {
  tone: 'active' | 'muted' | 'warning';
  children: ReactNode;
}) {
  return (
    <Badge
      variant={
        tone === 'active'
          ? 'success'
          : tone === 'warning'
            ? 'warning'
            : 'secondary'
      }
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </Badge>
  );
}

export function ResourceCreateAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus aria-hidden />
      {label}
    </Button>
  );
}

export function ResourceRefreshAction({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      aria-busy={loading}
      disabled={loading}
      onClick={onClick}
      variant="outline"
    >
      <RefreshCw
        aria-hidden
        className={loading ? 'motion-safe:animate-spin' : undefined}
      />
      Làm mới
    </Button>
  );
}

export function ResourceDetailAction({
  resourceName,
  onClick,
}: {
  resourceName: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={`Xem chi tiết ${resourceName}`}
      onClick={onClick}
      size="sm"
      variant="ghost"
    >
      <Eye aria-hidden />
      Xem chi tiết
    </Button>
  );
}

export function ResourceNotice({
  children,
  kind = 'success',
}: {
  children: ReactNode;
  kind?: 'success' | 'error' | 'info';
}) {
  const Icon =
    kind === 'error'
      ? CircleAlert
      : kind === 'success'
        ? CheckCircle2
        : CircleAlert;
  return (
    <Alert
      className={
        kind === 'success'
          ? 'border-[var(--admin-success-border)] bg-[var(--admin-status-success-soft)] text-[var(--admin-status-success)]'
          : ''
      }
      role={kind === 'error' ? 'alert' : 'status'}
      variant={kind === 'error' ? 'destructive' : 'default'}
    >
      <Icon aria-hidden />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}

export function ResourceState({
  children,
  error = false,
  loading = false,
}: {
  children: ReactNode;
  error?: boolean;
  loading?: boolean;
}) {
  const Icon = loading ? LoaderCircle : error ? CircleAlert : SearchX;
  return (
    <div
      className="grid min-h-52 place-content-center justify-items-center gap-4 p-6 text-center text-sm text-muted-foreground"
      role={error ? 'alert' : 'status'}
    >
      <Icon
        aria-hidden
        className={loading ? 'size-6 motion-safe:animate-spin' : 'size-7'}
      />
      {children}
    </div>
  );
}

export function ResourceTableSkeleton({
  resourceLabel,
}: {
  resourceLabel: string;
}) {
  return (
    <div
      className="space-y-5 p-5"
      role="status"
      aria-label={`Đang tải danh sách ${resourceLabel}`}
    >
      <span className="sr-only">Đang tải dữ liệu {resourceLabel}…</span>
      {Array.from({ length: 5 }, (_, row) => (
        <div
          aria-hidden
          key={row}
          className="grid grid-cols-3 gap-5 border-b pb-5 sm:grid-cols-5"
        >
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="hidden h-4 sm:block" />
          <Skeleton className="hidden h-4 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function ResourcePagination({
  currentPage,
  disabled = false,
  onPageChange,
  pageSize,
  summaryLabel,
  totalItems,
  totalPages,
}: {
  currentPage: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  summaryLabel: string;
  totalItems: number;
  totalPages: number;
}) {
  const count = Math.max(0, totalItems);
  const pages = Math.max(0, totalPages);
  const page = count && pages ? Math.min(Math.max(1, currentPage), pages) : 0;
  const first = page ? (page - 1) * Math.max(1, pageSize) + 1 : 0;
  const last = page ? Math.min(page * Math.max(1, pageSize), count) : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t p-4 text-[13px] text-muted-foreground sm:px-5">
      <span aria-live="polite">
        Hiển thị{' '}
        <strong className="text-foreground">
          {first}–{last}
        </strong>{' '}
        trong{' '}
        <strong className="text-foreground">
          {count.toLocaleString('vi-VN')}
        </strong>{' '}
        {summaryLabel}
      </span>
      <nav
        aria-label={`Phân trang ${summaryLabel}`}
        className="flex items-center gap-3"
      >
        <span>
          Trang <strong className="text-foreground">{page}</strong> / {pages}
        </span>
        <Button
          aria-label="Trang trước"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          size="icon-sm"
          variant="outline"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          aria-label="Trang sau"
          disabled={disabled || page >= pages}
          onClick={() => onPageChange(page + 1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronRight aria-hidden />
        </Button>
      </nav>
    </div>
  );
}
