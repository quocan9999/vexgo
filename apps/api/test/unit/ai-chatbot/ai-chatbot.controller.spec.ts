import { describe, expect, it, vi } from 'vitest';
import { AiChatbotController } from '../../../src/ai-chatbot/ai-chatbot.controller.js';
import type { AiChatbotService } from '../../../src/ai-chatbot/ai-chatbot.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('AiChatbotController', () => {
  const mockService = {
    sendMessage: vi.fn().mockResolvedValue({
      sessionToken: 'test-session-uuid',
      reply: 'Chào bạn, tôi là trợ lý ảo VexGo AI!',
      intent: 'GENERAL',
      citations: [],
      suggestedQuestions: ['Chính sách hủy vé?'],
      requiresHumanHandoff: false,
      latencyMs: 45,
    }),
    getSessionMessages: vi.fn().mockResolvedValue({
      sessionToken: 'test-session-uuid',
      status: 'ACTIVE',
      messages: [],
    }),
    getSuggestions: vi.fn().mockReturnValue([
      {
        id: 'sug-cancel',
        category: 'CHINH_SACH',
        question: 'Chính sách hoàn hủy vé thế nào?',
        description: 'Biểu phí hủy vé theo thời gian',
      },
    ]),
  } as unknown as AiChatbotService;

  const controller = new AiChatbotController(mockService);

  it('should process sendMessage endpoint with optional principal', async () => {
    const principal: AuthPrincipal = {
      taiKhoanId: 101,
      sessionId: 'sess-1',
      roles: ['KHACH_HANG'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    const res = await controller.sendMessage(
      { message: 'Xin chào AI' },
      principal,
    );

    expect(mockService.sendMessage).toHaveBeenCalledWith(
      { message: 'Xin chào AI' },
      101,
    );
    expect(res.reply).toBe('Chào bạn, tôi là trợ lý ảo VexGo AI!');
  });

  it('should retrieve session messages by sessionToken', async () => {
    const res = await controller.getSessionMessages('test-session-uuid');
    expect(mockService.getSessionMessages).toHaveBeenCalledWith(
      'test-session-uuid',
      undefined,
    );
    expect(res.sessionToken).toBe('test-session-uuid');
  });

  it('should return default suggestions', () => {
    const res = controller.getSuggestions();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('sug-cancel');
  });
});
