import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

type CodeDb = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
type Kind = 'TX' | 'CX';

export function nextBusinessCode(
  prefix: string,
  codes: string[],
  saved = 0,
): string {
  let maximum = saved;
  for (const code of codes) {
    if (!code.startsWith(prefix)) continue;
    const suffix = code.slice(prefix.length);
    if (/^\d+$/.test(suffix)) maximum = Math.max(maximum, Number(suffix));
  }
  const next = maximum + 1;
  const code = `${prefix}${String(next).padStart(4, '0')}`;
  if (!Number.isSafeInteger(next) || next > 2_147_483_647 || code.length > 50) {
    throw new ConflictException({
      error: 'BUSINESS_CODE_EXHAUSTED',
      message: 'Không thể cấp thêm mã nghiệp vụ cho tiền tố này.',
    });
  }
  return code;
}

// Allocation must run in the same transaction as resource creation. A persisted
// high-water mark prevents reuse after deletion or rescheduling of an old trip.
export async function businessCode(
  db: CodeDb,
  tenantId: number,
  kind: Kind,
  date?: string,
  allocate = false,
): Promise<string> {
  const companies = allocate
    ? await db.$queryRaw<
        Array<{ maNhaXe: string }>
      >`SELECT maNhaXe FROM NhaXe WHERE nhaXeId = ${tenantId} FOR UPDATE`
    : await db.$queryRaw<
        Array<{ maNhaXe: string }>
      >`SELECT maNhaXe FROM NhaXe WHERE nhaXeId = ${tenantId}`;
  const company = companies[0];
  if (!company)
    throw new NotFoundException({
      error: 'BUS_COMPANY_NOT_FOUND',
      message: 'Không tìm thấy nhà xe.',
    });
  const day = date?.split('-').reverse().join('');
  const prefix = `${company.maNhaXe}-${kind}-${kind === 'CX' ? `${day}-` : ''}`;
  const codes =
    kind === 'TX'
      ? await db.$queryRaw<
          Array<{ code: string }>
        >`SELECT maTuyenXe AS code FROM TuyenXe WHERE nhaXeId = ${tenantId}`
      : await db.$queryRaw<
          Array<{ code: string }>
        >`SELECT maChuyenXe AS code FROM ChuyenXe WHERE nhaXeId = ${tenantId}`;
  const counters = await db.$queryRaw<
    Array<{ soCuoi: number }>
  >`SELECT soCuoi FROM BoDemMaNghiepVu WHERE tienTo = ${prefix}`;
  const code = nextBusinessCode(
    prefix,
    codes.map((row) => row.code),
    counters[0]?.soCuoi,
  );
  if (allocate) {
    const sequence = Number(code.slice(prefix.length));
    await db.$executeRaw`INSERT INTO BoDemMaNghiepVu (tienTo, soCuoi) VALUES (${prefix}, ${sequence}) ON DUPLICATE KEY UPDATE soCuoi = ${sequence}`;
  }
  return code;
}
