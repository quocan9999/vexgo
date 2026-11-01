'use client';

import { useMemo, useState, type AriaAttributes, type ReactNode } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Bus, Check, ChevronDown, LoaderCircle, MapPin, Plus, Search } from 'lucide-react';
import { Input } from './input';

export type SearchableOption = {
  id: string;
  value: string;
  label: string;
  keywords?: string;
  description?: string;
  group?: 'province' | 'district' | 'station' | string;
  icon?: ReactNode;
  badge?: string;
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
  excludeValue,
  allowCustom = true,
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
  excludeValue?: string;
  allowCustom?: boolean;
} & Pick<
  AriaAttributes,
  'aria-invalid' | 'aria-describedby' | 'aria-required'
>) {
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const selected = useMemo(() => {
    return (
      options.find(
        (option) => option.id === selectedId && option.value === value,
      ) ??
      options.find((option) => option.value === value) ??
      options.find((option) => option.label === value) ??
      (value ? { id: 'existing', value, label: value } : null)
    );
  }, [options, selectedId, value]);

  const query = searchQuery.trim();
  const normalizedQuery = normalize(query);

  const allItems = useMemo(() => {
    const list = selected?.id === 'existing' ? [selected, ...options] : [...options];
    if (allowCustom && query && !options.some((o) => normalize(o.value) === normalizedQuery || normalize(o.label) === normalizedQuery)) {
      list.unshift({
        id: `custom:${query}`,
        value: query,
        label: `Sử dụng "${query}" làm điểm mới`,
        keywords: query,
        group: 'custom',
      });
    }
    return list;
  }, [selected, options, allowCustom, query, normalizedQuery]);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return allItems;
    return allItems.filter((item) =>
      item.id.startsWith('custom:') ||
      normalize(`${item.label} ${item.value} ${item.keywords ?? ''} ${item.description ?? ''}`).includes(
        normalizedQuery,
      ),
    );
  }, [allItems, normalizedQuery]);

  const provinceGroup = useMemo(() => {
    return filteredItems.filter((item) => item.group === 'province');
  }, [filteredItems]);

  const districtGroup = useMemo(() => {
    return filteredItems.filter((item) => item.group === 'district');
  }, [filteredItems]);

  const stationGroup = useMemo(() => {
    return filteredItems.filter((item) => item.group === 'station');
  }, [filteredItems]);

  const otherGroup = useMemo(() => {
    return filteredItems.filter((item) =>
      item.id.startsWith('custom:') ||
      (!item.group && item.id !== 'existing') ||
      (item.group && !['province', 'district', 'station'].includes(item.group))
    );
  }, [filteredItems]);

  const renderItem = (item: SearchableOption) => {
    const isExcluded = Boolean(excludeValue && item.value === excludeValue);
    const isStation = item.group === 'station';
    const isCustom = item.id.startsWith('custom:');

    return (
      <Combobox.Item
        key={item.id}
        value={item}
        disabled={isExcluded}
        className="group/option flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors hover:bg-muted/70 data-highlighted:bg-primary/5 data-selected:bg-primary/8 data-selected:text-primary data-disabled:opacity-40 data-disabled:pointer-events-none"
      >
        <span
          aria-hidden
          className={`grid size-8 shrink-0 place-items-center rounded-lg border transition-colors ${
            isCustom
              ? 'border-primary/30 bg-primary/10 text-primary'
              : isStation
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-border/60 bg-muted/60 text-muted-foreground group-data-[selected]/option:border-primary/15 group-data-[selected]/option:bg-primary/10 group-data-[selected]/option:text-primary'
          } [&_svg]:size-4`}
        >
          {isCustom ? (
            <Plus />
          ) : isStation ? (
            <Bus />
          ) : (
            (item.icon ?? icon ?? <MapPin />)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold leading-snug">
            <span>{item.label}</span>
            {item.badge && (
              <span className="inline-flex items-center rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                {item.badge}
              </span>
            )}
          </span>
          {item.description && (
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground line-clamp-1">
              {item.description}
            </span>
          )}
        </span>
        <Combobox.ItemIndicator className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
        </Combobox.ItemIndicator>
      </Combobox.Item>
    );
  };

  return (
    <Combobox.Root
      items={allItems}
      value={selected}
      disabled={disabled}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      onValueChange={(item) => {
        setSelectedId(item?.id ?? '');
        onChange(item?.value ?? '');
        setSearchQuery('');
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
          onChange={(e) => setSearchQuery(e.target.value)}
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
          <Combobox.Popup className="max-h-[min(380px,var(--available-height))] w-(--anchor-width) min-w-[min(280px,calc(100vw-32px))] max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-[var(--admin-radius-panel)] border border-border/80 bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/5 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:slide-in-from-top-1">
            <Combobox.Empty className="empty:hidden text-center text-sm leading-relaxed text-muted-foreground">
              <div className="px-4 py-6">
                {loading
                  ? 'Đang tải địa điểm…'
                  : 'Không tìm thấy. Bạn có thể nhấn để tạo điểm mới.'}
              </div>
            </Combobox.Empty>
            <Combobox.List className="space-y-2.5">
              {/* Custom New Option */}
              {otherGroup.length > 0 && (
                <div className="space-y-1">
                  {otherGroup.map((item) => renderItem(item))}
                </div>
              )}

              {/* 1. Provinces */}
              {provinceGroup.length > 0 && (
                <Combobox.Group>
                  <Combobox.GroupLabel className="px-3 pt-1.5 pb-1 text-sm font-bold text-muted-foreground">
                    Tỉnh / Thành phố
                  </Combobox.GroupLabel>
                  <div className="mt-0.5 space-y-1">
                    {provinceGroup.map((item) => renderItem(item))}
                  </div>
                </Combobox.Group>
              )}

              {/* 2. Key Districts */}
              {districtGroup.length > 0 && (
                <Combobox.Group>
                  <Combobox.GroupLabel className="px-3 pt-2 pb-1 text-sm font-bold text-muted-foreground">
                    Quận / Huyện / TP trực thuộc
                  </Combobox.GroupLabel>
                  <div className="mt-0.5 space-y-1">
                    {districtGroup.map((item) => renderItem(item))}
                  </div>
                </Combobox.Group>
              )}

              {/* 3. Major Stations */}
              {stationGroup.length > 0 && (
                <Combobox.Group>
                  <Combobox.GroupLabel className="flex items-center gap-2 px-3 pt-2 pb-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                    <Bus className="size-4" />
                    Bến xe / Điểm đón trả
                  </Combobox.GroupLabel>
                  <div className="mt-0.5 space-y-1">
                    {stationGroup.map((item) => renderItem(item))}
                  </div>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
