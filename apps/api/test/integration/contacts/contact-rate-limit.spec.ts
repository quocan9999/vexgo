import { type INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContactsController } from '../../../src/contacts/contacts.controller.js';
import { ContactsService } from '../../../src/contacts/contacts.service.js';

describe('Public contact submission rate limit', () => {
  let app: INestApplication;
  const create = vi.fn().mockResolvedValue({
    data: {
      contactId: 1,
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0912345678',
      email: null,
      subject: 'Hỗ trợ',
      message: 'Nội dung',
      status: 'CHO_XU_LY',
      createdAt: '2026-10-02T08:00:00.000Z',
      updatedAt: '2026-10-02T08:00:00.000Z',
    },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
      ],
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: { create } }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 429 after five submissions from the same client', async () => {
    const payload = {
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0912345678',
      subject: 'Hỗ trợ',
      message: 'Nội dung cần hỗ trợ',
    };

    for (let index = 0; index < 5; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .send(payload)
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .send(payload)
      .expect(429);

    expect(response.body.statusCode).toBe(429);
    expect(create).toHaveBeenCalledTimes(5);
  });
});
