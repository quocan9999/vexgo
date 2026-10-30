import { normalizeLocation, type LocationOption } from './location-catalog.js';

/** Trích xuất search terms cho một LocationOption cụ thể, tôn trọng triệt để cờ isLegacy của mục đó */
export function locationSearchTermsForOption(
  item: LocationOption,
  catalogue: LocationOption[] = [],
): string[] {
  const normalized = normalizeLocation(item.value || item.name);
  const terms = [item.name, item.value, ...item.aliases];
  if (normalized === 'hcm' || normalized === 'ho chi minh') {
    terms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
  }

  // 1. Bản CŨ (isLegacy === true): CHỈ trả term của chính nó và alias, không gộp tỉnh thành phần
  if (item.isLegacy) {
    const cleanTerms = terms.map((t) =>
      t.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim(),
    );
    return [...new Set(cleanTerms.filter(Boolean))];
  }

  // 2. Bản MỚI (isLegacy === false): bao gồm term của chính nó + các tỉnh cũ thành phần từ legacyNames
  let constituentNames: string[] = [];
  if (item.legacyNames && item.legacyNames.length > 0) {
    constituentNames = item.legacyNames;
  } else if (item.mergedFromText) {
    const match = item.mergedFromText.match(/Sáp nhập từ (.+)$/i);
    if (match) {
      constituentNames = match[1].split(',').map((s) => s.trim());
    }
  }

  for (const cName of constituentNames) {
    terms.push(cName);
    const cItem = catalogue.find(
      (it) => it.isLegacy && normalizeLocation(it.name) === normalizeLocation(cName),
    );
    if (cItem) {
      terms.push(cItem.name, cItem.value, ...cItem.aliases);
    }
    const districts = catalogue.filter(
      (it) =>
        it.kind === 'district' &&
        it.parentName &&
        normalizeLocation(it.parentName) === normalizeLocation(cName),
    );
    for (const d of districts) {
      terms.push(d.name, d.value, ...d.aliases);
    }
  }

  const cleanTerms = terms.map((t) =>
    t.replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '').trim(),
  );
  return [...new Set(cleanTerms.filter(Boolean))];
}

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
    return locationSearchTermsForOption(legacyItem, catalogue);
  }

  // 2. If explicit current (merged) item in catalogue: include constituent provinces
  const currentItem = catalogue.find(
    (item) =>
      item.isLegacy === false &&
      (normalizeLocation(item.value) === normalized ||
        normalizeLocation(item.name) === normalized),
  );
  if (currentItem) {
    return locationSearchTermsForOption(currentItem, catalogue);
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
