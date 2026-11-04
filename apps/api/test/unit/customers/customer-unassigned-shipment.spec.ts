import { describe, expect, it, vi } from 'vitest';
import { CustomersService } from '../../../src/customers/customers.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('customer shipment activity without assignment', () => {
  it('returns a waybill before a trip is assigned while keeping the tenant filter', async () => {
    const point = {
      diemGiaoNhanHangId: 1,
      maDiem: 'P1',
      tenDiem: 'Bến',
      diaChi: 'Địa chỉ',
    };
    const prisma = {
      khachHang: { findFirst: vi.fn().mockResolvedValue({ khachHangId: 12 }) },
      phieuGuiHang: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            phieuGuiHangId: 7,
            maVanDon: 'VD7',
            ngayGui: new Date('2026-11-03T01:00:00Z'),
            trangThai: 'MOI_TAO',
            tenNguoiNhan: 'B',
            soDienThoaiNguoiNhan: '0901234567',
            cuocChinh: 50000,
            phiDichVu: 0,
            soTienGiam: 0,
            tongPhi: 50000,
            nguoiTraCuoc: 'NGUOI_GUI',
            chuyenXe: null,
            diemGui: point,
            diemNhan: point,
          },
        ]),
      },
    };
    const principal = {
      taiKhoanId: 5,
      nhaXeId: 2,
      roles: ['ADMIN_NHA_XE'],
      permissions: ['customer:read'],
    } as unknown as AuthPrincipal;
    const result = await new CustomersService(
      prisma as unknown as PrismaService,
    ).listAdminCustomerShipments(principal, 12, { page: 1, pageSize: 10 });
    expect(result.data[0]).toMatchObject({
      shipmentId: 7,
      waybillCode: 'VD7',
      trip: null,
    });
    expect(prisma.phieuGuiHang.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            expect.objectContaining({
              donGiaoDich: { khachHangId: 12, nhaXeId: 2 },
            }),
          ],
        },
      }),
    );
  });
});
