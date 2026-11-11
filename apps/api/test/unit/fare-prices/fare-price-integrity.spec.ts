import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import {
  runFarePriceWriteTransaction,
  validateFarePriceRelations,
} from '../../../src/fare-prices/fare-price-integrity.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

function serializationConflict() {
  return new Prisma.PrismaClientKnownRequestError('write conflict', {
    code: 'P2034',
    clientVersion: '7.10.0',
  });
}

describe('Fare Price Serializable write transaction', () => {
  it('retries the whole transaction after a P2034 conflict', async () => {
    let attempts = 0;
    const transaction = {} as Prisma.TransactionClient;
    const operation = vi.fn(async () => 'saved');
    const prisma = {
      $transaction: vi.fn(async (callback) => {
        attempts += 1;
        const result = await callback(transaction);
        if (attempts === 1) throw serializationConflict();
        return result;
      }),
    } as unknown as Pick<PrismaService, '$transaction'>;

    await expect(runFarePriceWriteTransaction(prisma, operation)).resolves.toBe('saved');

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(prisma.$transaction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('stops after three attempts and maps exhausted retries to a stable conflict', async () => {
    const prisma = {
      $transaction: vi.fn(async () => {
        throw serializationConflict();
      }),
    } as unknown as Pick<PrismaService, '$transaction'>;

    try {
      await runFarePriceWriteTransaction(prisma, async () => undefined);
      throw new Error('Expected the transaction retry limit to reject.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as { getStatus: () => number }).getStatus()).toBe(409);
      expect((error as { getResponse: () => unknown }).getResponse()).toEqual({
        error: 'FARE_PRICE_CONCURRENT_MODIFICATION',
        message: 'Dữ liệu bảng giá vừa thay đổi đồng thời. Vui lòng thử lại.',
      });
    }

    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-serialization errors', async () => {
    const databaseError = new Error('database unavailable');
    const prisma = {
      $transaction: vi.fn(async () => {
        throw databaseError;
      }),
    } as unknown as Pick<PrismaService, '$transaction'>;

    await expect(
      runFarePriceWriteTransaction(prisma, async () => undefined),
    ).rejects.toBe(databaseError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('fare price tenant relation invariant', () => {
  it('resolves route and type only within the trusted tenant', async () => {
    const transaction = {
      tuyenXe: {
        findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 11, nhaXeId: 2 }),
      },
      loaiXe: {
        findFirst: vi.fn().mockResolvedValue({ loaiXeId: 7, nhaXeId: 2 }),
      },
    };

    await expect(validateFarePriceRelations(transaction as never, 11, 7, 2)).resolves.toBe(2);
    expect(transaction.tuyenXe.findFirst).toHaveBeenCalledWith({
      where: { tuyenXeId: 11, nhaXeId: 2 },
      select: { tuyenXeId: true, nhaXeId: true },
    });
    expect(transaction.loaiXe.findFirst).toHaveBeenCalledWith({
      where: { loaiXeId: 7, nhaXeId: 2 },
      select: { loaiXeId: true, nhaXeId: true },
    });
  });

  it('reports a foreign route as missing without resolving it globally', async () => {
    const transaction = {
      tuyenXe: { findFirst: vi.fn().mockResolvedValue(null) },
      loaiXe: { findFirst: vi.fn().mockResolvedValue({ loaiXeId: 7, nhaXeId: 2 }) },
    };

    await expect(validateFarePriceRelations(transaction as never, 11, 7, 2)).rejects.toMatchObject({
      response: { error: 'ROUTE_NOT_FOUND' },
    });
    expect(transaction.tuyenXe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tuyenXeId: 11, nhaXeId: 2 } }),
    );
  });

  it('reports a foreign vehicle type as missing without resolving it globally', async () => {
    const transaction = {
      tuyenXe: { findFirst: vi.fn().mockResolvedValue({ tuyenXeId: 11, nhaXeId: 2 }) },
      loaiXe: { findFirst: vi.fn().mockResolvedValue(null) },
    };

    await expect(validateFarePriceRelations(transaction as never, 11, 7, 2)).rejects.toMatchObject({
      response: { error: 'VEHICLE_TYPE_NOT_FOUND' },
    });
    expect(transaction.loaiXe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { loaiXeId: 7, nhaXeId: 2 } }),
    );
  });
});
