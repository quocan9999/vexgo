import { ConfigService } from '@nestjs/config';
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import { AiBusinessToolsService } from '../../../src/ai-chatbot/tools/ai-business-tools.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { HybridRetrievalService } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import type { TicketsService } from '../../../src/tickets/tickets.service.js';
import { HybridRetrievalService as Retrieval } from '../../../src/ai-chatbot/retrieval/hybrid-retrieval.service.js';
import { DEFAULT_KNOWLEDGE_DOCUMENTS } from '../../../src/ai-chatbot/seed/default-knowledge.data.js';
import { sanitizeRequestUrl } from '../../../src/common/configure-api.js';

const TOKEN = 'e82e184a-84cf-4b1b-b0aa-593885779451';
function setup(owner: number | null = null) {
  const rows: Array<Record<string, unknown>> = [];
  const prisma = {
    khachHang: {
      findUnique: vi.fn(async ({ where }) =>
        where.taiKhoanId != null
          ? { khachHangId: where.taiKhoanId === 101 ? 11 : 22 }
          : { taiKhoanId: where.khachHangId === 11 ? 101 : 202 },
      ),
    },
    aiChatSession: {
      findUnique: vi.fn(async () => ({
        id: 1,
        sessionToken: TOKEN,
        khachHangId: owner,
        status: 'ACTIVE',
        createdAt: new Date(),
        messages: [],
        khachHang:
          owner == null ? null : { taiKhoanId: owner === 11 ? 101 : 202 },
      })),
      create: vi.fn(async ({ data }) => ({ id: 1, ...data })),
      update: vi.fn(async () => ({})),
    },
    aiChatMessage: {
      create: vi.fn(async ({ data }) => {
        rows.push(data);
        return { id: rows.length, ...data };
      }),
    },
  };
  const retrieval = { retrieve: vi.fn(async () => []) };
  const tools = {
    lookupTicketStatus: vi.fn(),
    lookupShipmentStatus: vi.fn(),
    searchAvailableTrips: vi.fn(async () => ({ trips: [] })),
    getActivePromotions: vi.fn(async () => ({ promotions: [] })),
  };
  const orchestrator = new AiChatbotOrchestratorService(
    new ConfigService({}),
    retrieval as unknown as HybridRetrievalService,
    tools as unknown as AiBusinessToolsService,
    prisma as unknown as PrismaService,
  );
  const service = new AiChatbotService(
    orchestrator,
    prisma as unknown as PrismaService,
  );
  return { prisma, retrieval, tools, orchestrator, service, rows };
}

// Synthetic records only; these exercise the real services, not an LLM or live DB.
function ticket() {
  return {
    maVe: 'TK-QA-001',
    veId: 1,
    trangThai: 'HUY',
    giaThucTe: 0,
    giaNiemYet: 190000,
    phieuDatVe: {
      maPhieuDatVe: 'BK-QA-001',
      donGiaoDich: {
        soDienThoaiKhachHang: '0912345678',
        tenKhachHang: 'QA synthetic',
        thanhToans: [],
      },
    },
    gheChuyenXe: {
      ghe: { tenGhe: 'A01' },
      chuyenXe: {
        maChuyenXe: 'QA',
        ngayKhoiHanh: new Date('2026-11-09'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
        tuyenXe: { diemDi: 'A', diemDen: 'B', nhaXe: { tenNhaXe: 'QA' } },
      },
    },
  };
}

describe('AI chatbot security and recovery regressions', () => {
  it('owned history denies guest and another authenticated customer', async () => {
    const { service, prisma } = setup(11);
    await expect(service.getSessionMessages(TOKEN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getSessionMessages(TOKEN, 202)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getSessionMessages(TOKEN, 101)).resolves.toMatchObject(
      { sessionToken: TOKEN },
    );
    expect(prisma.aiChatSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          }),
        }),
      }),
    );
  });

  it('owned session cannot be reused by a guest or another customer', async () => {
    const { orchestrator, prisma } = setup(11);
    await expect(
      orchestrator.processUserMessage({
        message: 'Xin chào',
        sessionToken: TOKEN,
        taiKhoanId: 202,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      orchestrator.processUserMessage({
        message: 'Xin chào',
        sessionToken: TOKEN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.aiChatMessage.create).not.toHaveBeenCalled();
  });

  it('guest capability sessions still work, but account sessions retain their owner', async () => {
    const guest = setup();
    await expect(
      guest.service.getSessionMessages(TOKEN),
    ).resolves.toMatchObject({ sessionToken: TOKEN });
    const owned = setup(11);
    await expect(
      owned.orchestrator.processUserMessage({
        message: 'Gặp nhân viên hỗ trợ',
        sessionToken: TOKEN,
        taiKhoanId: 101,
      }),
    ).resolves.toMatchObject({ requiresHumanHandoff: true });
  });

  it('ticket lookup rejects missing and partial phone before querying personal data', async () => {
    const prisma = { ve: { findFirst: vi.fn(async () => ticket()) } };
    const tools = new AiBusinessToolsService(
      prisma as unknown as PrismaService,
    );
    await expect(
      tools.lookupTicketStatus({ ticketCode: 'TK-QA-001' }),
    ).rejects.toThrow();
    await expect(
      tools.lookupTicketStatus({
        ticketCode: 'TK-QA-001',
        phoneNumber: '912345678',
      }),
    ).rejects.toThrow();
    expect(prisma.ve.findFirst).not.toHaveBeenCalled();
  });

  it('shipment lookup rejects missing phone before querying personal data', async () => {
    const prisma = {
      phieuGuiHang: {
        findFirst: vi.fn(async () => ({
          maVanDon: 'WB123',
          donGiaoDich: { soDienThoaiKhachHang: '0912345678', thanhToans: [] },
          diemGui: {},
          diemNhan: {},
          hangHoas: [],
        })),
      },
    };
    const tools = new AiBusinessToolsService(
      prisma as unknown as PrismaService,
    );
    await expect(
      tools.lookupShipmentStatus({ shipmentCode: 'WB123' }),
    ).rejects.toThrow();
    expect(prisma.phieuGuiHang.findFirst).not.toHaveBeenCalled();
  });

  it('ticket lookup uses authoritative cancellation quote and preserves zero price', async () => {
    const prisma = { ve: { findFirst: vi.fn(async () => ticket()) } };
    const tickets = {
      lookupTicket: vi.fn(async () => ({
        data: {
          cancellation: {
            eligible: false,
            reason: 'TICKET_CANCELLED',
            cancelFeeRate: 0.2,
          },
        },
      })),
    };
    const tools = new AiBusinessToolsService(
      prisma as unknown as PrismaService,
      undefined,
      tickets as unknown as TicketsService,
    );
    const result = await tools.lookupTicketStatus({
      ticketCode: 'TK-QA-001',
      phoneNumber: '0912345678',
    });
    expect(tickets.lookupTicket).toHaveBeenCalled();
    expect(result).toMatchObject({
      price: 0,
      cancellationEligible: false,
      cancellationFeeRate: 0.2,
    });
  });

  it('persists USER before ASSISTANT for every acknowledged request, including handoff', async () => {
    const { orchestrator, rows } = setup();
    await orchestrator.processUserMessage({
      message: 'Gặp nhân viên hỗ trợ',
      sessionToken: TOKEN,
    });
    expect(rows.map((r) => r.role)).toEqual(['USER', 'ASSISTANT']);
    expect(rows[0].content).toBe('Gặp nhân viên hỗ trợ');
  });

  it('does not acknowledge a reply if session/message persistence fails', async () => {
    const { orchestrator, prisma } = setup();
    prisma.aiChatSession.findUnique.mockRejectedValueOnce(
      new Error('synthetic DB outage'),
    );
    await expect(
      orchestrator.processUserMessage({
        message: 'Xin chào',
        sessionToken: TOKEN,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.aiChatMessage.create).not.toHaveBeenCalled();
  });

  it('handoff asks user to open support instead of claiming an agent is connected', async () => {
    const { orchestrator } = setup();
    const result = await orchestrator.processUserMessage({
      message: 'Gặp nhân viên hỗ trợ',
      sessionToken: TOKEN,
    });
    expect(result.requiresHumanHandoff).toBe(true);
    expect(result.reply).not.toContain('đang kết nối');
  });

  it('does not reuse a guest capability after switching to a logged-in identity', async () => {
    const { orchestrator, prisma } = setup();
    await expect(
      orchestrator.processUserMessage({
        message: 'Xin chào',
        sessionToken: TOKEN,
        taiKhoanId: 101,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.aiChatMessage.create).not.toHaveBeenCalled();
  });

  it('binds a new account session to principal customer, rejects unresolved identity', async () => {
    const { orchestrator, prisma } = setup();
    prisma.aiChatSession.findUnique.mockResolvedValueOnce(null as never);
    await orchestrator.processUserMessage({
      message: 'Gặp nhân viên hỗ trợ',
      taiKhoanId: 101,
      khachHangId: 999,
    });
    expect(prisma.aiChatSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ khachHangId: 11 }),
      }),
    );
    prisma.khachHang.findUnique.mockResolvedValueOnce(null as never);
    await expect(
      orchestrator.processUserMessage({ message: 'Xin chào', taiKhoanId: 101 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('missing phone asks for verification, never invokes either private lookup tool', async () => {
    const { orchestrator, tools } = setup();
    for (const message of ['Tra cứu vé TK-QA-001', 'Tra cứu vận đơn WB123']) {
      const reply = await orchestrator.processUserMessage({ message });
      expect(reply.reply).toContain('số điện thoại');
    }
    expect(tools.lookupTicketStatus).not.toHaveBeenCalled();
    expect(tools.lookupShipmentStatus).not.toHaveBeenCalled();
  });

  it('wrong full phone cannot reveal a ticket; +84 is normalized before authoritative lookup', async () => {
    const prisma = { ve: { findFirst: vi.fn(async () => ticket()) } };
    const tickets = {
      lookupTicket: vi.fn(async () => ({
        data: {
          cancellation: {
            eligible: false,
            reason: 'ALREADY_CANCELLED',
            cancelFeeRate: 0,
          },
        },
      })),
    };
    const tools = new AiBusinessToolsService(
      prisma as unknown as PrismaService,
      undefined,
      tickets as unknown as TicketsService,
    );
    await expect(
      tools.lookupTicketStatus({
        ticketCode: 'TK-QA-001',
        phoneNumber: '0987654321',
      }),
    ).rejects.toThrow();
    expect(tickets.lookupTicket).not.toHaveBeenCalled();
    await tools.lookupTicketStatus({
      ticketCode: 'TK-QA-001',
      phoneNumber: '+84912345678',
    });
    expect(tickets.lookupTicket).toHaveBeenCalledWith({
      ticketCode: 'TK-QA-001',
      phoneNumber: '0912345678',
    });
  });

  it('shipment accepts only exact sender/recipient phone and rejects suffix-only matches', async () => {
    const row = {
      maVanDon: 'WB123',
      trangThai: 'MOI_TAO',
      tongPhi: 50000,
      tenNguoiNhan: 'Synthetic',
      soDienThoaiNguoiNhan: '0987654321',
      donGiaoDich: {
        maDonGiaoDich: 'QA',
        tenKhachHang: 'Synthetic',
        soDienThoaiKhachHang: '0912345678',
        thanhToans: [],
      },
      diemGui: { tenDiem: 'A', diaChi: 'A' },
      diemNhan: { tenDiem: 'B', diaChi: 'B' },
      hangHoas: [],
    };
    const prisma = { phieuGuiHang: { findFirst: vi.fn(async () => row) } };
    const tools = new AiBusinessToolsService(
      prisma as unknown as PrismaService,
    );
    await expect(
      tools.lookupShipmentStatus({
        shipmentCode: 'WB123',
        phoneNumber: '+84987654321',
      }),
    ).resolves.toMatchObject({ waybillCode: 'WB123' });
    await expect(
      tools.lookupShipmentStatus({
        shipmentCode: 'WB123',
        phoneNumber: '0977777777',
      }),
    ).rejects.toThrow();
    await expect(
      tools.lookupShipmentStatus({
        shipmentCode: 'WB123',
        phoneNumber: '987654321',
      }),
    ).rejects.toThrow();
  });

  it('message persistence failures are not silently acknowledged', async () => {
    for (const failingCall of [1, 2]) {
      const { orchestrator, prisma } = setup();
      const base = prisma.aiChatMessage.create.getMockImplementation()!;
      let calls = 0;
      prisma.aiChatMessage.create.mockImplementation(async (args) => {
        if (++calls === failingCall)
          throw new Error('synthetic persistence failure');
        return base(args);
      });
      await expect(
        orchestrator.processUserMessage({
          message: 'Gặp nhân viên hỗ trợ',
          sessionToken: TOKEN,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('redacts guest session capabilities from request logging', () => {
    expect(
      sanitizeRequestUrl(`/api/v1/ai-chatbot/sessions/${TOKEN}/messages`),
    ).not.toContain(TOKEN);
  });

  it('retires only the exact old global refund default and regenerates chunks outside the transaction', async () => {
    const updated = DEFAULT_KNOWLEDGE_DOCUMENTS.find(
      (d) => d.documentCode === 'DOC-CANCEL-POLICY',
    )!;
    const old = `1. Thời gian và mức phí hủy vé xe trực tuyến:
- Hủy vé trước giờ khởi hành trên 24 tiếng: Mức phí hủy vé là 10% giá vé thực tế. Hành khách được hoàn lại 90% số tiền đã thanh toán.
- Hủy vé trong khoảng từ 2.5 tiếng (2 giờ 30 phút) đến 24 tiếng trước giờ khởi hành: Mức phí hủy vé áp dụng là 20% giá vé. Hành khách được hoàn lại 80% số tiền.
- Thời gian dưới 2.5 tiếng trước giờ khởi hành hoặc khi chuyến xe đã xuất bến: Hệ thống trực tuyến không hỗ trợ hủy vé tự động. Hành khách cần liên hệ trực tiếp với tổng đài nhà xe hoặc quầy vé tại bến xe để được xem xét theo quy chế đặc thù.

2. Điều kiện ràng buộc khi hủy vé:
- Đối với đơn đặt vé combo có kèm dịch vụ ký gửi hàng hóa hoặc bưu kiện: Hành khách không thể hủy vé trực tuyến nếu bưu kiện đang trong trạng thái xử lý hoặc chưa được hủy. Vui lòng hủy bưu kiện trước hoặc liên hệ bộ phận hỗ trợ.
- Tiền hoàn sẽ được hệ thống xử lý tự động và chuyển về tài khoản ngân hàng hoặc ví điện tử hành khách đã dùng để thanh toán trong vòng 24 đến 48 giờ làm việc.`;
    for (const customized of [false, true]) {
      let transactionActive = false;
      const tx = {
        aiKnowledgeDocument: { updateMany: vi.fn(async () => ({ count: 1 })) },
        aiKnowledgeChunk: { deleteMany: vi.fn(async () => ({})) },
      };
      const p = {
        aiKnowledgeDocument: {
          findUnique: vi.fn(async ({ where }) => {
            const d = DEFAULT_KNOWLEDGE_DOCUMENTS.find(
              (d) => d.documentCode === where.documentCode,
            )!;
            return {
              id: 1,
              scope: 'GLOBAL',
              nhaXeId: null,
              rawContent:
                d.documentCode === updated.documentCode
                  ? customized
                    ? 'Custom approved policy'
                    : old
                  : d.rawContent,
              chunks: [{ id: 1 }],
            };
          }),
        },
        aiKnowledgeChunk: { create: vi.fn(async () => ({})) },
        $transaction: vi.fn(async (fn) => {
          transactionActive = true;
          try {
            return await fn(tx);
          } finally {
            transactionActive = false;
          }
        }),
      };
      const embeddings = {
        embedPassages: vi.fn(async () => {
          expect(transactionActive).toBe(false);
          return [[1, 0]];
        }),
      };
      const chunker = {
        splitText: vi.fn(() => [
          {
            chunkIndex: 0,
            headerPrefix: 'QA',
            rawContent: 'manual refund',
            groundedContent: 'manual refund',
          },
        ]),
      };
      const service = new Retrieval(
        p as unknown as PrismaService,
        embeddings as never,
        chunker as never,
      );
      await service.ensureKnowledgeIndexed();
      expect(p.$transaction).toHaveBeenCalledTimes(customized ? 0 : 1);
      expect(p.aiKnowledgeChunk.create).toHaveBeenCalledTimes(
        customized ? 0 : 1,
      );
      if (!customized)
        expect(tx.aiKnowledgeDocument.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ data: { rawContent: updated.rawContent } }),
        );
    }
  });
});
