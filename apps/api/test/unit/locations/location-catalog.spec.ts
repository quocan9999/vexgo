import { describe, expect, it } from 'vitest';
import {
  mergeLocationCatalog,
  normalizeLocation,
  parseLocationCatalog,
  type LocationOption,
} from '../../../src/locations/location-catalog.js';
import {
  locationSearchTerms,
  locationSearchTermsForOption,
} from '../../../src/locations/location-search.js';

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

  describe('locationSearchTermsForOption with coexisting old and new records', () => {
    const mixedCatalogue: LocationOption[] = [
      // TP.HCM
      {
        id: 'legacy:province:79',
        name: 'Hồ Chí Minh',
        value: 'TP.HCM',
        aliases: ['Thành phố Hồ Chí Minh', 'TP.HCM', 'Hồ Chí Minh'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 84,
      },
      {
        id: 'legacy:province:74',
        name: 'Bình Dương',
        value: 'Bình Dương',
        aliases: ['Tỉnh Bình Dương', 'Bình Dương', 'Thủ Dầu Một'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 81,
      },
      {
        id: 'legacy:province:77',
        name: 'Bà Rịa - Vũng Tàu',
        value: 'Bà Rịa - Vũng Tàu',
        aliases: ['Tỉnh Bà Rịa - Vũng Tàu', 'Bà Rịa - Vũng Tàu'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 83,
      },
      {
        id: 'current:province:79',
        name: 'Hồ Chí Minh',
        value: 'TP.HCM',
        aliases: ['Thành phố Hồ Chí Minh', 'TP.HCM', 'Hồ Chí Minh'],
        versions: ['current'],
        kind: 'province',
        province: null,
        isLegacy: false,
        legacyNames: ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
        diaDiemId: 28,
      },

      // Tây Ninh & Long An
      {
        id: 'legacy:province:72',
        name: 'Tây Ninh',
        value: 'Tây Ninh',
        aliases: ['Tỉnh Tây Ninh', 'Tây Ninh'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 80,
      },
      {
        id: 'legacy:province:80',
        name: 'Long An',
        value: 'Long An',
        aliases: ['Tỉnh Long An', 'Long An'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 85,
      },
      {
        id: 'current:province:80',
        name: 'Tây Ninh',
        value: 'Tây Ninh',
        aliases: ['Tỉnh Tây Ninh', 'Tây Ninh'],
        versions: ['current'],
        kind: 'province',
        province: null,
        isLegacy: false,
        legacyNames: ['Tây Ninh', 'Long An'],
        diaDiemId: 29,
      },

      // Lào Cai & Yên Bái (code 15)
      {
        id: 'legacy:province:15',
        name: 'Yên Bái',
        value: 'Yên Bái',
        aliases: ['Tỉnh Yên Bái', 'Yên Bái'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 44,
      },
      {
        id: 'legacy:province:10',
        name: 'Lào Cai',
        value: 'Lào Cai',
        aliases: ['Tỉnh Lào Cai', 'Lào Cai'],
        versions: ['legacy'],
        kind: 'province',
        province: null,
        isLegacy: true,
        diaDiemId: 40,
      },
      {
        id: 'current:province:15',
        name: 'Lào Cai',
        value: 'Lào Cai',
        aliases: ['Tỉnh Lào Cai', 'Lào Cai'],
        versions: ['current'],
        kind: 'province',
        province: null,
        isLegacy: false,
        legacyNames: ['Lào Cai', 'Yên Bái'],
        diaDiemId: 7,
      },
    ];

    it('TP.HCM: legacy option returns ONLY TP.HCM terms; new option returns TP.HCM + constituent provinces', () => {
      const oldHcm = mixedCatalogue.find((c) => c.diaDiemId === 84)!;
      const newHcm = mixedCatalogue.find((c) => c.diaDiemId === 28)!;

      const oldTerms = locationSearchTermsForOption(oldHcm, mixedCatalogue);
      expect(oldTerms).toContain('TP.HCM');
      expect(oldTerms).toContain('Hồ Chí Minh');
      expect(oldTerms).not.toContain('Bình Dương');
      expect(oldTerms).not.toContain('Bà Rịa - Vũng Tàu');
      expect(oldTerms).not.toContain('Thủ Dầu Một');

      const newTerms = locationSearchTermsForOption(newHcm, mixedCatalogue);
      expect(newTerms).toContain('TP.HCM');
      expect(newTerms).toContain('Hồ Chí Minh');
      expect(newTerms).toContain('Bình Dương');
      expect(newTerms).toContain('Bà Rịa - Vũng Tàu');
      expect(newTerms).toContain('Thủ Dầu Một');
    });

    it('Tây Ninh: legacy option returns ONLY Tây Ninh; new option returns Tây Ninh + Long An', () => {
      const oldTayNinh = mixedCatalogue.find((c) => c.diaDiemId === 80)!;
      const newTayNinh = mixedCatalogue.find((c) => c.diaDiemId === 29)!;

      const oldTerms = locationSearchTermsForOption(oldTayNinh, mixedCatalogue);
      expect(oldTerms).toContain('Tây Ninh');
      expect(oldTerms).not.toContain('Long An');

      const newTerms = locationSearchTermsForOption(newTayNinh, mixedCatalogue);
      expect(newTerms).toContain('Tây Ninh');
      expect(newTerms).toContain('Long An');
    });

    it('Lào Cai & Yên Bái (code 15): legacy Yên Bái (id 44) returns ONLY Yên Bái; new Lào Cai (id 7) returns both Lào Cai & Yên Bái', () => {
      const oldYenBai = mixedCatalogue.find((c) => c.diaDiemId === 44)!;
      const oldLaoCai = mixedCatalogue.find((c) => c.diaDiemId === 40)!;
      const newLaoCai = mixedCatalogue.find((c) => c.diaDiemId === 7)!;

      const yenBaiTerms = locationSearchTermsForOption(oldYenBai, mixedCatalogue);
      expect(yenBaiTerms).toContain('Yên Bái');
      expect(yenBaiTerms).not.toContain('Lào Cai');

      const oldLaoCaiTerms = locationSearchTermsForOption(oldLaoCai, mixedCatalogue);
      expect(oldLaoCaiTerms).toContain('Lào Cai');
      expect(oldLaoCaiTerms).not.toContain('Yên Bái');

      const newLaoCaiTerms = locationSearchTermsForOption(newLaoCai, mixedCatalogue);
      expect(newLaoCaiTerms).toContain('Lào Cai');
      expect(newLaoCaiTerms).toContain('Yên Bái');
    });
  });
});
