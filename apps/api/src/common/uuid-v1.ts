import { randomBytes } from 'node:crypto';

let lastTime = 0n;
let clockSeq = 0;
let nodeId: Buffer | null = null;

/**
 * Generates an RFC 4122 compliant UUID version 1 (timestamp-based).
 * Used for `maThaoTac` in status history tables (LichSuTrangThaiPhieuDatVe & LichSuTrangThaiVe).
 * Matches pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
 */
export function generateUuidV1(): string {
  if (!nodeId) {
    nodeId = randomBytes(6);
    // Set multicast bit for random node per RFC 4122 section 4.1.6
    nodeId[0] = (nodeId[0] ?? 0) | 0x01;
  }

  // Number of 100-nanosecond intervals since Oct 15, 1582 (UUID epoch)
  let now = BigInt(Date.now()) * 10000n + 122192928000000000n;

  if (now <= lastTime) {
    now = lastTime + 1n;
  }
  lastTime = now;

  const timeLow = (now & 0xffffffffn).toString(16).padStart(8, '0');
  const timeMid = ((now >> 32n) & 0xffffn).toString(16).padStart(4, '0');
  const timeHi = (((now >> 48n) & 0x0fffn) | 0x1000n).toString(16).padStart(4, '0');

  clockSeq = (clockSeq + 1) & 0x3fff;
  const clockSeqVal = clockSeq | 0x8000;
  const clockSeqHex = clockSeqVal.toString(16).padStart(4, '0');

  const nodeHex = nodeId.toString('hex');

  return `${timeLow}-${timeMid}-${timeHi}-${clockSeqHex}-${nodeHex}`.toLowerCase();
}
