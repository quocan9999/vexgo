'use client';

import { Popover } from '@base-ui/react/popover';
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import styles from './data-filters.module.css';

type LabeledSelectFilterProps = {
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
  const [open, setOpen] = useState(false);
  const DirectionIcon = sortDirection === 'asc' ? ArrowUp : ArrowDown;
  const directionLabel = sortDirection === 'asc' ? 'Tăng dần' : 'Giảm dần';

  if (sortDirection) {
    return (
      <div className={styles.labeledSelectFilter}>
        <span>{label}</span>
        <Popover.Root onOpenChange={setOpen} open={open}>
          <Popover.Trigger
            aria-label={`${accessibleLabel ?? label}: ${options.find((option) => option.value === value)?.label ?? value}, ${directionLabel}`}
            className={`${styles.selectTrigger} ${styles.labeledSortTrigger}`}
            disabled={disabled}
          >
            <span className={styles.selectValue}>
              {options.find((option) => option.value === value)?.label ?? value}
            </span>
            <DirectionIcon aria-hidden="true" size={16} />
            <ChevronDown aria-hidden="true" size={15} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner
              align="start"
              className={styles.selectPositioner}
              sideOffset={5}
            >
              <Popover.Popup className={styles.selectPopup}>
                <Popover.Title className={styles.visuallyHidden}>
                  {label}
                </Popover.Title>
                {options.map((option) => (
                  <button
                    aria-pressed={option.value === value}
                    className={`${styles.selectItem} ${styles.sortOption}`}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {option.label}
                    {option.value === value && (
                      <DirectionIcon aria-label={directionLabel} size={16} />
                    )}
                  </button>
                ))}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    );
  }

  return (
    <label className={styles.labeledSelectFilter}>
      <span>{label}</span>
      <select
        aria-label={accessibleLabel ?? label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
