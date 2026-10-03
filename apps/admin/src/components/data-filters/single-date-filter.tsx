'use client';

import { Popover } from '@base-ui/react/popover';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import styles from './data-filters.module.css';

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
  const formattedDate = value.split('-').reverse().join('/');

  return (
    <div className={`${styles.dateFilter} ${styles.singleDateFilter}`}>
      <Popover.Root onOpenChange={setOpen} open={open}>
        <Popover.Trigger
          aria-label={
            value
              ? `${label}: ${formattedDate}`
              : `Lọc theo ${label.toLocaleLowerCase()}`
          }
          className={styles.dateTrigger}
          data-active={Boolean(value)}
        >
          <CalendarDays aria-hidden="true" size={16} />
          <span className={styles.dateTriggerText}>
            {value ? formattedDate : label}
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
                {label}
              </Popover.Title>
              <Popover.Description className={styles.dateDescription}>
                Chọn một ngày để lọc danh sách.
              </Popover.Description>
              <label className={styles.dateField}>
                <span>{label}</span>
                <input
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    onChange(nextValue);
                    if (nextValue) setOpen(false);
                  }}
                  type="date"
                  value={value}
                />
              </label>
              <div className={styles.dateActions}>
                <button
                  className={styles.clearDateButton}
                  disabled={!value}
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  type="button"
                >
                  Xóa lọc
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
