import {
  normalizeLocation,
  stripLocationPrefix,
  type LocationOption,
} from './location-catalog.js';

function hasDiacritics(text: string): boolean {
  return /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(
    text,
  );
}

function getOptionAliasesForSearch(option: LocationOption): string[] {
  return (option.aliases || []).filter((alias) => {
    if (!alias) return false;
    // Bỏ tenKhongDau trực tiếp từ DB nếu trùng
    if (
      option.tenKhongDau &&
      alias.toLowerCase() === option.tenKhongDau.toLowerCase()
    ) {
      return false;
    }
    // Giữ lại các từ viết tắt phổ biến như TP.HCM, TP HCM
    if (/^TP\.?\s*HCM$/i.test(alias)) {
      return true;
    }
    // Nếu option.name có dấu nhưng alias không có dấu (ví dụ "Quan 1" cho "Quận 1", "Thu Duc" cho "Thủ Đức")
    if (hasDiacritics(option.name) && !hasDiacritics(alias)) {
      return false;
    }
    // Nếu alias toàn bộ là chữ không dấu viết thường (tenKhongDau)
    if (alias === alias.toLowerCase() && !hasDiacritics(alias)) {
      return false;
    }
    return true;
  });
}

function cleanAndFilterTerms(rawTerms: string[]): string[] {
  const result: string[] = [];
  for (const raw of rawTerms) {
    if (!raw) continue;
    const noParent = raw.replace(/\s*\([^)]*\)$/, '').trim();
    // Làm sạch tên: bỏ tiền tố nhưng KHÔNG bỏ nếu phần còn lại là số (ví dụ giữ nguyên "Quận 1", "Quận 12")
    const cleaned = stripLocationPrefix(noParent, true);

    // Loại các term chỉ gồm chữ số hoặc ngắn hơn 3 ký tự sau khi làm sạch
    if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
      result.push(cleaned);
    }
    if (
      noParent !== cleaned &&
      noParent.length >= 3 &&
      !/^\d+$/.test(noParent)
    ) {
      result.push(noParent);
    }
  }
  return [...new Set(result)];
}

/** Trích xuất search terms cho một LocationOption cụ thể, tôn trọng triệt để cờ isLegacy của mục đó */
export function locationSearchTermsForOption(
  item: LocationOption,
  catalogue: LocationOption[] = [],
): string[] {
  const normalized = normalizeLocation(item.value || item.name);
  const terms: string[] = [
    item.name,
    item.value,
    ...getOptionAliasesForSearch(item),
  ];
  if (normalized === 'hcm' || normalized === 'ho chi minh') {
    terms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
  }

  // 1. Bản CŨ (isLegacy === true): trả term của chính nó, alias và các quận/huyện trực thuộc chính nó, không gộp tỉnh thành phần
  if (item.isLegacy) {
    const districts = catalogue.filter(
      (it) =>
        it.kind === 'district' &&
        it.parentName &&
        (normalizeLocation(it.parentName) === normalized ||
          normalizeLocation(it.parentName) === normalizeLocation(item.name)),
    );
    for (const d of districts) {
      terms.push(d.name, d.value, ...getOptionAliasesForSearch(d));
    }
    return cleanAndFilterTerms(terms);
  }

  // 2. Bản MỚI (isLegacy === false): bao gồm term của chính nó + quận/huyện của chính nó + các tỉnh cũ thành phần từ legacyNames và quận/huyện của chúng
  const selfDistricts = catalogue.filter(
    (it) =>
      it.kind === 'district' &&
      it.parentName &&
      (normalizeLocation(it.parentName) === normalized ||
        normalizeLocation(it.parentName) === normalizeLocation(item.name)),
  );
  for (const d of selfDistricts) {
    terms.push(d.name, d.value, ...getOptionAliasesForSearch(d));
  }

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
      terms.push(cItem.name, cItem.value, ...getOptionAliasesForSearch(cItem));
    }
    const districts = catalogue.filter(
      (it) =>
        it.kind === 'district' &&
        it.parentName &&
        normalizeLocation(it.parentName) === normalizeLocation(cName),
    );
    for (const d of districts) {
      terms.push(d.name, d.value, ...getOptionAliasesForSearch(d));
    }
  }

  return cleanAndFilterTerms(terms);
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
