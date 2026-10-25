import { normalizeLocation, type LocationOption } from './location-catalog.js';

/** Expand current provinces through verified predecessors; old names keep their own scope. */
export function locationSearchTerms(
  value: string,
  catalogue: LocationOption[] = [],
): string[] {
  const trimmed = value.trim().replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '');
  const current = catalogue.find(
    (item) =>
      item.kind === 'province' &&
      item.versions.includes('current') &&
      normalizeLocation(item.value) === normalizeLocation(trimmed),
  );
  if (current) {
    return [
      ...new Set(
        current.aliases.flatMap((alias) => locationSearchTerms(alias)),
      ),
    ];
  }
  if (normalizeLocation(trimmed) === 'ho chi minh') {
    return ['TP.HCM', 'Hồ Chí Minh', 'TP HCM'];
  }
  return [trimmed];
}
