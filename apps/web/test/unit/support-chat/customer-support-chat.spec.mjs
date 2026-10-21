import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  mapBusCompanyDto,
  supportChatApi,
  SupportChatApiError,
} from '../../../src/features/support-chat/services/support-chat.api.ts';

describe('FE-01: Customer Support Chat Bus Company Contract & Flow Regression Tests', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Test A — API Mapping & Contract Validation (GET /api/v1/bus-companies)', () => {
    it('maps backend response { busCompanyId, code, name, contactInfo, status, createdAt, updatedAt } into valid BusCompany items', async () => {
      const mockBackendPayload = {
        data: [
          {
            busCompanyId: 12,
            code: 'FUTA',
            name: 'Phương Trang FUTA Bus Lines',
            contactInfo: '1900 6067 - hotro@futabus.vn',
            status: 'HOAT_DONG',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-10T00:00:00.000Z',
          },
          {
            busCompanyId: 25,
            code: 'THANHBUOI',
            name: 'Nhà Xe Thành Bưởi',
            contactInfo: null,
            status: 'HOAT_DONG',
            createdAt: '2026-04-02T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          pageSize: 50,
          totalItems: 2,
          totalPages: 1,
        },
      };

      const requestedUrls = [];
      globalThis.fetch = async (url) => {
        requestedUrls.push(String(url));
        return new Response(JSON.stringify(mockBackendPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const companies = await supportChatApi.getActiveBusCompanies('Phương Trang');

      assert.equal(requestedUrls.length, 1);
      assert.match(requestedUrls[0], /\/bus-companies\?status=HOAT_DONG&pageSize=50&search=Ph%C6%B0%C6%A1ng\+Trang/);
      assert.equal(companies.length, 2);

      assert.deepEqual(companies[0], {
        busCompanyId: 12,
        code: 'FUTA',
        name: 'Phương Trang FUTA Bus Lines',
        contactInfo: '1900 6067 - hotro@futabus.vn',
        status: 'HOAT_DONG',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-10T00:00:00.000Z',
      });

      assert.deepEqual(companies[1], {
        busCompanyId: 25,
        code: 'THANHBUOI',
        name: 'Nhà Xe Thành Bưởi',
        contactInfo: null,
        status: 'HOAT_DONG',
        createdAt: '2026-04-02T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      });
    });

    it('throws SupportChatApiError(INVALID_BUS_COMPANY_RESPONSE) if backend item is missing busCompanyId or name', () => {
      assert.throws(
        () => mapBusCompanyDto({ nhaXeId: 12, tenNhaXe: 'Legacy Schema Without busCompanyId' }),
        (err) =>
          err instanceof SupportChatApiError &&
          err.error === 'INVALID_BUS_COMPANY_RESPONSE',
      );
    });
  });

  describe('Test B — Customer Flow: Select Company -> Check Active Conversation -> Create Conversation', () => {
    it('passes valid numeric busCompanyId to GET /support-chat/bus-companies/:id/active-conversation and POST /support-chat/conversations (never undefined)', async () => {
      const apiCalls = [];

      globalThis.fetch = async (url, init = {}) => {
        const urlStr = String(url);
        const method = init.method || 'GET';
        const body = init.body ? JSON.parse(String(init.body)) : undefined;
        apiCalls.push({ url: urlStr, method, body });

        if (urlStr.includes('/bus-companies?')) {
          return new Response(
            JSON.stringify({
              data: [
                {
                  busCompanyId: 42,
                  code: 'HAIVAN',
                  name: 'Nhà Xe Hải Vân',
                  contactInfo: null,
                  status: 'HOAT_DONG',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (urlStr.endsWith('/support-chat/bus-companies/42/active-conversation')) {
          return new Response(JSON.stringify({ statusCode: 404, error: 'NOT_FOUND' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (urlStr.endsWith('/support-chat/conversations') && method === 'POST') {
          return new Response(
            JSON.stringify({
              data: {
                cuocTroChuyenId: 900,
                maCuocTroChuyen: 'CHAT-900',
                tieuDe: body.tieuDe,
                trangThai: 'CHO_TIEP_NHAN',
                nhaXeId: body.nhaXeId,
                khachHangId: 7,
                nhaXe: {
                  nhaXeId: body.nhaXeId,
                  tenNhaXe: 'Nhà Xe Hải Vân',
                  logo: null,
                  hotline: '',
                },
              },
            }),
            { status: 201, headers: { 'Content-Type': 'application/json' } },
          );
        }

        throw new Error(`Unexpected fetch call: ${method} ${urlStr}`);
      };

      // 1. Tải danh sách nhà xe từ contract thật
      const companies = await supportChatApi.getActiveBusCompanies();
      assert.equal(companies.length, 1);
      const selectedCompany = companies[0];
      assert.equal(selectedCompany.busCompanyId, 42);
      assert.equal(selectedCompany.name, 'Nhà Xe Hải Vân');
      assert.equal(selectedCompany.contactInfo, null);

      // 2. Chọn nhà xe -> gọi getActiveConversation với selectedCompany.busCompanyId
      const activeConv = await supportChatApi.getActiveConversation(
        selectedCompany.busCompanyId,
        'mock-jwt-token',
      );
      assert.equal(activeConv, null);

      // 3. Mở cuộc trò chuyện mới -> gọi createConversation với nhaXeId = selectedCompany.busCompanyId
      const createdConv = await supportChatApi.createConversation(
        {
          nhaXeId: selectedCompany.busCompanyId,
          tieuDe: `Hỗ trợ khách hàng - ${selectedCompany.name}`,
          tinNhanDauTien: 'Cho mình hỏi lịch chạy tuyến Đà Nẵng - Huế',
          clientMessageId: 'client-test-id-1',
        },
        'mock-jwt-token',
      );

      assert.equal(createdConv.cuocTroChuyenId, 900);
      assert.equal(createdConv.nhaXeId, 42);

      // Xác minh tuyệt đối không có URL nào chứa "undefined" và payload POST có nhaXeId: 42
      assert.equal(apiCalls.length, 3);
      assert.equal(apiCalls[1].url.includes('undefined'), false);
      assert.match(apiCalls[1].url, /\/support-chat\/bus-companies\/42\/active-conversation$/);
      assert.deepEqual(apiCalls[2].body, {
        nhaXeId: 42,
        tieuDe: 'Hỗ trợ khách hàng - Nhà Xe Hải Vân',
        tinNhanDauTien: 'Cho mình hỏi lịch chạy tuyến Đà Nẵng - Huế',
        clientMessageId: 'client-test-id-1',
      });
    });

    it('rejects invalid/undefined nhaXeId before issuing network requests to prevent /bus-companies/undefined/active-conversation', async () => {
      let networkCalled = false;
      globalThis.fetch = async () => {
        networkCalled = true;
        return new Response('{}', { status: 200 });
      };

      await assert.rejects(
        () => supportChatApi.getActiveConversation(undefined, 'mock-jwt-token'),
        (err) =>
          err instanceof SupportChatApiError &&
          err.status === 400 &&
          err.error === 'INVALID_BUS_COMPANY_ID',
      );

      await assert.rejects(
        () =>
          supportChatApi.createConversation(
            { nhaXeId: Number.NaN, tinNhanDauTien: 'Hello' },
            'mock-jwt-token',
          ),
        (err) =>
          err instanceof SupportChatApiError &&
          err.status === 400 &&
          err.error === 'INVALID_BUS_COMPANY_ID',
      );

      assert.equal(networkCalled, false);
    });
  });
});
