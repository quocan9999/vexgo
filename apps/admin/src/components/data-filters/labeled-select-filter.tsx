'use client';

import styles from './data-filters.module.css';

type LabeledSelectFilterProps = {
  label: string;
  accessibleLabel?: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function LabeledSelectFilter({
  label,
  accessibleLabel,
  value,
  options,
  onChange,
  disabled,
}: LabeledSelectFilterProps) {
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
