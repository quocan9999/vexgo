'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/action-button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

type LabeledSelectFilterProps = {
  appearance?: 'resource';
  label: string;
  accessibleLabel?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  sortDirection?: 'asc' | 'desc';
};

export function LabeledSelectFilter({
  label,
  accessibleLabel,
  value,
  options,
  onChange,
  disabled,
  sortDirection,
}: LabeledSelectFilterProps) {
  const id = useId();
  const DirectionIcon = sortDirection === 'asc' ? ArrowUp : ArrowDown;
  const directionLabel = sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';

  return (
    <div className="min-w-0 flex-[1_1_140px]">
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Select
          value={value}
          onValueChange={(next) => {
            if (next !== null) onChange(String(next));
          }}
        >
          <SelectTrigger
            id={id}
            disabled={disabled}
            aria-label={accessibleLabel ?? label}
            className="min-w-0 flex-1"
          >
            <SelectValue>
              {options.find((option) => option.value === value)?.label ??
                value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sortDirection && (
          <Button
            size="icon"
            variant="outline"
            disabled={disabled}
            aria-label={`Đổi chiều sắp xếp, hiện tại ${directionLabel.toLocaleLowerCase()}`}
            onClick={() => onChange(value)}
          >
            <DirectionIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );

}
