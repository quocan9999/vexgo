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

  // 1. If explicit legacy item in catalogue: STRICTLY return only its own terms and aliases
  const legacyItem = catalogue.find(
    (item) =>
      item.isLegacy === true &&
      (normalizeLocation(item.value) === normalized ||
        normalizeLocation(item.name) === normalized),
  );
  if (legacyItem) {
    const terms = [legacyItem.name, legacyItem.value, ...legacyItem.aliases];
    if (normalized === 'hcm' || normalized === 'ho chi minh') {
      terms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
    }
    const cleanTerms = terms.map((t) =>
      t.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim(),
    );
    return [...new Set(cleanTerms.filter(Boolean))];
  }

  // 2. If explicit current (merged) item in catalogue: include constituent provinces
  const currentItem = catalogue.find(
    (item) =>
      item.isLegacy === false &&
      (normalizeLocation(item.value) === normalized ||
        normalizeLocation(item.name) === normalized),
  );
  if (currentItem) {
    const terms = [currentItem.name, currentItem.value, ...currentItem.aliases];
    if (normalized === 'hcm' || normalized === 'ho chi minh') {
      terms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
    }
    if (currentItem.mergedFromText) {
      const match = currentItem.mergedFromText.match(/Sáp nhập từ (.+)$/i);
      if (match) {
        const constituentNames = match[1].split(',').map((s) => s.trim());
        for (const cName of constituentNames) {
          terms.push(cName);
          const cItem = catalogue.find(
            (it) => it.isLegacy && normalizeLocation(it.name) === normalizeLocation(cName),
          );
          if (cItem) {
            terms.push(cItem.name, cItem.value, ...cItem.aliases);
          }
        }
      }
    }
    const cleanTerms = terms.map((t) =>
      t.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim(),
    );
    return [...new Set(cleanTerms.filter(Boolean))];
  }

  // 3. Fallback for legacy catalogue format (items with versions: ['current'] and aliases)
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

  if (normalized === 'hcm' || normalized === 'ho chi minh') {
    return ['TP.HCM', 'Hồ Chí Minh', 'TP HCM'];
  }

  const matchedItem = catalogue.find(
    (item) =>
      normalizeLocation(item.value) === normalized ||
      normalizeLocation(item.name) === normalized,
  );
  if (matchedItem) {
    const terms = [matchedItem.name, matchedItem.value, ...matchedItem.aliases];
    const cleanTerms = terms.map((t) =>
      t.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim(),
    );
    return [...new Set(cleanTerms.filter(Boolean))];
  }

  return [trimmed];
}
