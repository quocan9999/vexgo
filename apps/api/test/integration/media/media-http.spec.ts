import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { MediaModule } from '../../../src/media/media.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { MediaService } from '../../../src/media/media.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { configureApi } from '../../../src/common/configure-api.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

const mediaId = '83bf055f-f6c4-46b8-9270-63cfc9442aee';
const requestId = 'd568978a-1c5e-4c67-90ab-b823201098e6';
let principal: AuthPrincipal | undefined;
const access = {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthPrincipal; method: string; url: string }>();
    req.user = principal;
    if (
      !principal &&
      !(
        req.method === 'GET' &&
        /^\/api\/v1\/media\/vehicles\/\d+\/images$/.test(req.url)
      )
    ) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập.',
      });
    }
    return true;
  },
};

describe('Media HTTP contract and real authorization guard', () => {
  let app: INestApplication;
  const media = {
    listPublic: vi.fn(),
    listManaged: vi.fn(),
    upload: vi.fn(),
    reconcile: vi.fn(),
    remove: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AuthModule,
        MediaModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AccessTokenGuard)
      .useValue(access)
      .overrideProvider(MediaService)
      .useValue(media)
      .compile();
    app = module.createNestApplication();
    configureApi(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    principal = {
      taiKhoanId: 1,
      sessionId: 'qa',
      nhaXeId: 3,
      nhanVienId: 2,
      roles: ['NHA_XE_ADMIN'],
      permissions: ['vehicle:read', 'vehicle:update'],
    };
    media.listPublic.mockResolvedValue({ data: [] });
    media.listManaged.mockResolvedValue({ data: [] });
    media.upload.mockResolvedValue({ data: { mediaId, status: 'SAN_SANG' } });
    media.reconcile.mockResolvedValue({ data: { mediaId } });
    media.remove.mockResolvedValue(undefined);
  });

  it('allows public image listing but requires authentication for management and upload', async () => {
    principal = undefined;
    await request(app.getHttpServer())
      .get('/api/v1/media/vehicles/14/images')
      .expect(200, { data: [] });
    await request(app.getHttpServer())
      .get('/api/v1/media/vehicles/14/images/manage')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .expect(401);
    expect(media.upload).not.toHaveBeenCalled();
  });

  it('requires tenant vehicle:update, blocking customer, super-admin and read-only staff', async () => {
    const owner = principal!;
    for (const changed of [
      { ...owner, roles: ['KHACH_HANG'], nhanVienId: null, nhaXeId: null },
      { ...owner, roles: ['SUPER_ADMIN'], nhanVienId: null, nhaXeId: null },
      { ...owner, roles: ['NHAN_VIEN_CSKH'], permissions: ['vehicle:read'] },
    ]) {
      principal = changed;
      await request(app.getHttpServer())
        .post('/api/v1/media/vehicles/14/images')
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/media/vehicles/14/images/${mediaId}`)
        .expect(403);
    }
    expect(media.upload).not.toHaveBeenCalled();
    expect(media.remove).not.toHaveBeenCalled();
  });

  it('passes multipart bytes and requestId without accepting user folder parameters', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .field('requestId', requestId)
      .attach('file', Buffer.from('service separately validates image bytes'), {
        filename: 'qa.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(media.upload).toHaveBeenCalledWith(
      14,
      requestId,
      expect.objectContaining({
        buffer: expect.any(Buffer),
        mimetype: 'image/png',
      }),
      expect.objectContaining({ nhaXeId: 3 }),
    );
    await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .field('requestId', requestId)
      .field('folder', 'vexgo/prod/other-owner')
      .expect(400);
    expect(media.upload).toHaveBeenCalledOnce();
  });

  it('rejects an invalid request UUID and invalid vehicle ID before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .field('requestId', 'not-a-uuid')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/media/vehicles/0/images')
      .expect(400);
    expect(media.upload).not.toHaveBeenCalled();
    expect(media.listPublic).not.toHaveBeenCalled();
  });

  it('rejects more than 5MB before the service/provider processes the upload', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .field('requestId', requestId)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'oversize.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(media.upload).not.toHaveBeenCalled();
  });

  it('exposes only read-only reconciliation and logical remove operations', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/media/vehicles/14/images/${mediaId}/reconcile`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/media/vehicles/14/images/${mediaId}`)
      .expect(204);
    expect(media.reconcile).toHaveBeenCalledWith(
      14,
      mediaId,
      expect.objectContaining({ nhaXeId: 3 }),
    );
    expect(media.remove).toHaveBeenCalledWith(
      14,
      mediaId,
      expect.objectContaining({ nhaXeId: 3 }),
    );
  });
  it('preserves the uncertain-upload contract through the global error filter', async () => {
    media.upload.mockRejectedValueOnce(
      new ConflictException({
        error: 'MEDIA_UPLOAD_UNCERTAIN',
        message: 'Giữ requestId và đối soát; không tải lại bằng requestId mới.',
      }),
    );
    const response = await request(app.getHttpServer())
      .post('/api/v1/media/vehicles/14/images')
      .field('requestId', requestId)
      .attach('file', Buffer.from('test transport'), {
        filename: 'qa.png',
        contentType: 'image/png',
      })
      .expect(409);
    expect(response.body.error).toBe('MEDIA_UPLOAD_UNCERTAIN');
    expect(response.body.message).toContain('requestId');
  });
  it('rate-limits uploads independently from read-only media management', async () => {
    let limited = false;
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/media/vehicles/14/images')
        .field('requestId', 'invalid');
      if (response.status === 429) {
        limited = true;
        break;
      }
      expect(response.status).toBe(400);
    }
    expect(limited).toBe(true);
    await request(app.getHttpServer())
      .get('/api/v1/media/vehicles/14/images/manage')
      .expect(200);
    expect(media.upload).not.toHaveBeenCalled();
  });
});
