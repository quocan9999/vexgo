import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const roles = {
  superAdmin: { roleId: 1, roleName: 'SUPER_ADMIN' },
  busCompanyAdmin: { roleId: 2, roleName: 'NHA_XE_ADMIN' },
  ticketEmployee: { roleId: 3, roleName: 'NHAN_VIEN_BAN_VE' },
  customer: { roleId: 4, roleName: 'KHACH_HANG' },
};

describe('EffectiveRolePermissionLoaderService', () => {
  const vaiTroQuyen = { findMany: vi.fn() };
  const cauHinhQuyenVaiTroNhaXe = { findMany: vi.fn() };
  const prisma = {
    vaiTroQuyen,
    cauHinhQuyenVaiTroNhaXe,
  };
  const service = new EffectiveRolePermissionLoaderService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vaiTroQuyen.findMany.mockResolvedValue([]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValue([]);
  });

  it('loads SUPER_ADMIN permissions from the global mapping only', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 1, quyen: { tenQuyen: 'admin-account:read' } },
      { vaiTroId: 1, quyen: { tenQuyen: 'vehicle:read' } },
    ]);

    await expect(service.load([roles.superAdmin], 21)).resolves.toEqual([
      {
        roleName: 'SUPER_ADMIN',
        permissions: ['admin-account:read', 'vehicle:read'],
      },
    ]);

    expect(cauHinhQuyenVaiTroNhaXe.findMany).not.toHaveBeenCalled();
  });

  it('inherits global permissions for a tenant role without an override header', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValueOnce([]);

    await expect(service.load([roles.busCompanyAdmin], 21)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['vehicle:read'] },
    ]);

    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 21, vaiTroId: { in: [2] } },
      }),
    );
  });

  it('replaces global permissions with a non-empty tenant override', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:create' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValueOnce([
      {
        vaiTroId: 2,
        chiTiets: [{ quyen: { tenQuyen: 'route:read' } }],
      },
    ]);

    await expect(service.load([roles.busCompanyAdmin], 21)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['route:read'] },
    ]);
  });

  it('treats an override header with no details as an intentional empty mapping', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValueOnce([
      { vaiTroId: 2, chiTiets: [] },
    ]);

    await expect(service.load([roles.busCompanyAdmin], 21)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: [] },
    ]);
  });

  it('loads each tenant role independently and keeps the complete role set', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
      { vaiTroId: 3, quyen: { tenQuyen: 'route:read' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany.mockResolvedValueOnce([
      {
        vaiTroId: 2,
        chiTiets: [{ quyen: { tenQuyen: 'trip:read' } }],
      },
    ]);

    await expect(
      service.load([roles.busCompanyAdmin, roles.ticketEmployee], 21),
    ).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['trip:read'] },
      { roleName: 'NHAN_VIEN_BAN_VE', permissions: ['route:read'] },
    ]);

    expect(vaiTroQuyen.findMany).toHaveBeenCalledTimes(1);
    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenCalledTimes(1);
    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { nhaXeId: 21, vaiTroId: { in: [2, 3] } },
      }),
    );
  });

  it('preserves mixed platform and tenant roles so the resolver can fail closed', async () => {
    vaiTroQuyen.findMany.mockResolvedValueOnce([
      { vaiTroId: 1, quyen: { tenQuyen: 'admin-account:read' } },
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
    ]);

    const assignments = await service.load(
      [roles.superAdmin, roles.busCompanyAdmin],
      21,
    );

    expect(assignments).toEqual([
      { roleName: 'SUPER_ADMIN', permissions: ['admin-account:read'] },
      { roleName: 'NHA_XE_ADMIN', permissions: ['vehicle:read'] },
    ]);
    expect(
      new PermissionResolverService().resolve(assignments, {
        nhanVienId: 77,
        nhaXeId: 21,
      }),
    ).toEqual([]);
  });

  it('does not leak one tenant role override into another tenant', async () => {
    vaiTroQuyen.findMany.mockResolvedValue([
      { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
    ]);
    cauHinhQuyenVaiTroNhaXe.findMany
      .mockResolvedValueOnce([
        {
          vaiTroId: 2,
          chiTiets: [{ quyen: { tenQuyen: 'route:read' } }],
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(service.load([roles.busCompanyAdmin], 21)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['route:read'] },
    ]);
    await expect(service.load([roles.busCompanyAdmin], 22)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['vehicle:read'] },
    ]);

    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { nhaXeId: 21, vaiTroId: { in: [2] } },
      }),
    );
    expect(cauHinhQuyenVaiTroNhaXe.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { nhaXeId: 22, vaiTroId: { in: [2] } },
      }),
    );
  });

  it('preserves unmapped and non-tenant roles with empty permission sets', async () => {
    await expect(
      service.load(
        [roles.customer, { roleId: 99, roleName: 'UNKNOWN_ROLE' }],
        21,
      ),
    ).resolves.toEqual([
      { roleName: 'KHACH_HANG', permissions: [] },
      { roleName: 'UNKNOWN_ROLE', permissions: [] },
    ]);

    expect(cauHinhQuyenVaiTroNhaXe.findMany).not.toHaveBeenCalled();
  });

  it('skips database reads for an empty role set', async () => {
    await expect(service.load([], 21)).resolves.toEqual([]);
    expect(vaiTroQuyen.findMany).not.toHaveBeenCalled();
    expect(cauHinhQuyenVaiTroNhaXe.findMany).not.toHaveBeenCalled();
  });

  it('does not cache assignments between calls', async () => {
    vaiTroQuyen.findMany
      .mockResolvedValueOnce([
        { vaiTroId: 2, quyen: { tenQuyen: 'vehicle:read' } },
      ])
      .mockResolvedValueOnce([
        { vaiTroId: 2, quyen: { tenQuyen: 'route:read' } },
      ]);

    await expect(service.load([roles.busCompanyAdmin], null)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['vehicle:read'] },
    ]);
    await expect(service.load([roles.busCompanyAdmin], null)).resolves.toEqual([
      { roleName: 'NHA_XE_ADMIN', permissions: ['route:read'] },
    ]);

    expect(vaiTroQuyen.findMany).toHaveBeenCalledTimes(2);
  });

  it('propagates database failures so callers can fail closed', async () => {
    vaiTroQuyen.findMany.mockRejectedValueOnce(new Error('database offline'));

    await expect(service.load([roles.superAdmin], null)).rejects.toThrow(
      'database offline',
    );
  });
});
