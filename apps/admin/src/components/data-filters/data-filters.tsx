'use client';

import { Popover } from '@base-ui/react/popover';
import { Select } from '@base-ui/react/select';
import { CalendarDays, Check, ChevronDown, Search, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { AdminResultSummary } from '@/components/admin/admin-result-summary';
import styles from './data-filters.module.css';

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
  totalItems: number | null;
};

export function FilterToolbar({ children, totalItems }: FilterToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.controls}>{children}</div>
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
          <Select.Value>
            {value
              ? options.find((option) => option.value === value)?.label ??
                'Không xác định'
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
  label: string;
  onApply: (value: DateRangeValue | null) => void;
  value: DateRangeValue | null;
};

function displayDate(date: string) {
  return date.split('-').reverse().join('/');
}

export function DateRangeFilter({ label, onApply, value }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const rangeIsValid = Boolean(
    draftFrom && draftTo && draftFrom <= draftTo,
  );

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

  return (
    <div className={styles.dateFilter}>
      <Popover.Root onOpenChange={handleOpenChange} open={open}>
        <Popover.Trigger
          aria-label={
            value
              ? `${label}: ${displayDate(value.from)} đến ${displayDate(value.to)}`
              : `Lọc theo ${label.toLocaleLowerCase()}`
          }
          className={styles.dateTrigger}
          data-active={Boolean(value)}
        >
          <CalendarDays aria-hidden="true" size={16} />
          <span className={styles.dateTriggerText}>
            {value
              ? `${displayDate(value.from)} – ${displayDate(value.to)}`
              : label}
          </span>
          <ChevronDown aria-hidden="true" size={15} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            align="end"
            className={styles.datePositioner}
            sideOffset={7}
          >
            <Popover.Popup className={styles.datePopup}>
              <Popover.Title className={styles.dateTitle}>
                Khoảng ngày tạo
              </Popover.Title>
              <Popover.Description className={styles.dateDescription}>
                Chọn ngày bắt đầu và kết thúc để lọc danh sách.
              </Popover.Description>
              <div className={styles.dateFields}>
                <label className={styles.dateField}>
                  <span>Từ ngày</span>
                  <input
                    max={draftTo || undefined}
                    onChange={(event) => setDraftFrom(event.target.value)}
                    type="date"
                    value={draftFrom}
                  />
                </label>
                <label className={styles.dateField}>
                  <span>Đến ngày</span>
                  <input
                    min={draftFrom || undefined}
                    onChange={(event) => setDraftTo(event.target.value)}
                    type="date"
                    value={draftTo}
                  />
                </label>
              </div>
              <div className={styles.dateActions}>
                <button
                  className={styles.clearDateButton}
                  disabled={!value && !draftFrom && !draftTo}
                  onClick={clearRange}
                  type="button"
                >
                  Xóa lọc
                </button>
                <button
                  className={styles.applyDateButton}
                  disabled={!rangeIsValid}
                  onClick={applyRange}
                  type="button"
                >
                  Áp dụng
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
