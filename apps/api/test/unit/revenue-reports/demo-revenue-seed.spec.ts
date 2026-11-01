import { describe, expect, it, vi } from 'vitest';

const moduleUrl = new URL('../../../../../prisma/demo-revenue.mjs', import.meta.url).href;
const { ensureDemoPayment } = await import(moduleUrl) as {
  ensureDemoPayment(db: unknown, data: unknown): Promise<{ payment: Record<string, unknown>; operation: string }>;
};

const fixture = {
  donGiaoDichId: 1, loaiGiaoDich: 'THANH_TOAN', veId: null,
  trangThai: 'THANH_CONG', soTien: '100', thoiGian: new Date('2026-09-22T03:00:00Z'),
};

function harness(existing: Record<string, unknown> | null) {
  const db = {
    thanhToan: {
      findFirst: vi.fn().mockResolvedValue(existing),
      findUnique: vi.fn().mockResolvedValue(existing),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockImplementation(async ({ data }) => data),
    },
    donGiaoDich: { findUnique: vi.fn().mockResolvedValue({
      maDonGiaoDich: 'FUTA-GD-220920261000-0001', ngayTao: fixture.thoiGian,
      trangThai: 'DA_THANH_TOAN', tongTien: '100',
      phieuDatVe: { ves: [{ giaThucTe: '100' }] }, phieuGuiHang: null,
      thanhToans: existing ? [existing] : [],
    }) },
  };
  return db;
}

describe('demo seed payment evidence', () => {
  it.each([true, false])('preserves a persisted provider payment even when its eligibility is %s', async (eligible) => {
    const existing = {
      ...fixture, thanhToanId: 9, maGiaoDichSePay: 'verified-provider-id',
      thoiDiemHoanTat: new Date('2026-09-22T03:00:45Z'), laQuyetToanHopLe: eligible,
    };
    const db = harness(existing);
    for (let run = 0; run < 2; run++) {
      const result = await ensureDemoPayment(db, { ...fixture, soTien: '999', trangThai: 'THAT_BAI' });
      expect(result).toEqual({ payment: existing, operation: 'preserve' });
    }
    expect(db.thanhToan.updateMany).not.toHaveBeenCalled();
    expect(db.thanhToan.create).not.toHaveBeenCalled();
    expect(db.donGiaoDich.findUnique).not.toHaveBeenCalled();
  });

  it('preserves a completed offline payment without a provider code', async () => {
    const existing = { ...fixture, thanhToanId: 9, maGiaoDichSePay: null,
      thoiDiemHoanTat: new Date('2026-09-22T03:00:45Z'), laQuyetToanHopLe: true };
    const db = harness(existing);
    expect(await ensureDemoPayment(db, fixture)).toEqual({ payment: existing, operation: 'preserve' });
    expect(db.thanhToan.updateMany).not.toHaveBeenCalled();
  });

  it('creates a new eligible demo sale with exactly two minutes of synthetic delay', async () => {
    const db = harness(null);
    const result = await ensureDemoPayment(db, fixture);
    expect(result.operation).toBe('create');
    expect(result.payment).toMatchObject({ laQuyetToanHopLe: true, thoiDiemHoanTat: new Date('2026-09-22T03:02:00Z') });
    expect(db.thanhToan.findFirst).toHaveBeenCalledBefore(db.donGiaoDich.findUnique);
  });

  it('creates a new eligible demo sale for uuid4 transaction code', async () => {
    const db = harness(null);
    db.donGiaoDich.findUnique.mockResolvedValueOnce({
      maDonGiaoDich: '03006cdb7a464f64a6423e02c230287d',
      ngayTao: fixture.thoiGian,
      trangThai: 'DA_THANH_TOAN',
      tongTien: '100',
      phieuDatVe: { ves: [{ giaThucTe: '100' }] },
      phieuGuiHang: null,
      thanhToans: [],
    });
    const result = await ensureDemoPayment(db, fixture);
    expect(result.operation).toBe('create');
    expect(result.payment).toMatchObject({ laQuyetToanHopLe: true });
    expect(result.payment.thoiDiemHoanTat).toBeInstanceOf(Date);
  });

  it('does not overwrite evidence added concurrently after the initial seed read', async () => {
    const existing = { ...fixture, thanhToanId: 9, updatedAt: new Date('2026-09-22T03:00:00Z'),
      maGiaoDichSePay: null, thoiDiemHoanTat: null, laQuyetToanHopLe: false };
    const db = harness(existing);
    const confirmed = { ...existing, maGiaoDichSePay: 'confirmed-in-race', laQuyetToanHopLe: true };
    db.thanhToan.updateMany.mockResolvedValueOnce({ count: 0 });
    db.thanhToan.findUnique.mockResolvedValueOnce(confirmed);
    expect(await ensureDemoPayment(db, fixture)).toEqual({ payment: confirmed, operation: 'preserve' });
    expect(db.thanhToan.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      thanhToanId: 9, updatedAt: existing.updatedAt, maGiaoDichSePay: null,
      thoiDiemHoanTat: null, laQuyetToanHopLe: false,
    } }));
  });
});
