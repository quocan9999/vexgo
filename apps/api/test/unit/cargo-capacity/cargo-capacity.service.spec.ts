import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CargoCapacityService } from '../../../src/cargo-capacity/cargo-capacity.service.js';

describe('CargoCapacityService', () => {
  const createClient = () => ({
    chuyenXe: {
      findUnique: vi.fn().mockResolvedValue({
        chuyenXeId: 41,
        trangThai: 'CHUA_KHOI_HANH',
        nhanGuiHang: true,
        sucChuaXeMay: 2,
        sucChuaHangCongKenh: 4,
        sucChuaHangNhe: 6,
      }),
    },
    hangHoa: {
      findMany: vi.fn().mockResolvedValue([
        { soLuong: 1, loaiHangHoa: { nhomSucChua: 'XE_MAY' } },
        { soLuong: 2, loaiHangHoa: { nhomSucChua: 'HANG_CONG_KENH' } },
        { soLuong: 3, loaiHangHoa: { nhomSucChua: 'HANG_NHE' } },
        { soLuong: 2, loaiHangHoa: { nhomSucChua: 'HANG_NHE' } },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ chuyenXeId: 41 }]),
  });

  it('counts active cargo units by capacity group and uses quantity rather than row count', async () => {
    const client = createClient();
    const service = new CargoCapacityService();

    const snapshot = await service.getSnapshot(client as never, 41);

    expect(client.hangHoa.findMany).toHaveBeenCalledWith({
      where: {
        phieuGuiHang: {
          chuyenXeId: 41,
          trangThai: { in: ['MOI_TAO', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN'] },
        },
      },
      select: {
        soLuong: true,
        loaiHangHoa: { select: { nhomSucChua: true } },
      },
    });
    expect(snapshot?.capacities).toEqual({
      XE_MAY: { total: 2, used: 1, remaining: 1 },
      HANG_CONG_KENH: { total: 4, used: 2, remaining: 2 },
      HANG_NHE: { total: 6, used: 5, remaining: 1 },
    });
  });

  it('returns a zero snapshot without querying cargo when the trip is not accepting shipments', async () => {
    const client = createClient();
    client.chuyenXe.findUnique.mockResolvedValue({
      chuyenXeId: 41,
      trangThai: 'CHUA_KHOI_HANH',
      nhanGuiHang: false,
      sucChuaXeMay: 2,
      sucChuaHangCongKenh: 4,
      sucChuaHangNhe: 6,
    });
    const service = new CargoCapacityService();

    const snapshot = await service.getSnapshot(client as never, 41);

    expect(snapshot).toMatchObject({
      trip: { chuyenXeId: 41, nhanGuiHang: false },
      capacities: {
        XE_MAY: { total: 0, used: 0, remaining: 0 },
        HANG_CONG_KENH: { total: 0, used: 0, remaining: 0 },
        HANG_NHE: { total: 0, used: 0, remaining: 0 },
      },
    });
    expect(client.hangHoa.findMany).not.toHaveBeenCalled();
  });

  it('rejects a multi-group request when any group exceeds its remaining units', async () => {
    const client = createClient();
    const service = new CargoCapacityService();
    const snapshot = await service.getSnapshot(client as never, 41);

    expect(() =>
      service.assertAvailable(snapshot!, [
        { group: 'XE_MAY', quantity: 1 },
        { group: 'HANG_NHE', quantity: 2 },
      ]),
    ).toThrowError(
      expect.objectContaining({
        response: expect.objectContaining({ error: 'CARGO_CAPACITY_EXCEEDED' }),
      }),
    );
  });

  it('fails closed if the trip disappears before the locked capacity read', async () => {
    const client = createClient();
    client.$queryRaw.mockResolvedValue([]);
    const service = new CargoCapacityService();

    await expect(service.lockTrip(client as never, 41)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('locks the trip row using a parameterized FOR UPDATE query', async () => {
    const client = createClient();
    const service = new CargoCapacityService();

    await service.lockTrip(client as never, 41);

    expect(client.$queryRaw).toHaveBeenCalledTimes(1);
    const [query, tripId] = client.$queryRaw.mock.calls[0];
    expect(query.join('')).toContain('FOR UPDATE');
    expect(query.join('')).toContain('ChuyenXe');
    expect(tripId).toBe(41);
  });

  it('throws a conflict when the trip is not open for cargo', async () => {
    const client = createClient();
    client.chuyenXe.findUnique.mockResolvedValue({
      chuyenXeId: 41,
      trangThai: 'DA_HUY',
      nhanGuiHang: true,
      sucChuaXeMay: 2,
      sucChuaHangCongKenh: 4,
      sucChuaHangNhe: 6,
    });
    const service = new CargoCapacityService();
    const snapshot = await service.getSnapshot(client as never, 41);

    expect(() =>
      service.assertAvailable(snapshot!, [{ group: 'XE_MAY', quantity: 1 }]),
    ).toThrow(ConflictException);
  });
});
