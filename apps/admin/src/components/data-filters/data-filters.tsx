'use client';

import { Popover } from '@base-ui/react/popover';
import { Select } from '@base-ui/react/select';
import { CalendarDays, Check, ChevronDown, Search, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { AdminResultSummary } from '@/components/admin/admin-result-summary';
import styles from './data-filters.module.css';

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

type FilterToolbarProps = {
  children: ReactNode;
  density?: 'compact' | 'default';
  totalItems: number | null;
};

export function FilterToolbar({
  children,
  density = 'default',
  totalItems,
}: FilterToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.controls} data-density={density}>
        {children}
      </div>
      <span aria-live="polite" className={styles.summary}>
        <AdminResultSummary totalItems={totalItems} />
      </span>
    </div>
  );
}

type SearchInputProps = {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

export function SearchInput({
  label,
  onChange,
  placeholder,
  value,
}: SearchInputProps) {
  const inputId = useId();

  return (
    <div className={styles.search}>
      <Search aria-hidden="true" className={styles.searchIcon} size={17} />
      <label className={styles.visuallyHidden} htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value && (
        <button
          aria-label="Xóa nội dung tìm kiếm"
          className={styles.clearSearch}
          onClick={() => onChange('')}
          type="button"
        >
          <X aria-hidden="true" size={15} />
        </button>
      )}
    </div>
  );
}

type SelectFilterProps = {
  allLabel?: string;
  label: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
};

const ALL_VALUE = '__all_filters__';

export function SelectFilter({
  allLabel = 'Tất cả',
  label,
  onChange,
  options,
  value,
}: SelectFilterProps) {
  return (
    <div className={styles.selectFilter}>
      <Select.Root
        onValueChange={(nextValue) =>
          onChange(nextValue === ALL_VALUE ? '' : String(nextValue ?? ''))
        }
        value={value || ALL_VALUE}
      >
        <Select.Trigger aria-label={label} className={styles.selectTrigger}>
          <Select.Value className={styles.selectValue}>
            {value
              ? (options.find((option) => option.value === value)?.label ??
                'Không xác định')
              : allLabel}
          </Select.Value>
          <Select.Icon>
            <ChevronDown aria-hidden="true" size={15} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="start"
            className={styles.selectPositioner}
            sideOffset={5}
          >
            <Select.Popup className={styles.selectPopup}>
              <Select.List>
                <Select.Item className={styles.selectItem} value={ALL_VALUE}>
                  <Select.ItemText>{allLabel}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check aria-hidden="true" size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
                {options.map((option) => (
                  <Select.Item
                    className={styles.selectItem}
                    key={option.value}
                    value={option.value}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check aria-hidden="true" size={14} />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

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
