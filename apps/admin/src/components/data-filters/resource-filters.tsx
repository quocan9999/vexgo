'use client';

import { Search, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type FilterOption = { value: string; label: string };

export function FilterToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-slate-50/40 p-3 sm:px-5 sm:py-3.5 transition-colors">
      {children}
    </div>
  );
}

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
  className,
  clearLabel = 'Xóa nội dung tìm kiếm',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  clearLabel?: string;
}) {
  const id = useId();
  return (
    <div className={className ?? 'min-w-0 flex-[2_1_260px]'}>
      <label
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="h-9.5 pl-9 pr-9 text-[13px] rounded-[var(--admin-radius-control)] bg-card border-border shadow-2xs focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:appearance-none"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        {value && (
          <Button
            aria-label={clearLabel}
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground"
            onClick={() => onChange('')}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function SelectFilter({
  label,
  allLabel = 'Tất cả',
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  allLabel?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const allValue = '__all_filters__';
  const selectedOption = options.find((option) => option.value === value);
  return (
    <div className={className ?? 'min-w-0 flex-[1_1_130px] sm:flex-[1_1_180px]'}>
      <label
        className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        htmlFor={id}
      >
        {label}
      </label>
      <Select
        onValueChange={(next) =>
          onChange(next === allValue ? '' : String(next ?? ''))
        }
        value={value || allValue}
      >
        <SelectTrigger
          aria-label={label}
          className="h-9.5 text-[13px] bg-card rounded-[var(--admin-radius-control)] border-border shadow-2xs"
          id={id}
        >
          <SelectValue>
            {selectedOption ? (
              <span className="font-medium text-foreground">{selectedOption.label}</span>
            ) : (
              <span className="text-muted-foreground">{allLabel}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectGroup>
            <SelectItem value={allValue}>{allLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
