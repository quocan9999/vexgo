import { normalizeLocation, type LocationOption } from './location-catalog.js';

/** Expand current provinces, districts, and stations for trip search. */
export function locationSearchTerms(
  value: string,
  catalogue: LocationOption[] = [],
): string[] {
  if (!value) return [];
  const trimmed = value.trim().replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '');

  // Handle formatted values with parent, e.g. "Bến xe Miền Đông (TP.HCM)" or "Đà Lạt (Lâm Đồng)"
  const parentMatch = trimmed.match(/^(.+?)\s*\((.+?)\)$/);
  if (parentMatch) {
    const [, subName, parentName] = parentMatch;
    const subTerms = locationSearchTerms(subName, catalogue);
    const parentTerms = locationSearchTerms(parentName, catalogue);
    return [...new Set([trimmed, ...subTerms, ...parentTerms])];
  }

  const normalized = normalizeLocation(trimmed);
  if (normalized === 'hcm' || normalized === 'ho chi minh') {
    return ['TP.HCM', 'Hồ Chí Minh', 'TP HCM'];
  }

  const current = catalogue.find(
    (item) =>
      item.kind === 'province' &&
      item.versions?.includes('current') &&
      normalizeLocation(item.value) === normalized,
  );
  if (current) {
    return [
      ...new Set(
        current.aliases.flatMap((alias) => locationSearchTerms(alias)),
      ),
    ];
  }

  const matchedItem = catalogue.find(
    (item) =>
      normalizeLocation(item.value) === normalized ||
      normalizeLocation(item.name) === normalized,
  );
  if (matchedItem) {
    const terms = [matchedItem.name, matchedItem.value, ...matchedItem.aliases];
    return [...new Set(terms.filter(Boolean))];
  }

  return [trimmed];
}
