import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import type { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { SupportChatService } from '../../../src/support-chat/support-chat.service.js';
import type { SupportChatGateway } from '../../../src/support-chat/support-chat.gateway.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('AiChatbotService - Handoff to Support Chat (Mục 1 & 2)', () => {
  let service: AiChatbotService;
  let mockOrchestrator: any;
  let mockPrisma: any;
  let mockSupportChatService: any;
  let mockChatGateway: any;

  const SESSION_TOKEN = 'c2e4293e-2b5d-4f1a-8c65-0d2d3e9501a2';
  const REQUEST_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
  const NHA_XE_ID = 10;
  const TAI_KHOAN_ID = 100;
  const KHACH_HANG_ID = 50;

  const mockCustomerPrincipal: AuthPrincipal = {
    taiKhoanId: TAI_KHOAN_ID,
    sessionId: 'session-auth-uuid-1',
    roles: ['KHACH_HANG'],
    permissions: [],
    nhaXeId: null,
    nhanVienId: null,
    loaiTaiKhoan: 'KHACH_HANG' as any,
  };

  beforeEach(() => {
    mockOrchestrator = {
      processUserMessage: vi.fn(),
      cleanReplyText: vi.fn((text: string) => text),
    };

    mockPrisma = {
      aiChatSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          sessionToken: SESSION_TOKEN,
          khachHangId: KHACH_HANG_ID,
          status: 'ACTIVE',
        }),
      },
      khachHang: {
        findUnique: vi.fn().mockResolvedValue({
          khachHangId: KHACH_HANG_ID,
          taiKhoanId: TAI_KHOAN_ID,
        }),
      },
      nhaXe: {
        findUnique: vi.fn().mockResolvedValue({
          nhaXeId: NHA_XE_ID,
          tenNhaXe: 'Nhà xe Phương Trang',
          trangThai: 'HOAT_DONG',
        }),
      },
      aiChatMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            sessionId: 1,
            role: 'USER',
            content: 'Tôi muốn tìm xe Sài Gòn đi Đà Lạt ngày mai',
          },
          {
            id: 2,
            sessionId: 1,
            role: 'ASSISTANT',
            content: 'Dạ chuyến sớm nhất lúc 6h sáng giá 300.000đ ạ.',
          },
        ]),
      },
      aiChatRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ requestId: REQUEST_ID, status: 'PROCESSING' }),
        update: vi.fn().mockResolvedValue({ requestId: REQUEST_ID, status: 'COMPLETED' }),
      },
    };

    mockSupportChatService = {
      createConversation: vi.fn().mockResolvedValue({
        conversation: {
          cuocTroChuyenId: 101,
          maCuocTroChuyen: 'conv-uuid-101',
          trangThai: 'CHO_TIEP_NHAN',
          nhaXeId: NHA_XE_ID,
          khachHangId: KHACH_HANG_ID,
          tieuDe: 'Hỗ trợ từ Chatbot AI - Nhà xe Phương Trang',
        },
        isNew: true,
        firstMessage: {
          tinNhanId: 501,
          cuocTroChuyenId: 101,
          noiDung: '[Yêu cầu hỗ trợ từ Trợ lý AI VexGo]...',
          loaiNguoiGui: 'KHACH_HANG',
        },
      }),
    };

    mockChatGateway = {
      emitConversationNew: vi.fn().mockResolvedValue(undefined),
      emitMessageNew: vi.fn().mockResolvedValue(undefined),
      server: {
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      },
    };

    service = new AiChatbotService(
      mockOrchestrator as unknown as AiChatbotOrchestratorService,
      mockPrisma as unknown as PrismaService,
      undefined,
      mockSupportChatService as unknown as SupportChatService,
      mockChatGateway as unknown as SupportChatGateway,
    );
  });

  describe('handoffToSupportChat', () => {
    it('should successfully handoff to support chat, create conversation, and emit realtime events', async () => {
      const res = await service.handoffToSupportChat(
        SESSION_TOKEN,
        {
          nhaXeId: NHA_XE_ID,
          requestId: REQUEST_ID,
          clientNote: 'Cần hỗ trợ đổi vé gấp',
        },
        mockCustomerPrincipal,
      );

      expect(res).toEqual({
        conversationId: 101,
        status: 'CHO_TIEP_NHAN',
        created: true,
      });

      expect(mockSupportChatService.createConversation).toHaveBeenCalledWith(
        mockCustomerPrincipal,
        expect.objectContaining({
          nhaXeId: NHA_XE_ID,
          clientMessageId: REQUEST_ID,
          tinNhanDauTien: expect.stringContaining('Cần hỗ trợ đổi vé gấp'),
        }),
      );

      const firstCallArgs = mockSupportChatService.createConversation.mock.calls[0][1];
      expect(firstCallArgs.tinNhanDauTien).toContain('[Khách hàng]:\nTôi muốn tìm xe Sài Gòn đi Đà Lạt ngày mai');
      expect(firstCallArgs.tinNhanDauTien).toContain('[Trợ lý AI]:\nDạ chuyến sớm nhất lúc 6h sáng giá 300.000đ ạ.');
      expect(firstCallArgs.tinNhanDauTien).toContain('--- Lịch sử trao đổi gần nhất với AI ---');

      expect(mockPrisma.aiChatRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: REQUEST_ID },
          data: expect.objectContaining({
            status: 'COMPLETED',
            responsePayload: {
              conversationId: 101,
              status: 'CHO_TIEP_NHAN',
              created: true,
            },
          }),
        }),
      );

      expect(mockChatGateway.emitConversationNew).toHaveBeenCalledWith(
        expect.objectContaining({ cuocTroChuyenId: 101 }),
      );
      expect(mockChatGateway.emitMessageNew).toHaveBeenCalled();
    });

    it('should return existing conversationId when re-submitting with identical requestId (idempotency)', async () => {
      const payloadHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            action: 'handoff',
            sessionToken: SESSION_TOKEN,
            nhaXeId: NHA_XE_ID,
            clientNote: '',
          }),
        )
        .digest('hex');

      mockPrisma.aiChatRequest.findUnique.mockResolvedValue({
        requestId: REQUEST_ID,
        payloadHash,
        status: 'COMPLETED',
        responsePayload: {
          conversationId: 101,
          status: 'CHO_TIEP_NHAN',
          created: false,
        },
      });

      const res = await service.handoffToSupportChat(
        SESSION_TOKEN,
        {
          nhaXeId: NHA_XE_ID,
          requestId: REQUEST_ID,
        },
        mockCustomerPrincipal,
      );

      expect(res).toEqual({
        conversationId: 101,
        status: 'CHO_TIEP_NHAN',
        created: false,
      });
      expect(mockSupportChatService.createConversation).not.toHaveBeenCalled();
      expect(mockChatGateway.emitConversationNew).not.toHaveBeenCalled();
    });

    it('should throw ConflictException (IDEMPOTENCY_PAYLOAD_MISMATCH) when same requestId has different nhaXeId', async () => {
      mockPrisma.aiChatRequest.findUnique.mockResolvedValue({
        requestId: REQUEST_ID,
        payloadHash: 'different-hash-from-different-payload',
        status: 'COMPLETED',
        responsePayload: { conversationId: 101, status: 'CHO_TIEP_NHAN', created: false },
      });

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException (REQUEST_IN_PROGRESS) when request is currently PROCESSING', async () => {
      const payloadHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            action: 'handoff',
            sessionToken: SESSION_TOKEN,
            nhaXeId: NHA_XE_ID,
            clientNote: '',
          }),
        )
        .digest('hex');

      mockPrisma.aiChatRequest.findUnique.mockResolvedValue({
        requestId: REQUEST_ID,
        payloadHash,
        status: 'PROCESSING',
      });

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException (AUTHENTICATION_REQUIRED) when principal is missing or not KHACH_HANG', async () => {
      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          undefined,
        ),
      ).rejects.toThrow(ForbiddenException);

      const staffPrincipal = { ...mockCustomerPrincipal, roles: ['NHAN_VIEN'] };
      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          staffPrincipal,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException (AI_SESSION_FORBIDDEN) when customer tries to handoff another customer session', async () => {
      mockPrisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: KHACH_HANG_ID,
        taiKhoanId: 9999, // different account
      });

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException (SESSION_NOT_FOUND) when session does not exist', async () => {
      mockPrisma.aiChatSession.findUnique.mockResolvedValue(null);

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException (BUS_COMPANY_NOT_FOUND) when nhaXe is inactive or not found', async () => {
      mockPrisma.nhaXe.findUnique.mockResolvedValue(null);

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark AiChatRequest as FAILED when supportChatService throws an unhandled error', async () => {
      mockSupportChatService.createConversation.mockRejectedValue(
        new Error('Database deadlock'),
      );

      await expect(
        service.handoffToSupportChat(
          SESSION_TOKEN,
          {
            nhaXeId: NHA_XE_ID,
            requestId: REQUEST_ID,
          },
          mockCustomerPrincipal,
        ),
      ).rejects.toThrow('Database deadlock');

      expect(mockPrisma.aiChatRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: REQUEST_ID },
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'Database deadlock',
          }),
        }),
      );
    });
  });
});
