'use client';

import { Popover } from '@base-ui/react/popover';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';

type SingleDateFilterProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function SingleDateFilter({
  label,
  onChange,
  value,
}: SingleDateFilterProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const formattedDate = value.split('-').reverse().join('-');
  return (
    <div className="min-w-0 flex-[1_1_180px]">
      <label
        htmlFor={`${id}-trigger`}
        className="mb-2 block text-[13px] font-semibold"
      >
        {label}
      </label>
      <Popover.Root onOpenChange={setOpen} open={open}>
        <Popover.Trigger
          id={`${id}-trigger`}
          render={
            <Button
              variant="outline"
              className="w-full justify-between font-normal"
            />
          }
          aria-label={
            value
              ? `${label}: ${formattedDate}`
              : `Lọc theo ${label.toLocaleLowerCase()}`
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays aria-hidden className="size-4" />
            <span className="truncate">
              {value ? formattedDate : 'Tất cả ngày'}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="end"
            sideOffset={8}
            className="z-50 outline-none"
          >
            <Popover.Popup className="admin-ui w-72 max-w-[calc(100vw-2rem)] space-y-4 rounded-xl border bg-popover p-4 text-popover-foreground shadow-md outline-none">
              <Popover.Title className="text-sm font-semibold">
                {label}
              </Popover.Title>
              <Popover.Description className="sr-only">
                Chọn một ngày để lọc danh sách.
              </Popover.Description>
              <Field>
                <FieldLabel htmlFor={`${id}-date`}>{label}</FieldLabel>
                <Input
                  id={`${id}-date`}
                  type="date"
                  value={value}
                  onChange={(event) => {
                    const next = event.target.value;
                    onChange(next);
                    if (next) setOpen(false);
                  }}
                />
              </Field>
              <Button
                variant="outline"
                className="w-full"
                disabled={!value}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                Xóa lọc
              </Button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
