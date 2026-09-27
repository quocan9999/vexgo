import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const MAX_TRANSACTION_ATTEMPTS = 3;

export type FarePriceIntervalCandidate = {
  routeId: number;
  vehicleTypeId: number;
  validFrom: string;
  validTo: string | null;
  excludeFarePriceId?: number;
};

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day <= daysInMonth;
}

function invalidPeriod(field: 'validFrom' | 'validTo', message: string): never {
  throw new BadRequestException({
    error: 'VALIDATION_ERROR',
    message: 'Dữ liệu không hợp lệ.',
    details: [{ field, message }],
  });
}

export function assertValidFarePeriod(
  validFrom: string,
  validTo: string | null | undefined,
): asserts validFrom is string {
  if (!isDateOnly(validFrom)) {
    invalidPeriod('validFrom', 'Ngày bắt đầu phải là ngày hợp lệ dạng YYYY-MM-DD.');
  }
  if (validTo !== undefined && validTo !== null && !isDateOnly(validTo)) {
    invalidPeriod('validTo', 'Ngày kết thúc phải là ngày hợp lệ dạng YYYY-MM-DD.');
  }
  if (validTo !== undefined && validTo !== null && validTo < validFrom) {
    invalidPeriod('validTo', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
  }
}

function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function validateFarePriceRelations(
  transaction: Prisma.TransactionClient,
  routeId: number,
  vehicleTypeId: number,
): Promise<void> {
  const [route, vehicleType] = await Promise.all([
    transaction.tuyenXe.findUnique({
      where: { tuyenXeId: routeId },
      select: { tuyenXeId: true },
    }),
    transaction.loaiXe.findUnique({
      where: { loaiXeId: vehicleTypeId },
      select: { loaiXeId: true },
    }),
  ]);

  if (!route) {
    throw new NotFoundException({
      error: 'ROUTE_NOT_FOUND',
      message: 'Không tìm thấy tuyến xe.',
    });
  }
  if (!vehicleType) {
    throw new NotFoundException({
      error: 'VEHICLE_TYPE_NOT_FOUND',
      message: 'Không tìm thấy loại xe.',
    });
  }
}

export async function findActiveFareOverlap(
  transaction: Prisma.TransactionClient,
  candidate: FarePriceIntervalCandidate,
) {
  assertValidFarePeriod(candidate.validFrom, candidate.validTo);

  const conditions: Prisma.BangGiaWhereInput[] = [
    {
      OR: [
        { denNgay: null },
        { denNgay: { gte: dateOnlyToUtc(candidate.validFrom) } },
      ],
    },
  ];

  if (candidate.validTo !== null) {
    conditions.push({ tuNgay: { lte: dateOnlyToUtc(candidate.validTo) } });
  }

  return transaction.bangGia.findFirst({
    where: {
      tuyenXeId: candidate.routeId,
      loaiXeId: candidate.vehicleTypeId,
      trangThai: 'HOAT_DONG',
      ...(candidate.excludeFarePriceId === undefined
        ? {}
        : { bangGiaId: { not: candidate.excludeFarePriceId } }),
      AND: conditions,
    },
    select: { bangGiaId: true },
  });
}

export async function assertNoActiveFareOverlap(
  transaction: Prisma.TransactionClient,
  candidate: FarePriceIntervalCandidate,
): Promise<void> {
  const overlap = await findActiveFareOverlap(transaction, candidate);
  if (overlap) {
    throw new ConflictException({
      error: 'FARE_PRICE_OVERLAP',
      message: 'Khoảng hiệu lực bị trùng với một bảng giá đang hoạt động.',
    });
  }
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2034'
  );
}

function concurrentModificationError(): ConflictException {
  return new ConflictException({
    error: 'FARE_PRICE_CONCURRENT_MODIFICATION',
    message: 'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng thử lại.',
  });
}

export async function runFarePriceWriteTransaction<T>(
  prisma: Pick<PrismaService, '$transaction'>,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationConflict(error)) throw error;
      if (attempt === MAX_TRANSACTION_ATTEMPTS) {
        throw concurrentModificationError();
      }
    }
  }

  throw concurrentModificationError();
}
