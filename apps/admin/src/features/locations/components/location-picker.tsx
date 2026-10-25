'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  SearchableCombobox,
  type SearchableOption,
} from '@/components/ui/searchable-combobox';
import { Button } from '@/components/ui/action-button';
import { getLocations } from '../services/location-service';

export function LocationPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [options, setOptions] = useState<SearchableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getLocations()
      .then((locations) => {
        if (!active) return;
        setOptions(
          locations.map((location) => ({
            id: location.id,
            value: location.value,
            label: location.name,
            keywords: location.aliases.join(' '),
            description: location.legacyNames?.length
              ? location.legacyNames.map((name) => `${name} - cũ`).join(', ')
              : (location.province ?? undefined),
          })),
        );
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
  return (
    <div className="space-y-2">
      <SearchableCombobox
        id={id}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-required="true"
        loading={loading}
        placeholder="Chọn địa điểm"
        icon={<MapPin />}
      />
      {error && (
        <div role="alert" className="text-xs text-destructive">
          {error}{' '}
          <Button
            variant="link"
            disabled={disabled || loading}
            onClick={() => {
              setError('');
              setLoading(true);
              setAttempt((current) => current + 1);
            }}
          >
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}
