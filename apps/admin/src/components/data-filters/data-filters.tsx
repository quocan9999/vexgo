'use client';

import { Popover } from '@base-ui/react/popover';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';

export { SingleDateFilter } from './single-date-filter';
export { LabeledSelectFilter } from './labeled-select-filter';

export type FilterOption = {
  value: string;
  label: string;
};

export type DateRangeValue = {
  from: string;
  to: string;
};

type DateRangeFilterProps = {
  emptyValueLabel?: string;
  appearance?: 'resource';
  fromLabel?: string;
  title?: string;
  label: string;
  onApply: (value: DateRangeValue | null) => void;
  toLabel?: string;
  value: Partial<DateRangeValue> | null;
};

export function DateRangeFilter({
  emptyValueLabel = 'Tất cả ngày',
  fromLabel = 'Từ ngày',
  label,
  title = 'Khoảng ngày tạo',
  onApply,
  toLabel = 'Đến ngày',
  value,
}: DateRangeFilterProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const rangeIsValid = Boolean(draftFrom && draftTo && draftFrom <= draftTo);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftFrom(value?.from ?? '');
      setDraftTo(value?.to ?? '');
    }
    setOpen(nextOpen);
  }

  function applyRange() {
    if (!rangeIsValid) return;
    onApply({ from: draftFrom, to: draftTo });
    setOpen(false);
  }

  function clearRange() {
    setDraftFrom('');
    setDraftTo('');
    onApply(null);
    setOpen(false);
  }

  const showDate = (date: string) => date.split('-').reverse().join('-');
  const selection =
    value?.from && value.to
      ? `${showDate(value.from)} – ${showDate(value.to)}`
      : value?.from
        ? `${fromLabel}: ${showDate(value.from)}`
        : value?.to
          ? `${toLabel}: ${showDate(value.to)}`
          : emptyValueLabel;
  return (
    <div className="min-w-0 flex-[1_1_200px]">
      <label
        htmlFor={`${id}-trigger`}
        className="mb-2 block text-[13px] font-semibold"
      >
        {label}
      </label>
      <Popover.Root onOpenChange={handleOpenChange} open={open}>
        <Popover.Trigger
          id={`${id}-trigger`}
          render={
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
            />
          }
          aria-label={`${label}: ${selection}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays aria-hidden className="size-4" />
            <span className="truncate">{selection}</span>
          </span>
          <ChevronDown aria-hidden className="size-4" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="end"
            sideOffset={8}
            className="z-50 outline-none"
          >
            <Popover.Popup className="admin-ui w-80 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border bg-popover p-4 text-popover-foreground shadow-md outline-none">
              <Popover.Title className="text-base font-semibold">
                {title}
              </Popover.Title>
              <Popover.Description className="text-xs text-muted-foreground">
                Chọn ngày bắt đầu và kết thúc để lọc danh sách.
              </Popover.Description>
              <Field>
                <FieldLabel htmlFor={`${id}-from`}>{fromLabel}</FieldLabel>
                <Input
                  id={`${id}-from`}
                  type="date"
                  max={draftTo || undefined}
                  value={draftFrom}
                  onChange={(event) => setDraftFrom(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-to`}>{toLabel}</FieldLabel>
                <Input
                  id={`${id}-to`}
                  type="date"
                  min={draftFrom || undefined}
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button
                  variant="outline"
                  disabled={!value && !draftFrom && !draftTo}
                  onClick={clearRange}
                >
                  Xóa lọc
                </Button>
                <Button disabled={!rangeIsValid} onClick={applyRange}>
                  Áp dụng
                </Button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
