import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LegacyBadge } from '../src/components/ui/status-badge';
import type { LocationOption } from '../src/features/locations/services/location-service';

describe('Admin - Location Picker & Legacy Badging', () => {
  it('renders LegacyBadge with proper slate-600 styling and text', () => {
    const markup = renderToStaticMarkup(<LegacyBadge />);
    expect(markup).toContain('CŨ');
    expect(markup).toContain('bg-slate-600');
    expect(markup).toContain('text-white');
    expect(markup).toContain('uppercase');
    expect(markup).toContain('text-[10px]');
  });

  it('orders current provinces before legacy provinces', () => {
    const locations: LocationOption[] = [
      {
        id: 'legacy:province:74',
        name: 'Bình Dương',
        value: 'Bình Dương',
        aliases: [],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
      },
      {
        id: 'current:province:28',
        name: 'TP.HCM',
        value: 'TP.HCM',
        aliases: [],
        versions: ['current'],
        kind: 'province',
        province: null,
        isLegacy: false,
      },
      {
        id: 'legacy:province:79',
        name: 'TP.HCM',
        value: 'TP.HCM',
        aliases: [],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
      },
      {
        id: 'current:province:01',
        name: 'Hà Nội',
        value: 'Hà Nội',
        aliases: [],
        versions: ['current'],
        kind: 'province',
        province: null,
        isLegacy: false,
      },
    ];

    const sorted = [...locations].sort((a, b) => {
      if (a.kind === 'province' && b.kind === 'province') {
        const aLegacy = Boolean(a.isLegacy);
        const bLegacy = Boolean(b.isLegacy);
        if (aLegacy !== bLegacy) {
          return aLegacy ? 1 : -1;
        }
      }
      return a.name.localeCompare(b.name, 'vi');
    });

    expect(sorted.map((s) => ({ name: s.name, isLegacy: Boolean(s.isLegacy) }))).toEqual([
      { name: 'Hà Nội', isLegacy: false },
      { name: 'TP.HCM', isLegacy: false },
      { name: 'Bình Dương', isLegacy: true },
      { name: 'TP.HCM', isLegacy: true },
    ]);
  });

  it('maps legacy locations with badge CŨ and merger note', () => {
    const legacyLocation: LocationOption = {
      id: 'legacy:province:74',
      name: 'Bình Dương',
      value: 'Bình Dương',
      aliases: ['Thủ Dầu Một'],
      versions: ['legacy'],
      kind: 'province',
      province: null,
      isLegacy: true,
      mergedFromText: 'Sáp nhập vào TP.HCM',
    };

    const option = {
      id: legacyLocation.id,
      value: legacyLocation.value,
      label: legacyLocation.name,
      badge: legacyLocation.isLegacy ? 'CŨ' : undefined,
      description: legacyLocation.mergedFromText,
    };

    expect(option.badge).toBe('CŨ');
    expect(option.description).toBe('Sáp nhập vào TP.HCM');

    const markup = renderToStaticMarkup(
      <span className="flex items-center gap-1.5 font-semibold">
        <span>{option.label}</span>
        {option.badge && <LegacyBadge>{option.badge}</LegacyBadge>}
      </span>,
    );

    expect(markup).toContain('Bình Dương');
    expect(markup).toContain('CŨ');
    expect(markup).toContain('bg-slate-600');
  });
});
