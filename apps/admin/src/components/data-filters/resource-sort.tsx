'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import { SelectFilter, type FilterOption } from './resource-filters';

export function ResourceSortControls({
  label,
  value,
  options,
  direction,
  onFieldChange,
  onDirectionChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  direction: 'asc' | 'desc';
  onFieldChange?: (value: string) => void;
  onDirectionChange: () => void;
}) {
  return (
    <div className="flex items-end gap-3 border-b p-4 min-[901px]:hidden">
      {options.length > 1 ? (
        <SelectFilter
          label={label}
          value={value}
          options={options}
          allLabel={options[0]?.label ?? 'Mặc định'}
          onChange={(next) => {
            const field = next || options[0]?.value;
            if (field && field !== value) onFieldChange?.(field);
          }}
        />
      ) : (
        <div className="min-w-0 flex-1 space-y-2 text-[13px]">
          <p className="font-semibold">{label}</p>
          <p className="flex min-h-11 items-center text-muted-foreground sm:min-h-10">
            {options[0]?.label ?? 'Mặc định'}
          </p>
        </div>
      )}
      <Button
        variant="outline"
        onClick={onDirectionChange}
        aria-label={`Đổi thứ tự sắp xếp, hiện tại ${direction === 'asc' ? 'tăng dần' : 'giảm dần'}`}
      >
        {direction === 'asc' ? (
          <ArrowUp aria-hidden />
        ) : (
          <ArrowDown aria-hidden />
        )}
        {direction === 'asc' ? 'Tăng dần' : 'Giảm dần'}
      </Button>
    </div>
  );
}
