import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { ADMIN_ROLE_DEFAULT_PERMISSION_KEYS } from '../../../src/auth/permissions/permission-catalog.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { VehiclesService } from '../../../src/vehicles/vehicles.service.js';

let currentPrincipal: AuthPrincipal;
const testAccessTokenGuard = {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
      currentPrincipal;
    return true;
  },
};

describe('Vehicles authorization integration', () => {
  let app: INestApplication;
  let originalCorsOrigins: string | undefined;
  const vehiclesService = {
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findSeats: vi.fn(),
    createSeat: vi.fn(),
    updateSeat: vi.fn(),
    deleteSeat: vi.fn(),
  };

  beforeAll(async () => {
    originalCorsOrigins = process.env.CORS_ALLOWED_ORIGINS;
    process.env.CORS_ALLOWED_ORIGINS =
      'http://localhost:3000,http://localhost:3001';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AccessTokenGuard)
      .useValue(testAccessTokenGuard)
      .overrideProvider(VehiclesService)
      .useValue(vehiclesService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (originalCorsOrigins === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = originalCorsOrigins;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentPrincipal = {
      taiKhoanId: 42,
      sessionId: 'vehicle-permission-session',
      roles: ['NHA_XE_ADMIN'],
      permissions: [...ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN],
      nhanVienId: 77,
      nhaXeId: 901,
    };
    vehiclesService.create.mockResolvedValue({ data: { vehicleId: 17 } });
    vehiclesService.update.mockResolvedValue({ data: { vehicleId: 17 } });
    vehiclesService.updateStatus.mockResolvedValue({ data: { vehicleId: 17 } });
    vehiclesService.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
    });
    vehiclesService.findOne.mockResolvedValue({ data: { vehicleId: 17 } });
    vehiclesService.findSeats.mockResolvedValue({ data: [] });
    vehiclesService.createSeat.mockResolvedValue({ data: { seatId: 4 } });
    vehiclesService.updateSeat.mockResolvedValue({ data: { seatId: 4 } });
    vehiclesService.deleteSeat.mockResolvedValue(undefined);
  });

  it('requires vehicle:read for vehicle list and detail operations', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:read'],
    };
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(vehiclesService.findAll).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:update'],
    };
    const denied = await request(app.getHttpServer())
      .get('/api/v1/vehicles/17')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.findOne).not.toHaveBeenCalled();
  });

  it('requires vehicle:create to create a vehicle and blocks mismatched permission', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:create'],
    };
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', 'Bearer signed-token')
      .send({
        licensePlate: '51A-12345',
        busCompanyId: 901,
        vehicleTypeId: 17,
        status: 'HOAT_DONG',
      })
      .expect(201);

    expect(vehiclesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ busCompanyId: 901, vehicleTypeId: 17 }),
      expect.objectContaining({ roles: ['NHAN_VIEN_CSKH'], nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:update'],
    };
    const denied = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', 'Bearer signed-token')
      .send({
        licensePlate: '51A-12346',
        busCompanyId: 901,
        vehicleTypeId: 17,
        status: 'HOAT_DONG',
      })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.create).toHaveBeenCalledTimes(1);
  });

  it('uses vehicle:update for vehicle edits and status changes', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:update'],
    };
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/17')
      .set('Authorization', 'Bearer signed-token')
      .send({ licensePlate: '51A-12345', busCompanyId: 901, vehicleTypeId: 17 })
      .expect(200);
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:update'],
    };
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/17/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'BAO_TRI' })
      .expect(200);

    expect(vehiclesService.update).toHaveBeenCalledOnce();
    expect(vehiclesService.updateStatus).toHaveBeenCalledOnce();

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:create'],
    };
    const denied = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/17/status')
      .set('Authorization', 'Bearer signed-token')
      .send({ status: 'BAO_TRI' })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.updateStatus).toHaveBeenCalledOnce();
  });

  it('requires seat:read and does not infer seat reads from vehicle permissions', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:read'],
    };
    await request(app.getHttpServer())
      .get('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(vehiclesService.findSeats).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:read'],
    };
    const denied = await request(app.getHttpServer())
      .get('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.findSeats).toHaveBeenCalledOnce();
  });

  it('requires seat:create for seat creation', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:create'],
    };
    await request(app.getHttpServer())
      .post('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .send({ seatNumber: 'A1', position: 'Cửa sổ' })
      .expect(201);

    expect(vehiclesService.createSeat).toHaveBeenCalledWith(
      17,
      expect.objectContaining({ seatNumber: 'A1' }),
      expect.objectContaining({ nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:update'],
    };
    const denied = await request(app.getHttpServer())
      .post('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .send({ seatNumber: 'A2' })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.createSeat).toHaveBeenCalledOnce();
  });

  it('requires seat:update for seat edits instead of vehicle:update', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:update'],
    };
    await request(app.getHttpServer())
      .patch('/api/v1/vehicles/17/seats/4')
      .set('Authorization', 'Bearer signed-token')
      .send({ seatNumber: 'A1' })
      .expect(200);

    expect(vehiclesService.updateSeat).toHaveBeenCalledWith(
      17,
      4,
      expect.objectContaining({ seatNumber: 'A1' }),
      expect.objectContaining({ nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['vehicle:update'],
    };
    const denied = await request(app.getHttpServer())
      .patch('/api/v1/vehicles/17/seats/4')
      .set('Authorization', 'Bearer signed-token')
      .send({ seatNumber: 'A2' })
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.updateSeat).toHaveBeenCalledOnce();
  });

  it('requires seat:delete and does not infer deletion from seat:update', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:delete'],
    };
    await request(app.getHttpServer())
      .delete('/api/v1/vehicles/17/seats/4')
      .set('Authorization', 'Bearer signed-token')
      .expect(204);

    expect(vehiclesService.deleteSeat).toHaveBeenCalledWith(
      17,
      4,
      expect.objectContaining({ nhaXeId: 901 }),
    );

    currentPrincipal = {
      ...currentPrincipal,
      roles: ['NHAN_VIEN_CSKH'],
      permissions: ['seat:update'],
    };
    const denied = await request(app.getHttpServer())
      .delete('/api/v1/vehicles/17/seats/4')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(denied.body.error).toBe('PERMISSION_FORBIDDEN');
    expect(vehiclesService.deleteSeat).toHaveBeenCalledOnce();
  });

  it('keeps tenant-admin vehicle and seat access with its default permissions', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .expect(200);

    expect(vehiclesService.findAll).toHaveBeenCalledOnce();
    expect(vehiclesService.findSeats).toHaveBeenCalledOnce();
  });

  it('blocks Super Admin vehicle and seat reads despite operational permissions', async () => {
    currentPrincipal = {
      ...currentPrincipal,
      roles: ['SUPER_ADMIN'],
      permissions: ['vehicle:read', 'seat:read'],
      nhanVienId: null,
      nhaXeId: null,
    };
    await request(app.getHttpServer())
      .get('/api/v1/vehicles')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/vehicles/17/seats')
      .set('Authorization', 'Bearer signed-token')
      .expect(403);

    expect(vehiclesService.findAll).not.toHaveBeenCalled();
    expect(vehiclesService.findSeats).not.toHaveBeenCalled();
  });
});
