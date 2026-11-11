export function hydrateUntouchedProfileField(
  currentValue: string | null,
  profileValue: string | null | undefined,
): string | null {
  return currentValue ?? profileValue ?? null;
}
