import { Controller, Delete, HttpCode, Param, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { configureApi } from '../../../src/common/configure-api.js';
import { ConfigModule } from '@nestjs/config';

@Controller('seat-holds')
class MockSeatHoldsLoggerController {
  @Delete(':holdToken')
  @HttpCode(200)
  releaseSeatHoldParam(@Param('holdToken') _holdToken: string) {
    return { success: true };
  }

  @Delete()
  @HttpCode(200)
  releaseSeatHoldDirect() {
    return { success: true };
  }
}

describe('Global HTTP Request Logger Sanitization (Integration - discussion_r4226252855)', () => {
  let app: INestApplication;
  let consoleLogSpy: any;
  const capturedLogs: string[] = [];

  const rawSignedHoldToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmlwSWQiOjUwLCJzZWF0cyI6WzEwMV0sImV4cCI6MTc2MDAwMDAwMCwibm9uY2UiOiI1NTBhZjEwOC1mMTFkLTQ1OTAtYTY2ZC0yOTAxZTIzYWRhMTIifQ.SAMPLE_SIGNATURE_SECRET';

  beforeAll(async () => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      capturedLogs.push(args.join(' '));
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ CORS_ALLOWED_ORIGINS: 'http://localhost:3000' })],
        }),
      ],
      controllers: [MockSeatHoldsLoggerController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    if (consoleLogSpy) {
      consoleLogSpy.mockRestore();
    }
    if (app) {
      await app.close();
    }
  });

  it('captures global HTTP request log and guarantees raw holdToken is NEVER logged', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/api/v1/seat-holds/${rawSignedHoldToken}`)
      .expect(200);

    expect(response.body).toEqual({ data: { success: true } });

    // Verify that the global middleware actually logged the request
    const matchingLog = capturedLogs.find((line) => line.includes('[API REQUEST]'));
    expect(matchingLog).toBeDefined();

    // Regression Assertion: raw holdToken MUST NOT appear in the log output
    expect(matchingLog).not.toContain(rawSignedHoldToken);

    // Regression Assertion: redacted mask MUST be present in the logged message
    expect(matchingLog).toContain('/api/v1/seat-holds/[REDACTED_HOLD_TOKEN]');
  });

  it('safely logs DELETE /seat-holds via request body/header without leaking credentials', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/v1/seat-holds')
      .set('x-hold-token', rawSignedHoldToken)
      .send({ holdToken: rawSignedHoldToken })
      .expect(200);

    expect(response.body).toEqual({ data: { success: true } });

    const matchingLog = capturedLogs.find(
      (line) => line.includes('[API REQUEST]') && line.includes('DELETE /api/v1/seat-holds ->'),
    );
    expect(matchingLog).toBeDefined();
    expect(matchingLog).not.toContain(rawSignedHoldToken);
  });
});
