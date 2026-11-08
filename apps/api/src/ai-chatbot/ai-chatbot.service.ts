import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AiChatbotOrchestratorService,
  type ChatbotResponse,
} from './orchestrator/ai-chatbot-orchestrator.service.js';
import type { SendMessageDto } from './dto/send-message.dto.js';
import { assertAiSessionAccess } from './ai-session-access.js';
import { AiChatbotSettingsService } from './admin/ai-chatbot-settings.service.js';

export interface DefaultSuggestion {
  id: string;
  category: string;
  question: string;
  description: string;
}

const DEFAULT_SUGGESTIONS: DefaultSuggestion[] = [
  {
    id: 'sug-cancel',
    category: 'CHINH_SACH',
    question: 'Chính sách hoàn hủy vé thế nào?',
    description: 'Biểu phí hủy vé theo thời gian và điều kiện hoàn tiền',
  },
  {
    id: 'sug-baggage',
    category: 'QUY_DINH',
    question: 'Quy định hành lý mang theo ra sao?',
    description: 'Hành lý xách tay, ký gửi miễn cước và hàng hóa quá khổ',
  },
  {
    id: 'sug-trip-dalat',
    category: 'TIM_CHUYEN',
    question: 'Tìm chuyến xe từ TP.HCM đi Đà Lạt',
    description: 'Tra cứu chuyến xe, lịch khởi hành và số ghế trống hôm nay',
  },
  {
    id: 'sug-payment-deadline',
    category: 'THANH_TOAN',
    question: 'Thời gian giữ vé thanh toán là bao lâu?',
    description: 'Thời hạn hoàn tất thanh toán sau khi đặt giữ ghế',
  },
  {
    id: 'sug-promotion',
    category: 'UU_DAI',
    question: 'Các mã khuyến mãi đang áp dụng?',
    description: 'Mã giảm giá đặt vé và ưu đãi bưu kiện hiện hành',
  },
];

@Injectable()
export class AiChatbotService {
  constructor(
    private readonly orchestrator: AiChatbotOrchestratorService,
    private readonly prisma: PrismaService,
    @Optional() private readonly settingsService?: AiChatbotSettingsService,
  ) {}

  /**
   * Tính toán SHA-256 hash của canonical payload phục vụ kiểm tra idempotency
   */
  computePayloadHash(dto: SendMessageDto): string {
    const canonical = JSON.stringify({
      message: dto.message.trim(),
      nhaXeId: dto.nhaXeId ?? null,
      sessionToken: dto.sessionToken?.trim() ?? null,
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Xử lý tin nhắn người dùng và sinh câu trả lời có căn cứ
   * Tích hợp Idempotency & Concurrency Lease khi có requestId
   */
  async sendMessage(
    dto: SendMessageDto,
    taiKhoanId?: number,
  ): Promise<ChatbotResponse> {
    const requestId = dto.requestId?.trim();
    if (!requestId) {
      // 100% Backward compatible: không có requestId thì xử lý thông thường
      return this.orchestrator.processUserMessage({
        message: dto.message,
        sessionToken: dto.sessionToken,
        nhaXeId: dto.nhaXeId,
        taiKhoanId,
      });
    }

    // 1. Đọc cấu hình hệ thống (hoặc giá trị mặc định)
    let ttlDays = 7;
    let leaseSeconds = 60;
    if (this.settingsService) {
      const settings = await this.settingsService.getSettings();
      ttlDays = settings.idempotencyTtlDays;
      leaseSeconds = settings.leaseDurationSeconds;
    }

    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    const payloadHash = this.computePayloadHash(dto);

    // Tính toán recovery key hash cho khách vãng lai
    let recoveryKeyHash: string | null = null;
    if (dto.recoveryKey?.trim()) {
      recoveryKeyHash = crypto
        .createHash('sha256')
        .update(dto.recoveryKey.trim())
        .digest('hex');
    } else if (dto.sessionToken?.trim()) {
      recoveryKeyHash = crypto
        .createHash('sha256')
        .update(dto.sessionToken.trim())
        .digest('hex');
    }

    // 2. Tra cứu bản ghi AiChatRequest hiện có
    if (this.prisma.aiChatRequest) {
      const existing = await this.prisma.aiChatRequest.findUnique({
        where: { requestId },
      });

      if (existing) {
        // Kiểm tra quyền sở hữu đối với tài khoản đăng nhập
        if (existing.taiKhoanId != null && existing.taiKhoanId !== taiKhoanId) {
          throw new ForbiddenException({
            error: 'ACCESS_DENIED',
            message: 'Bạn không có quyền truy cập yêu cầu này.',
          });
        }

        // Kiểm tra sai lệch nội dung payload (Payload Mismatch)
        if (existing.payloadHash !== payloadHash) {
          throw new ConflictException({
            error: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
            message: 'Mã yêu cầu (requestId) đã tồn tại nhưng có nội dung khác.',
          });
        }

        // Nếu đã hoàn thành thành công: trả ngay kết quả lưu sẵn, không gọi lại LLM
        if (existing.status === 'COMPLETED' && existing.responsePayload) {
          return existing.responsePayload as unknown as ChatbotResponse;
        }

        // Nếu đang xử lý (PROCESSING)
        if (existing.status === 'PROCESSING') {
          if (existing.leaseUntil && existing.leaseUntil > now) {
            throw new ConflictException({
              error: 'IDEMPOTENCY_CONCURRENT_PROCESSING',
              message: 'Yêu cầu đang được xử lý, vui lòng chờ trong giây lát.',
            });
          }
          // Lease đã hết hạn (Crash window): Reclaim lease nguyên tử
          const updateResult = await this.prisma.aiChatRequest.updateMany({
            where: {
              requestId,
              status: 'PROCESSING',
              OR: [{ leaseUntil: { lte: now } }, { leaseUntil: null }],
            },
            data: { leaseUntil },
          });
          if (updateResult.count === 0) {
            throw new ConflictException({
              error: 'IDEMPOTENCY_CONCURRENT_PROCESSING',
              message: 'Yêu cầu đang được xử lý, vui lòng chờ trong giây lát.',
            });
          }
        } else if (existing.status === 'FAILED') {
          // Lần trước thất bại: cho phép thử lại với lease mới
          await this.prisma.aiChatRequest.update({
            where: { requestId },
            data: {
              status: 'PROCESSING',
              leaseUntil,
              errorMessage: null,
              errorCode: null,
            },
          });
        }
      } else {
        // Tạo mới bản ghi AiChatRequest
        try {
          await this.prisma.aiChatRequest.create({
            data: {
              requestId,
              payloadHash,
              status: 'PROCESSING',
              sessionToken: dto.sessionToken?.trim() || null,
              taiKhoanId: taiKhoanId ?? null,
              recoveryKeyHash,
              leaseUntil,
              expiresAt,
            },
          });
        } catch (err: unknown) {
          if ((err as { code?: string })?.code === 'P2002') {
            // Đụng độ race condition: bản ghi vừa được tạo bởi request song song
            const raceExisting = await this.prisma.aiChatRequest.findUnique({
              where: { requestId },
            });
            if (raceExisting?.payloadHash !== payloadHash) {
              throw new ConflictException({
                error: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
                message:
                  'Mã yêu cầu (requestId) đã tồn tại nhưng có nội dung khác.',
              });
            }
            if (raceExisting?.status === 'COMPLETED' && raceExisting.responsePayload) {
              return raceExisting.responsePayload as unknown as ChatbotResponse;
            }
            throw new ConflictException({
              error: 'IDEMPOTENCY_CONCURRENT_PROCESSING',
              message: 'Yêu cầu đang được xử lý, vui lòng chờ trong giây lát.',
            });
          }
          throw err;
        }
      }
    }

    // 3. Thực thi xử lý câu hỏi qua Orchestrator
    let response: ChatbotResponse;
    try {
      response = await this.orchestrator.processUserMessage({
        message: dto.message,
        sessionToken: dto.sessionToken,
        nhaXeId: dto.nhaXeId,
        taiKhoanId,
        requestId,
      });
    } catch (err) {
      if (this.prisma.aiChatRequest) {
        await this.prisma.aiChatRequest
          .update({
            where: { requestId },
            data: {
              status: 'FAILED',
              errorMessage: err instanceof Error ? err.message : String(err),
              errorCode:
                (err as { response?: { error?: string } })?.response?.error ||
                'AI_PROCESSING_ERROR',
              leaseUntil: null,
            },
          })
          .catch(() => {});
      }
      throw err;
    }

    // 4. Lưu kết quả COMPLETED và trả về
    if (this.prisma.aiChatRequest) {
      await this.prisma.aiChatRequest
        .update({
          where: { requestId },
          data: {
            status: 'COMPLETED',
            sessionToken: response.sessionToken,
            responsePayload: response as unknown as Prisma.InputJsonValue,
            leaseUntil: null,
          },
        })
        .catch(() => {});
    }

    return response;
  }

  /**
   * Tra cứu trạng thái yêu cầu hoặc phục hồi kết quả khi client mất mạng
   */
  async getRequestStatus(
    requestId: string,
    recoveryKey?: string,
    taiKhoanId?: number,
  ) {
    if (!this.prisma.aiChatRequest) {
      throw new NotFoundException({
        error: 'AI_REQUEST_NOT_FOUND',
        message: 'Không tìm thấy yêu cầu tương ứng với requestId.',
      });
    }

    const request = await this.prisma.aiChatRequest.findUnique({
      where: { requestId },
    });

    if (!request) {
      throw new NotFoundException({
        error: 'AI_REQUEST_NOT_FOUND',
        message: 'Không tìm thấy yêu cầu tương ứng với requestId.',
      });
    }

    // Kiểm tra phân quyền truy cập
    if (request.taiKhoanId != null) {
      if (request.taiKhoanId !== taiKhoanId) {
        throw new ForbiddenException({
          error: 'ACCESS_DENIED',
          message: 'Bạn không có quyền truy cập yêu cầu này.',
        });
      }
    } else {
      // Khách vãng lai: Kiểm tra recoveryKey hoặc sessionToken
      if (request.recoveryKeyHash) {
        if (!recoveryKey?.trim()) {
          throw new ForbiddenException({
            error: 'RECOVERY_KEY_REQUIRED',
            message:
              'Yêu cầu của khách vãng lai cần mã xác minh (recovery key).',
          });
        }
        const passedHash = crypto
          .createHash('sha256')
          .update(recoveryKey.trim())
          .digest('hex');
        if (passedHash !== request.recoveryKeyHash) {
          throw new ForbiddenException({
            error: 'RECOVERY_KEY_INVALID',
            message: 'Mã xác minh yêu cầu không chính xác.',
          });
        }
      }
    }

    // Trả về cấu trúc trạng thái tương ứng
    if (request.status === 'COMPLETED') {
      return {
        data: {
          requestId: request.requestId,
          status: 'COMPLETED',
          sessionToken: request.sessionToken,
          result: request.responsePayload,
        },
      };
    }

    if (request.status === 'PROCESSING') {
      return {
        data: {
          requestId: request.requestId,
          status: 'PROCESSING',
          sessionToken: request.sessionToken,
        },
      };
    }

    return {
      data: {
        requestId: request.requestId,
        status: 'FAILED',
        sessionToken: request.sessionToken,
        error: request.errorCode || 'AI_REQUEST_FAILED',
        message: request.errorMessage,
      },
    };
  }

  /**
   * Khôi phục lịch sử tin nhắn của phiên hội thoại AI
   */
  async getSessionMessages(sessionToken: string, taiKhoanId?: number) {
    const session = await this.prisma.aiChatSession.findUnique({
      where: { sessionToken },
      include: {
        messages: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            role: true,
            content: true,
            intent: true,
            citations: true,
            toolCalls: true,
            requiresHumanHandoff: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        error: 'SESSION_NOT_FOUND',
        message: 'Không tìm thấy phiên hội thoại.',
      });
    }

    await assertAiSessionAccess(this.prisma, session.khachHangId, taiKhoanId);
    return {
      sessionToken: session.sessionToken,
      status: session.status,
      createdAt: session.createdAt,
      messages: session.messages,
    };
  }

  /**
   * Lấy danh sách câu hỏi gợi ý nhanh mặc định
   */
  getSuggestions(): DefaultSuggestion[] {
    return DEFAULT_SUGGESTIONS;
  }
}
