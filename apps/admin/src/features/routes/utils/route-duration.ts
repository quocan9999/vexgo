const INVALID_DURATION_MESSAGE =
  'Thời gian chạy phải là số phút nguyên lớn hơn 0.';

export function parseRouteDuration(
  input: string,
): { value: number } | { error: string } {
  if (!/^\d+$/.test(input)) return { error: INVALID_DURATION_MESSAGE };
  const value = Number(input);
  return Number.isSafeInteger(value) && value > 0
    ? { value }
    : { error: INVALID_DURATION_MESSAGE };
}
