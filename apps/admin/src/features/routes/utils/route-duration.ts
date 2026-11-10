const INVALID_DURATION_MESSAGE =
  'Duration must be a positive integer in minutes.';

export function parseRouteDuration(
  input: string,
  customErrorMessage?: string,
): { value: number } | { error: string } {
  const errorMessage = customErrorMessage || INVALID_DURATION_MESSAGE;
  if (!/^\d+$/.test(input)) return { error: errorMessage };
  const value = Number(input);
  return Number.isSafeInteger(value) && value > 0
    ? { value }
    : { error: errorMessage };
}
