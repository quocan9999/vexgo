'use client';

import { useState, type AriaAttributes, type ReactNode } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react';
import { Input } from './input';

export type SearchableOption = {
  id: string;
  value: string;
  label: string;
  keywords?: string;
  description?: string;
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

export function SearchableCombobox({
  id,
  value,
  options,
  onChange,
  disabled,
  loading,
  placeholder,
  icon,
  ...aria
}: {
  id: string;
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  icon?: ReactNode;
} & Pick<
  AriaAttributes,
  'aria-invalid' | 'aria-describedby' | 'aria-required'
>) {
  const [selectedId, setSelectedId] = useState('');
  const selected =
    options.find(
      (option) => option.id === selectedId && option.value === value,
    ) ??
    options.find((option) => option.value === value) ??
    (value ? { id: 'existing', value, label: value } : null);
  const items = selected?.id === 'existing' ? [selected, ...options] : options;
  return (
    <Combobox.Root
      items={items}
      value={selected}
      disabled={disabled}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      filter={(item, query) =>
        normalize(`${item.label} ${item.keywords ?? ''}`).includes(
          normalize(query.trim()),
        )
      }
      onValueChange={(item) => {
        setSelectedId(item?.id ?? '');
        onChange(item?.value ?? '');
      }}
    >
      <div className="group relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary [&_svg]:size-4"
        >
          {loading ? (
            <LoaderCircle className="motion-safe:animate-spin" />
          ) : (
            (icon ?? <Search />)
          )}
        </span>
        <Combobox.Input
          id={id}
          render={<Input />}
          className="bg-background pl-10 pr-10 shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:border-primary"
          {...aria}
          aria-busy={loading}
          placeholder={loading ? 'Đang tải địa điểm…' : placeholder}
        />
        <Combobox.Trigger
          aria-label="Mở danh sách địa điểm"
          className="group absolute right-0 top-0 grid h-full w-10 place-items-center rounded-[var(--admin-radius-control)] text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <ChevronDown
            aria-hidden
            className="size-4 motion-safe:transition-transform group-aria-expanded:rotate-180"
          />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner
          sideOffset={8}
          collisionPadding={8}
          className="admin-ui isolate z-[80]"
        >
          <Combobox.Popup className="max-h-[min(360px,var(--available-height))] w-(--anchor-width) min-w-[min(280px,calc(100vw-32px))] max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-[var(--admin-radius-panel)] border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/5 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:slide-in-from-top-1">
            <Combobox.Empty className="px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
              {loading
                ? 'Đang tải địa điểm…'
                : 'Không tìm thấy. Thử tên tỉnh hoặc thành phố khác.'}
            </Combobox.Empty>
            <Combobox.List className="space-y-1">
              {(item: SearchableOption) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="group/option flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm outline-none transition-colors hover:bg-muted/70 data-highlighted:bg-primary/5 data-selected:bg-primary/8 data-selected:text-primary"
                >
                  {icon && (
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/60 bg-muted/60 text-muted-foreground group-data-[selected]/option:border-primary/15 group-data-[selected]/option:bg-primary/10 group-data-[selected]/option:text-primary [&_svg]:size-4"
                    >
                      {icon}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                  </span>
                  <Combobox.ItemIndicator className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
