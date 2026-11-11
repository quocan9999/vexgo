import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

export interface CargoDimensionsInput {
  length?: unknown;
  width?: unknown;
  height?: unknown;
}

export const CARGO_DIMENSIONS_INVALID_MESSAGE =
  'Kích thước hàng hóa phải nhập đủ dài, rộng, cao; mỗi chiều phải là số hữu hạn lớn hơn 0.';

function isFinitePositiveDimension(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  return (
    value instanceof Prisma.Decimal && value.isFinite() && value.greaterThan(0)
  );
}

export function hasValidCargoDimensions(
  dimensions: CargoDimensionsInput,
): boolean {
  const values = [dimensions.length, dimensions.width, dimensions.height];
  if (values.every((value) => value === undefined || value === null)) {
    return true;
  }

  return values.every(isFinitePositiveDimension);
}

export function assertValidCargoDimensions(
  itemName: string,
  dimensions: CargoDimensionsInput,
): void {
  if (hasValidCargoDimensions(dimensions)) {
    return;
  }

  throw new BadRequestException({
    error: 'CARGO_DIMENSIONS_INVALID',
    message: `${CARGO_DIMENSIONS_INVALID_MESSAGE} Mặt hàng: ${itemName}.`,
  });
}
