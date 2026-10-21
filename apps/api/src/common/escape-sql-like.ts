/**
 * Escapes special wildcard characters in SQL LIKE pattern matching (%, _, \).
 */
export function escapeSqlLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
