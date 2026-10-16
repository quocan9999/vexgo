import type { Prisma } from '../generated/prisma/client.js';

/**
 * Serializes shipment cancellation and payment state changes on their shared
 * DonGiaoDich row. Call this with the transaction client before reading or
 * writing either the shipment's payment state or its cancellation state.
 */
export async function lockPaymentOrder(
  tx: Prisma.TransactionClient,
  donGiaoDichId: number,
): Promise<boolean> {
  const orders = await tx.$queryRaw<Array<{ donGiaoDichId: number }>>`
    SELECT donGiaoDichId
    FROM DonGiaoDich
    WHERE donGiaoDichId = ${donGiaoDichId}
    FOR UPDATE
  `;
  return orders.length === 1;
}
