'use client';

import { useEffect, useId, useState } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Check, ChevronDown, LoaderCircle, MapPin, X } from 'lucide-react';
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
  const selected =
    options.find((item) => item.id === selectedId && item.value === value) ??
    options.find((item) => item.value === value) ??
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
      : null);
  const items = selected?.id === 'existing' ? [selected, ...options] : options;
  return (
    <div className="w-full space-y-1.5">
      <Combobox.Root
        items={items}
        value={selected}
        disabled={disabled}
        itemToStringLabel={label}
        isItemEqualToValue={(a, b) => a.id === b.id}
        filter={(item, query) =>
          normalize(
            `${label(item)} ${item.aliases.join(' ')} ${item.province ?? ''}`,
          ).includes(normalize(query.trim()))
        }
        onValueChange={(item) => {
          setSelectedId(item?.id ?? '');
          onChange(item?.value ?? '');
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
            className={`h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-20 text-sm font-semibold text-slate-900 shadow-xs outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-slate-400 hover:border-brand/40 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:opacity-50 ${className}`}
          />
          <div className="absolute inset-y-0 right-1 flex items-center">
            {value && (
              <Combobox.Clear
                aria-label="Xóa địa điểm"
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
            <Combobox.Popup className="max-h-[min(360px,var(--available-height))] w-(--anchor-width) min-w-[min(280px,calc(100vw-24px))] max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/80 bg-white p-2 text-slate-900 shadow-lg ring-1 ring-slate-900/5 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-open:slide-in-from-top-1">
              <Combobox.Empty className="px-4 py-6 text-center text-sm leading-relaxed text-slate-500">
                {loading
                  ? 'Đang tải địa điểm…'
                  : 'Không tìm thấy. Thử tên tỉnh hoặc thành phố khác.'}
              </Combobox.Empty>
              <Combobox.List className="space-y-1">
                {(item: LocationOption) => (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    disabled={item.value === excludeValue}
                    className="group/option flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm outline-none transition-colors hover:bg-slate-50 data-highlighted:bg-brand/5 data-selected:bg-brand/8 data-selected:text-brand data-disabled:pointer-events-none data-disabled:opacity-40"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200/70 bg-slate-50 text-slate-400 group-data-[selected]/option:border-brand/15 group-data-[selected]/option:bg-brand/10 group-data-[selected]/option:text-brand"
                    >
                      <MapPin className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug">
                        {label(item)}
                      </span>
                      {(item.legacyNames?.length || item.province) && (
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                          {item.legacyNames?.length
                            ? item.legacyNames
                                .map((name) => `${name} - cũ`)
                                .join(', ')
                            : item.province}
                        </span>
                      )}
                    </span>
                    <Combobox.ItemIndicator className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
                      <Check
                        aria-hidden
                        className="size-3.5"
                        strokeWidth={2.5}
                      />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
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
