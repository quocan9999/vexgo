import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

export type FarePriceTestContext = {
  app: INestApplication;
  prisma: PrismaService;
  routeId: number;
  vehicleTypeId: number;
  busCompanyId: number;
  clearFares: () => Promise<void>;
  setPrincipal: (principal: AuthPrincipal) => void;
  close: () => Promise<void>;
};

export async function createFarePriceTestContext(): Promise<FarePriceTestContext> {
  let principal: AuthPrincipal = {
    taiKhoanId: 700,
    sessionId: 'fare-price-integration-session',
    roles: ['NHA_XE_ADMIN'],
    permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
    nhanVienId: 900,
    nhaXeId: null,
  };
  const accessTokenGuard = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user = principal;
      return true;
    },
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AccessTokenGuard)
    .useValue(accessTokenGuard)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApi(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
  const company = await prisma.nhaXe.create({
    data: {
      maNhaXe: `T04-${suffix}`,
      tenNhaXe: `Test Fare Price ${suffix}`,
      trangThai: 'HOAT_DONG',
    },
    select: { nhaXeId: true },
  });

  const route = await prisma.tuyenXe.create({
    data: {
      maTuyenXe: `T04-${suffix}`,
      diemDi: 'Điểm thử',
      diemDen: 'Điểm đích thử',
      trangThai: 'TAM_NGUNG',
      nhaXeId: company.nhaXeId,
    },
    select: { tuyenXeId: true },
  });

  const vehicleType = await prisma.loaiXe.create({
    data: { nhaXeId: company.nhaXeId, tenLoai: `Test Fare Type ${suffix}` },
    select: { loaiXeId: true },
  });
  principal = { ...principal, nhaXeId: company.nhaXeId };

  async function clearFares() {
    await prisma.bangGia.deleteMany({
      where: { tuyenXeId: route.tuyenXeId, loaiXeId: vehicleType.loaiXeId },
    });
  }

  async function close() {
    try {
      await clearFares();
      await prisma.tuyenXe.delete({ where: { tuyenXeId: route.tuyenXeId } });
      await prisma.loaiXe.delete({ where: { loaiXeId: vehicleType.loaiXeId } });
      await prisma.nhaXe.delete({ where: { nhaXeId: company.nhaXeId } });
    } finally {
      await app.close();
    }
  }

  return {
    app,
    prisma,
    routeId: route.tuyenXeId,
    vehicleTypeId: vehicleType.loaiXeId,
    busCompanyId: company.nhaXeId,
    clearFares,
    setPrincipal(value) {
      principal = value;
    },
    close,
  };
}
