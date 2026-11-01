import { generateBusinessUuid } from './business-uuid.js';
import { Prisma } from '../generated/prisma/client.js';

type CodeDb = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
type Kind = 'TX' | 'CX';

export function nextBusinessCode(
  _prefix: string,
  _codes: string[],
  _saved = 0,
): string {
  return generateBusinessUuid();
}

/**
 * Sinh mã định danh nghiệp vụ UUID v4 bỏ dấu gạch nối (32 ký tự hex viết thường).
 * Tự động cấp phát không trùng lặp, không cần tiền tố nhà xe.
 */
export async function businessCode(
  _db: CodeDb,
  _tenantId: number,
  _kind: Kind,
  _date?: string,
  _allocate = false,
): Promise<string> {
  return generateBusinessUuid();
}
