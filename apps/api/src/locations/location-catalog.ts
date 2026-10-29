export type LocationKind = 'province' | 'city' | 'district' | 'station';

export type LocationOption = {
  id: string;
  name: string;
  value: string;
  aliases: string[];
  versions: ('current' | 'legacy')[];
  kind: LocationKind;
  province: string | null;
  legacyNames?: string[];
  popular?: boolean;
  address?: string;
  parentName?: string;
  isLegacy?: boolean;
  mergedFromText?: string | null;
  diaDiemId?: number;
};

export function normalizeLocation(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[.]/g, ' ')
    .replace(/^(tinh|thanh pho|tp|thi xa)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized === 'hcm' || normalized === 'ho chi minh'
    ? 'ho chi minh'
    : normalized;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate upstream at the boundary; a partial/malformed catalogue is never cached. */
export function parseLocationCatalog(
  raw: unknown,
  version: 'current' | 'legacy',
): LocationOption[] {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new Error('Empty location catalogue');
  const result: LocationOption[] = [];
  function add(
    unit: unknown,
    kind: 'province' | 'city',
    province: string | null,
  ) {
    if (
      !record(unit) ||
      !Number.isSafeInteger(unit.code) ||
      typeof unit.name !== 'string' ||
      !unit.name.trim()
    ) {
      throw new Error('Invalid location catalogue');
    }
    const name = unit.name.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim();
    const value = normalizeLocation(name) === 'ho chi minh' ? 'TP.HCM' : name;
    result.push({
      id: `${version}:${kind}:${String(unit.code)}`,
      name,
      value,
      aliases: [...new Set([unit.name, name, value])],
      versions: [version],
      kind,
      province,
    });
  }
  for (const province of raw) {
    add(province, 'province', null);
    if (version === 'legacy') {
      if (!record(province) || !Array.isArray(province.districts))
        throw new Error('Missing legacy cities');
      for (const district of province.districts) {
        if (!record(district) || typeof district.division_type !== 'string')
          throw new Error('Invalid legacy district');
        if (
          district.division_type === 'thành phố' ||
          district.division_type === 'thị xã'
        ) {
          add(district, 'city', String(province.name));
        }
      }
    }
  }
  return result;
}

/** Deduplicate within a version; retain old/new entries and never infer merged geography. */
export function mergeLocationCatalog(
  options: LocationOption[],
  mergerData?: unknown,
): LocationOption[] {
  if (mergerData !== undefined)
    return groupCurrentLocations(options, mergerData);
  const merged = new Map<string, LocationOption>();
  for (const option of options) {
    const key = `${option.versions[0]}:${option.kind}:${normalizeLocation(option.name)}:${option.province ?? ''}`;
    const previous = merged.get(key);
    if (previous) {
      previous.versions = [
        ...new Set([...previous.versions, ...option.versions]),
      ];
      previous.aliases = [...new Set([...previous.aliases, ...option.aliases])];
    } else
      merged.set(key, {
        ...option,
        versions: [...option.versions],
        aliases: [...option.aliases],
      });
  }
  return [...merged.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'vi'),
  );
}

/** The provider supplies old→new codes; province names alone cannot prove a merger. */
function groupCurrentLocations(
  options: LocationOption[],
  raw: unknown,
): LocationOption[] {
  if (!record(raw) || !Array.isArray(raw.data) || raw.data.length === 0) {
    throw new Error('Invalid province merger catalogue');
  }
  const current = options.filter(
    (item) => item.kind === 'province' && item.versions.includes('current'),
  );
  const legacy = options.filter(
    (item) => item.kind === 'province' && item.versions.includes('legacy'),
  );
  const oldByCode = new Map(
    legacy.map((item) => [Number(item.id.split(':').at(-1)), item]),
  );
  const mapping = new Map<number, number[]>();
  const owners = new Set<number>();
  for (const row of raw.data) {
    if (
      !record(row) ||
      typeof row.code !== 'string' ||
      !/^\d+$/.test(row.code) ||
      !Array.isArray(row.merged_from) ||
      !row.merged_from.length ||
      !row.merged_from.every(
        (code) => typeof code === 'string' && /^\d+$/.test(code),
      )
    ) {
      throw new Error('Invalid province merger mapping');
    }
    const code = Number(row.code);
    if (mapping.has(code))
      throw new Error('Duplicate current province mapping');
    const oldCodes = row.merged_from.map(Number);
    for (const oldCode of oldCodes) {
      if (!oldByCode.has(oldCode) || owners.has(oldCode))
        throw new Error('Invalid legacy province mapping');
      owners.add(oldCode);
    }
    mapping.set(code, oldCodes);
  }
  if (mapping.size !== current.length || owners.size !== legacy.length)
    throw new Error('Incomplete province merger mapping');
  const provinces = current.map((item) => {
    const oldCodes = mapping.get(Number(item.id.split(':').at(-1)));
    if (!oldCodes) throw new Error('Missing current province mapping');
    const predecessors = oldCodes.map((code) => oldByCode.get(code)!);
    const legacyNames = predecessors
      .map((old) => old.name)
      .filter(
        (name) => normalizeLocation(name) !== normalizeLocation(item.name),
      );
    return {
      ...item,
      legacyNames,
      aliases: [
        ...new Set([
          ...item.aliases,
          ...predecessors.flatMap((old) => old.aliases),
        ]),
      ],
    };
  });
  // Former cities remain usable transport points; they are not province merger aliases.
  return [...provinces, ...options.filter((item) => item.kind === 'city')].sort(
    (a, b) => a.name.localeCompare(b.name, 'vi'),
  );
}
