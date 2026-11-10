import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { AiChatbotController } from '../../../src/ai-chatbot/ai-chatbot.controller.js';
import { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import { AiBusinessToolsService } from '../../../src/ai-chatbot/tools/ai-business-tools.service.js';
import { HybridRetrievalService } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import { PermissionResolverService } from '../../../src/auth/permissions/permission-resolver.service.js';
import { EffectiveRolePermissionLoaderService } from '../../../src/auth/permissions/effective-role-permission-loader.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { configureApi } from '../../../src/common/configure-api.js';

const TOKEN = 'f82e184a-84cf-4b1b-b0aa-593885779451';
const SECRET = 'ai-chatbot-http-fixture-secret-at-least-32';

// Real HTTP/controller/guard/JWT/services, in-memory Prisma records. No live DB
// and no external LLM. This suite does not claim MySQL or device E2E evidence.
describe('AI chatbot HTTP session authorization', () => {
  let app: INestApplication;
  let ownerJwt: string, otherJwt: string;
  let sessions: Map<string, Record<string, unknown>>;
  let messages: Array<Record<string, unknown>>;
  const prisma = {
    phienDangNhap: {
      findUnique: vi.fn(async ({ where }) => {
        const id =
          where.sessionId === 'owner'
            ? 101
            : where.sessionId === 'other'
              ? 202
              : null;
        return id == null
          ? null
          : {
              sessionId: where.sessionId,
              taiKhoanId: id,
              thuHoiLuc: null,
              hetHanLuc: new Date(Date.now() + 3600000),
              taiKhoan: {
                taiKhoanId: id,
                loaiTaiKhoan: 'KHACH_HANG',
                trangThai: 'HOAT_DONG',
                khoaDenNgay: null,
                lyDoKhoa: null,
                nhanVien: null,
                taiKhoanVaiTros: [
                  { vaiTro: { vaiTroId: 1, tenVaiTro: 'KHACH_HANG' } },
                ],
              },
            };
      }),
    },
    khachHang: {
      findUnique: vi.fn(async ({ where }) =>
        where.taiKhoanId != null
          ? { khachHangId: where.taiKhoanId === 101 ? 11 : 22 }
          : { taiKhoanId: where.khachHangId === 11 ? 101 : 202 },
      ),
    },
    aiChatSession: {
      findUnique: vi.fn(async ({ where }) => {
        const s = sessions.get(where.sessionToken);
        return s
          ? { ...s, messages: messages.filter((m) => m.sessionId === s.id) }
          : null;
      }),
      create: vi.fn(async ({ data }) => {
        const s = { id: sessions.size + 1, createdAt: new Date(), ...data };
        sessions.set(data.sessionToken, s);
        return s;
      }),
      update: vi.fn(async ({ where, data }) => {
        const s = [...sessions.values()].find((s) => s.id === where.id)!;
        Object.assign(s, data);
        return s;
      }),
    },
    aiChatMessage: {
      create: vi.fn(async ({ data }) => {
        const m = {
          id: messages.length + 1,
          createdAt: new Date(),
          citations: null,
          toolCalls: null,
          requiresHumanHandoff: false,
          ...data,
        };
        messages.push(m);
        return m;
      }),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AiChatbotController],
      providers: [
        AiChatbotService,
        AiChatbotOrchestratorService,
        AccessTokenGuard,
        PermissionResolverService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_ACCESS_SECRET: SECRET }),
        },
        { provide: JwtService, useValue: new JwtService({ secret: SECRET }) },
        { provide: PrismaService, useValue: prisma },
        {
          provide: EffectiveRolePermissionLoaderService,
          useValue: { load: vi.fn(async () => []) },
        },
        {
          provide: HybridRetrievalService,
          useValue: { retrieve: vi.fn(async () => []) },
        },
        { provide: AiBusinessToolsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApi(app);
    app.useGlobalGuards(module.get(AccessTokenGuard));
    await app.init();
    const jwt = module.get(JwtService);
    ownerJwt = jwt.sign({ sub: 101, sid: 'owner', roles: ['KHACH_HANG'] });
    otherJwt = jwt.sign({ sub: 202, sid: 'other', roles: ['KHACH_HANG'] });
  });
  beforeEach(() => {
    sessions = new Map([
      [
        TOKEN,
        {
          id: 1,
          sessionToken: TOKEN,
          khachHangId: 11,
          status: 'ACTIVE',
          createdAt: new Date(),
        },
      ],
    ]);
    messages = [
      {
        id: 1,
        sessionId: 1,
        role: 'ASSISTANT',
        content: 'Synthetic private reply',
        intent: 'GENERAL',
        createdAt: new Date(),
        citations: null,
        toolCalls: null,
        requiresHumanHandoff: false,
      },
    ];
  });
  afterAll(async () => {
    await app?.close();
  });

  it('history requires owner JWT for owned sessions and rejects invalid JWT', async () => {
    const path = `/api/v1/ai-chatbot/sessions/${TOKEN}/messages`;
    const guest = await request(app.getHttpServer()).get(path).expect(403);
    const other = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${otherJwt}`)
      .expect(403);
    expect(JSON.stringify([guest.body, other.body])).not.toContain(
      'Synthetic private reply',
    );
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    const own = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${ownerJwt}`)
      .expect(200);
    expect(own.body.data.messages[0].content).toBe('Synthetic private reply');
  });

  it('POST rejects cross-owner session without writing; owner gets full persisted exchange', async () => {
    const path = '/api/v1/ai-chatbot/messages';
    const payload = { message: 'Gặp nhân viên hỗ trợ', sessionToken: TOKEN };
    await request(app.getHttpServer()).post(path).send(payload).expect(403);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${otherJwt}`)
      .send(payload)
      .expect(403);
    expect(messages.length).toBe(1);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${ownerJwt}`)
      .send(payload)
      .expect(200);
    expect(messages.slice(1).map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
  });

  it('guest capability session survives history/reply, suggestions remain public', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/ai-chatbot/messages')
      .send({ message: 'Gặp nhân viên hỗ trợ' })
      .expect(200);
    const token = first.body.data.sessionToken;
    const read = await request(app.getHttpServer())
      .get(`/api/v1/ai-chatbot/sessions/${token}/messages`)
      .expect(200);
    expect(
      read.body.data.messages.map((m: { role: string }) => m.role),
    ).toEqual(['USER', 'ASSISTANT']);
    await request(app.getHttpServer())
      .post('/api/v1/ai-chatbot/messages')
      .send({ message: 'Gặp nhân viên hỗ trợ', sessionToken: token })
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/ai-chatbot/suggestions')
      .expect(200);
  });

  it('validates UUID and bounded non-empty message, before processing', async () => {
    for (const body of [
      { message: '  ' },
      { message: 'x'.repeat(2001) },
      { message: 'x', sessionToken: '../other' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/ai-chatbot/messages')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .get('/api/v1/ai-chatbot/sessions/not-a-uuid/messages')
      .expect(400);
    expect(messages.length).toBe(1);
  });
});
