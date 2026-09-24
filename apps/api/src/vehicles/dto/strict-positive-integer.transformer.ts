export function transformStrictPositiveInteger(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : Number.NaN;
  }

  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}
