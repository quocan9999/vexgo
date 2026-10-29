'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Bus, Check, ChevronDown, LoaderCircle, MapPin, X } from 'lucide-react';
import { getLocations, type LocationOption } from '../services/locations.api';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

const label = (item: LocationOption) => item.name;

export function LocationPicker({
  id,
  value,
  onChange,
  placeholder = 'Chọn địa điểm',
  className = '',
  disabled = false,
  excludeValue,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  excludeValue?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getLocations(attempt > 0)
      .then(({ data, warning }) => {
        if (active) {
          setOptions(data);
          setError(warning);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải địa điểm.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const selected = useMemo(() => {
    return (
      options.find((item) => item.id === selectedId && item.value === value) ??
      options.find((item) => item.value === value) ??
      options.find((item) => item.name === value) ??
      (value
        ? ({
            id: 'existing',
            name: value,
            value,
            aliases: [value],
            versions: [],
            kind: 'city',
            province: null,
          } satisfies LocationOption)
        : null)
    );
  }, [options, selectedId, value]);

  const allItems = useMemo(() => {
    return selected?.id === 'existing' ? [selected, ...options] : options;
  }, [selected, options]);

  // Categorize options based on search query
  const query = searchQuery.trim();
  const normalizedQuery = normalize(query);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return allItems;
    return allItems.filter((item) =>
      normalize(
        `${item.name} ${item.value} ${item.aliases.join(' ')} ${item.province ?? ''} ${item.address ?? ''} ${item.mergedFromText ?? ''}`,
      ).includes(normalizedQuery),
    );
  }, [allItems, normalizedQuery]);

  const popularGroup = useMemo(() => {
    if (normalizedQuery) return [];
    return allItems.filter((item) => item.popular);
  }, [allItems, normalizedQuery]);

  const provinceGroup = useMemo(() => {
    if (!normalizedQuery) return [];
    return filteredItems.filter((item) => item.kind === 'province');
  }, [filteredItems, normalizedQuery]);

  const districtGroup = useMemo(() => {
    if (!normalizedQuery) return [];
    return filteredItems.filter(
      (item) => item.kind === 'district' || item.kind === 'city',
    );
  }, [filteredItems, normalizedQuery]);

  const stationGroup = useMemo(() => {
    if (!normalizedQuery) return [];
    return filteredItems.filter((item) => item.kind === 'station');
  }, [filteredItems, normalizedQuery]);

  const renderOption = (item: LocationOption, isPopular = false) => {
    const isExcluded = Boolean(excludeValue && item.value === excludeValue);
    const isStation = item.kind === 'station';

    return (
      <Combobox.Item
        key={`${isPopular ? 'pop:' : ''}${item.id}`}
        value={item}
        disabled={isExcluded}
        className="group/option flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors hover:bg-slate-50 data-highlighted:bg-brand/5 data-selected:bg-brand/8 data-selected:text-brand data-disabled:pointer-events-none data-disabled:opacity-40"
      >
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-xl border transition-colors ${
            isStation
              ? 'border-amber-200 bg-amber-50 text-amber-600'
              : isPopular
                ? 'border-brand/20 bg-brand/5 text-brand'
                : 'border-slate-200/70 bg-slate-50 text-slate-400 group-data-[selected]/option:border-brand/15 group-data-[selected]/option:bg-brand/10 group-data-[selected]/option:text-brand'
          }`}
        >
          {isStation ? (
            <Bus className="size-4" />
          ) : (
            <MapPin className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block font-semibold leading-snug">
              {item.name}
            </span>
            {item.isLegacy && (
              <span className="inline-flex items-center rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                CŨ
              </span>
            )}
          </span>
          {item.mergedFromText ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 line-clamp-1">
              {item.mergedFromText}
            </span>
          ) : (item.address || item.province) ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 line-clamp-1">
              {item.address ?? (item.province ? `Thuộc ${item.province}` : '')}
            </span>
          ) : null}
        </span>
        <Combobox.ItemIndicator className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
          <Check aria-hidden className="size-3.5" strokeWidth={2.5} />
        </Combobox.ItemIndicator>
      </Combobox.Item>
    );
  };

  return (
    <div className="w-full space-y-1.5">
      <Combobox.Root
        items={allItems}
        value={selected}
        disabled={disabled}
        itemToStringLabel={label}
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
            className="pointer-events-none absolute inset-y-0 left-3.5 z-10 flex items-center text-slate-400 transition-colors group-focus-within:text-brand"
          >
            {loading ? (
              <LoaderCircle className="size-4 motion-safe:animate-spin" />
            ) : (
              <MapPin className="size-4" />
            )}
          </span>
          <Combobox.Input
            id={inputId}
            aria-label={placeholder}
            aria-busy={loading}
            aria-describedby={error ? `${inputId}-error` : undefined}
            placeholder={loading ? 'Đang tải địa điểm…' : placeholder}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-20 text-sm font-semibold text-slate-900 shadow-xs outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-slate-400 hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-50 ${className}`}
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            {value && (
              <Combobox.Clear
                aria-label="Xóa địa điểm"
                onClick={() => {
                  setSelectedId('');
                  onChange('');
                  setSearchQuery('');
                }}
                className="grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X aria-hidden className="size-3.5" />
              </Combobox.Clear>
            )}
            <Combobox.Trigger
              aria-label="Mở danh sách địa điểm"
              className="group grid h-11 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronDown
                aria-hidden
                className="size-4 motion-safe:transition-transform group-aria-expanded:rotate-180"
              />
            </Combobox.Trigger>
          </div>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={8}
            collisionPadding={8}
            className="isolate z-[80]"
          >
            <Combobox.Popup className="max-h-[min(380px,var(--available-height))] w-(--anchor-width) min-w-[min(320px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-1.5 text-slate-900 shadow-xl ring-1 ring-slate-900/5 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:slide-in-from-top-1">
              <Combobox.Empty className="empty:hidden text-center text-sm leading-relaxed text-slate-500">
                <div className="px-4 py-6">
                  {loading
                    ? 'Đang tải địa điểm…'
                    : 'Không tìm thấy. Thử tên tỉnh, thành phố hoặc bến xe khác.'}
                </div>
              </Combobox.Empty>
              <Combobox.List className="space-y-2.5">
                {/* 1. Popular Locations (only when no search query) */}
                {popularGroup.length > 0 && (
                  <Combobox.Group>
                    <Combobox.GroupLabel className="flex items-center gap-2 px-3 pt-1.5 pb-1 text-sm font-bold text-brand">
                      <MapPin className="size-4" />
                      Địa điểm nổi bật
                    </Combobox.GroupLabel>
                    <div className="mt-0.5 space-y-1">
                      {popularGroup.map((item) => renderOption(item, true))}
                    </div>
                  </Combobox.Group>
                )}

                {/* 2. Provinces / Cities */}
                {provinceGroup.length > 0 && (
                  <Combobox.Group>
                    <Combobox.GroupLabel className="px-3 pt-1.5 pb-1 text-sm font-bold text-slate-600">
                      Tỉnh / Thành phố
                    </Combobox.GroupLabel>
                    <div className="mt-0.5 space-y-1">
                      {provinceGroup.map((item) => renderOption(item))}
                    </div>
                  </Combobox.Group>
                )}

                {/* 3. Key Districts / Towns */}
                {districtGroup.length > 0 && (
                  <Combobox.Group>
                    <Combobox.GroupLabel className="px-3 pt-2 pb-1 text-sm font-bold text-slate-600">
                      Quận / Huyện / TP trực thuộc
                    </Combobox.GroupLabel>
                    <div className="mt-0.5 space-y-1">
                      {districtGroup.map((item) => renderOption(item))}
                    </div>
                  </Combobox.Group>
                )}

                {/* 4. Major Stations */}
                {stationGroup.length > 0 && (
                  <Combobox.Group>
                    <Combobox.GroupLabel className="flex items-center gap-2 px-3 pt-2 pb-1 text-sm font-bold text-amber-600">
                      <Bus className="size-4" />
                      Bến xe / Điểm đón trả
                    </Combobox.GroupLabel>
                    <div className="mt-0.5 space-y-1">
                      {stationGroup.map((item) => renderOption(item))}
                    </div>
                  </Combobox.Group>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-xs text-rose-700"
        >
          {error}{' '}
          <button
            type="button"
            disabled={disabled || loading}
            className="underline"
            onClick={() => {
              setError('');
              setLoading(true);
              setAttempt((current) => current + 1);
            }}
          >
            Thử lại
          </button>
        </p>
      )}
    </div>
  );
}
