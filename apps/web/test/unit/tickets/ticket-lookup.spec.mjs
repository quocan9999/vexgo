import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { ticketsApi } from '../../../src/features/account/services/tickets.api.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('ticketsApi.lookupTicket sends trimmed parameters and returns data envelope', async () => {
  let requestedUrl = '';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      data: {
        ticketId: 10,
        ticketCode: 'FUTA-PDV-001',
        route: 'TP.HCM - Đà Lạt',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
        busCompanyName: 'Phương Trang',
        vehicleType: 'Giường nằm 34 chỗ',
        departureTime: '2026-10-15T15:30:00.000Z',
        seatNumber: 'A01',
        seatPosition: 'Tầng 1',
        price: 250000,
        status: 'DA_THANH_TOAN',
        passengerName: 'Nguyễn Văn A',
        passengerPhone: '0901234567',
      },
    });
  };

  const response = await ticketsApi.lookupTicket('  FUTA-PDV-001  ', ' 0901234567 ');

  assert.equal(
    requestedUrl,
    'http://localhost:4000/api/v1/tickets/lookup?ticketCode=FUTA-PDV-001&phoneNumber=0901234567',
  );
  assert.equal(response.data.ticketCode, 'FUTA-PDV-001');
  assert.equal(response.data.seatNumber, 'A01');
  assert.equal(response.data.price, 250000);
});

test('ticketsApi.lookupTicket throws ApiError with status 404 when ticket is not found', async () => {
  globalThis.fetch = async () => {
    return jsonResponse(
      {
        statusCode: 404,
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      },
      404,
    );
  };

  await assert.rejects(
    async () => {
      await ticketsApi.lookupTicket('INVALID-CODE', '0901234567');
    },
    (err) => {
      assert.equal(err.name, 'ApiError');
      assert.equal(err.status, 404);
      assert.equal(
        err.message,
        'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      );
      return true;
    },
  );
});

test('ticketsApi.lookupTicket throws ApiError with status 429 when rate limited', async () => {
  globalThis.fetch = async () => {
    return jsonResponse(
      {
        statusCode: 429,
        message: 'ThrottlerException: Too Many Requests',
      },
      429,
    );
  };

  await assert.rejects(
    async () => {
      await ticketsApi.lookupTicket('FUTA-001', '0901234567');
    },
    (err) => {
      assert.equal(err.name, 'ApiError');
      assert.equal(err.status, 429);
      assert.equal(err.message, 'ThrottlerException: Too Many Requests');
      return true;
    },
  );
});

test('ticketsApi.cancelTicket sends POST request with body and returns cancellation data', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  let requestedBody = '';

  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedMethod = options?.method || 'GET';
    requestedBody = options?.body || '';
    return jsonResponse({
      data: {
        ticketId: 10,
        ticketCode: 'FUTA-PDV-001',
        status: 'HUY',
        cancelFee: 25000,
        refundAmount: 225000,
        message: 'Hủy vé thành công.',
      },
    });
  };

  const response = await ticketsApi.cancelTicket('  FUTA-PDV-001  ', ' 0901234567 ', 'Thay đổi kế hoạch');

  assert.equal(requestedUrl, 'http://localhost:4000/api/v1/tickets/cancel');
  assert.equal(requestedMethod, 'POST');
  assert.deepEqual(JSON.parse(requestedBody), {
    ticketCode: 'FUTA-PDV-001',
    phoneNumber: '0901234567',
    reason: 'Thay đổi kế hoạch',
  });
  assert.equal(response.data.status, 'HUY');
  assert.equal(response.data.refundAmount, 225000);
});

test('ticketsApi.cancelTicket throws ApiError when cancellation fails', async () => {
  globalThis.fetch = async () => {
    return jsonResponse(
      {
        statusCode: 400,
        error: 'TICKET_ALREADY_CANCELLED',
        message: 'Vé này đã được hủy trước đó.',
      },
      400,
    );
  };

  await assert.rejects(
    async () => {
      await ticketsApi.cancelTicket('FUTA-001', '0901234567');
    },
    (err) => {
      assert.equal(err.name, 'ApiError');
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Vé này đã được hủy trước đó.');
      return true;
    },
  );
});
