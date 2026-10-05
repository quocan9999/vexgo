import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TicketsController } from '../../../src/tickets/tickets.controller.js';
import { TicketsService } from '../../../src/tickets/tickets.service.js';

describe('Public ticket lookup rate limit', () => {
  let app: INestApplication;
  const lookupTicket = vi.fn().mockResolvedValue({
    data: { ticketId: 1, ticketCode: 'VE-001' },
  });
  const cancelTicket = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
      ],
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            findCustomerTickets: vi.fn(),
            findCustomerTicketById: vi.fn(),
            lookupTicket,
            cancelTicket,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 429 after ten lookups from the same client', async () => {
    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/tickets/lookup')
        .send({ ticketCode: 'VE-001', phoneNumber: '0912345678' })
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .post('/api/v1/tickets/lookup')
      .send({ ticketCode: 'VE-001', phoneNumber: '0912345678' })
      .expect(429);

    expect(response.body.statusCode).toBe(429);
    expect(lookupTicket).toHaveBeenCalledTimes(10);
  });

  it('rejects cancellation without an explicitly confirmed quote rate', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/tickets/cancel')
      .send({ ticketCode: 'VE-001', phoneNumber: '0912345678' })
      .expect(400);

    expect(cancelTicket).not.toHaveBeenCalled();
  });
});
