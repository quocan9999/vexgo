'use client';

import type { ChangeEvent, ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

type AdminMoneyInputProps = Omit<
  ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'inputMode'
> & {
  appearance?: 'resource';
  value: string;
  onValueChange: (value: string) => void;
};

function formatValue(value: string): string {
  const [whole = '', fraction] = value.split('.');
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
    (fraction === undefined ? '' : `,${fraction}`)
  );
}

export function AdminMoneyInput({
  value,
  onValueChange,
  appearance: _appearance,
  ...props
}: AdminMoneyInputProps) {
  // Consume the compatibility prop without forwarding it to the native input.
  void _appearance;
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const entered = input.value;
    const ungrouped = entered.replace(/[.\s]/g, '');
    if (!/^\d*(?:,\d{0,2})?$/.test(ungrouped)) return;

    const canonical = ungrouped.replace(/^0+(?=\d)/, '').replace(',', '.');
    const normalized = canonical.startsWith('.') ? `0${canonical}` : canonical;
    const significantBeforeCaret = entered
      .slice(0, input.selectionStart ?? entered.length)
      .replace(/[^\d,]/g, '').length;
    const formatted = formatValue(normalized);
    let caret = 0;
    let significant = 0;
    while (caret < formatted.length && significant < significantBeforeCaret) {
      if (/[\d,]/.test(formatted.charAt(caret))) significant += 1;
      caret += 1;
    }

    onValueChange(normalized);
    requestAnimationFrame(() => {
      if (input.isConnected && input.ownerDocument.activeElement === input) {
        input.setSelectionRange(caret, caret);
      }
    });
  }

  return (
    <Input
      {...props}
      inputMode="decimal"
      onChange={handleChange}
      type="text"
      value={formatValue(value)}
    />
  );
}
