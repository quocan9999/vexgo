import { describe, expect, it } from 'vitest';
import {
  mergeLocationCatalog,
  normalizeLocation,
  parseLocationCatalog,
} from '../../../src/locations/location-catalog.js';
import { locationSearchTerms } from '../../../src/locations/location-search.js';

describe('location catalogue', () => {
  it('shows Tây Ninh once with Long An as a secondary legacy name and searchable alias', () => {
    const current = parseLocationCatalog(
      [{ code: 80, name: 'Tỉnh Tây Ninh' }],
      'current',
    );
    const legacy = parseLocationCatalog(
      [
        { code: 72, name: 'Tỉnh Tây Ninh', districts: [] },
        { code: 80, name: 'Tỉnh Long An', districts: [] },
      ],
      'legacy',
    );
    const grouped = mergeLocationCatalog([...current, ...legacy], {
      data: [{ code: '80', merged_from: ['72', '80'] }],
    });
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      name: 'Tây Ninh',
      value: 'Tây Ninh',
      legacyNames: ['Long An'],
    });
    expect(grouped[0].aliases).toContain('Long An');
    expect(locationSearchTerms('Tây Ninh', grouped)).toEqual([
      'Tây Ninh',
      'Long An',
    ]);
    expect(locationSearchTerms('Long An', grouped)).toEqual(['Long An']);
  });

  it('rejects incomplete or ambiguous merger relationships instead of guessing a new parent', () => {
    const options = [
      ...parseLocationCatalog([{ code: 80, name: 'Tây Ninh' }], 'current'),
      ...parseLocationCatalog(
        [{ code: 80, name: 'Long An', districts: [] }],
        'legacy',
      ),
    ];
    expect(() => mergeLocationCatalog(options, { data: [] })).toThrow();
    expect(() =>
      mergeLocationCatalog(options, {
        data: [{ code: '80', merged_from: ['72'] }],
      }),
    ).toThrow();
    expect(() =>
      mergeLocationCatalog(options, {
        data: [{ code: '80', merged_from: ['80', '80'] }],
      }),
    ).toThrow();
  });

  it('keeps old and current provinces separate and retains former transport cities with their parent', () => {
    const legacy = parseLocationCatalog(
      [
        {
          code: 68,
          name: 'Tỉnh Lâm Đồng',
          districts: [
            { code: 672, name: 'Thành phố Đà Lạt', division_type: 'thành phố' },
            { code: 674, name: 'Huyện Lạc Dương', division_type: 'huyện' },
          ],
        },
      ],
      'legacy',
    );
    const current = parseLocationCatalog(
      [{ code: 68, name: 'Tỉnh Lâm Đồng' }],
      'current',
    );
    const result = mergeLocationCatalog([...current, ...legacy]);
    expect(result).toHaveLength(3);
    expect(
      result
        .filter((item) => item.value === 'Lâm Đồng')
        .map((item) => item.versions),
    ).toEqual([['current'], ['legacy']]);
    expect(result.find((item) => item.value === 'Đà Lạt')).toMatchObject({
      id: 'legacy:city:672',
      kind: 'city',
      province: 'Tỉnh Lâm Đồng',
      versions: ['legacy'],
    });
    expect(result.some((item) => item.name === 'Lạc Dương')).toBe(false);
  });

  it('preserves original aliases while keeping the existing TP.HCM route value', () => {
    const [item] = parseLocationCatalog(
      [{ code: 79, name: 'Thành phố Hồ Chí Minh' }],
      'current',
    );
    expect(item.value).toBe('TP.HCM');
    expect(item.aliases).toEqual([
      'Thành phố Hồ Chí Minh',
      'Hồ Chí Minh',
      'TP.HCM',
    ]);
    expect(normalizeLocation('TP.HCM')).toBe(
      normalizeLocation('Thành phố Hồ Chí Minh'),
    );
  });

  it.each([
    null,
    [],
    [{ code: '79', name: 'Hồ Chí Minh' }],
    [{ code: 79, name: '' }],
  ])(
    'rejects invalid or empty upstream data instead of presenting an empty successful catalogue',
    (raw) => {
      expect(() => parseLocationCatalog(raw, 'current')).toThrow();
    },
  );

  it('rejects incomplete legacy data rather than silently losing transport cities', () => {
    expect(() =>
      parseLocationCatalog([{ code: 68, name: 'Lâm Đồng' }], 'legacy'),
    ).toThrow('Missing legacy cities');
  });

  it('does not broaden Bình Dương or Đà Lạt into their parent/new province', () => {
    expect(locationSearchTerms('Bình Dương')).toEqual(['Bình Dương']);
    expect(locationSearchTerms('Thành phố Đà Lạt')).toEqual(['Đà Lạt']);
    expect(locationSearchTerms('Thành phố Hồ Chí Minh')).toContain('TP.HCM');
  });
});
