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
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4 sm:p-5">
      {children}
    </div>
  );
}

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0 flex-[2_1_260px]">
      <label className="mb-2 block text-[13px] font-semibold" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="pl-9 pr-11 [&::-webkit-search-cancel-button]:appearance-none"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        {value && (
          <Button
            aria-label="Xóa nội dung tìm kiếm"
            className="absolute right-0.5 top-1/2 -translate-y-1/2"
            onClick={() => onChange('')}
            size="icon-sm"
            variant="ghost"
          >
            <X aria-hidden />
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
}: {
  label: string;
  allLabel?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const allValue = '__all_filters__';
  return (
    <div className="min-w-0 flex-[1_1_130px] sm:flex-[1_1_180px]">
      <label className="mb-2 block text-[13px] font-semibold" htmlFor={id}>
        {label}
      </label>
      <Select
        onValueChange={(next) =>
          onChange(next === allValue ? '' : String(next ?? ''))
        }
        value={value || allValue}
      >
        <SelectTrigger aria-label={label} id={id}>
          <SelectValue>
            {options.find((option) => option.value === value)?.label ??
              allLabel}
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
