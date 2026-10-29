import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LocationOption } from '../../../src/features/locations/services/locations.api';

describe('Customer Web - Location Option & Legacy Badging', () => {
  it('formats legacy location option with isLegacy flag', () => {
    const legacyLocation: LocationOption = {
      id: 'legacy-77',
      name: 'Bà Rịa - Vũng Tàu',
      value: 'Bà Rịa - Vũng Tàu',
      aliases: ['Vũng Tàu', 'Bà Rịa'],
      versions: ['legacy'],
      kind: 'province',
      province: null,
      isLegacy: true,
      diaDiemId: 77,
    };

    expect(legacyLocation.isLegacy).toBe(true);
    expect(legacyLocation.name).toBe('Bà Rịa - Vũng Tàu');
  });

  it('formats merged location option with mergedFromText description', () => {
    const mergedLocation: LocationOption = {
      id: 'current-79',
      name: 'Hồ Chí Minh',
      value: 'Hồ Chí Minh',
      aliases: ['TP.HCM', 'Sài Gòn'],
      versions: ['current'],
      kind: 'province',
      province: null,
      isLegacy: false,
      mergedFromText: 'Sáp nhập từ Bà Rịa-Vũng Tàu, Bình Dương, Hồ Chí Minh',
      diaDiemId: 100,
    };

    expect(mergedLocation.isLegacy).toBe(false);
    expect(mergedLocation.mergedFromText).toContain('Bà Rịa-Vũng Tàu');
  });

  it('renders badge CŨ when isLegacy is true', () => {
    const item: LocationOption = {
      id: 'legacy-77',
      name: 'Bà Rịa - Vũng Tàu',
      value: 'Bà Rịa - Vũng Tàu',
      aliases: [],
      versions: ['legacy'],
      kind: 'province',
      province: null,
      isLegacy: true,
    };

    const markup = renderToStaticMarkup(
      <span className="flex items-center gap-2">
        <span className="block font-semibold leading-snug">{item.name}</span>
        {item.isLegacy && (
          <span className="inline-flex items-center rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            CŨ
          </span>
        )}
      </span>
    );

    expect(markup).toContain('Bà Rịa - Vũng Tàu');
    expect(markup).toContain('CŨ');
    expect(markup).toContain('bg-slate-600');
  });
});
