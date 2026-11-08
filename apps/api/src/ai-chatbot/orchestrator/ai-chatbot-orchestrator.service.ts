import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { assertAiSessionAccess } from '../ai-session-access.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  HybridRetrievalService,
  type RetrievedChunk,
} from '../retrieval/hybrid-retrieval.service.js';
import {
  AiBusinessToolsService,
  type TripSearchResultItem,
} from '../tools/ai-business-tools.service.js';
import { AiChatbotSettingsService } from '../admin/ai-chatbot-settings.service.js';

export interface ChatbotRequest {
  message: string;
  sessionToken?: string;
  nhaXeId?: number;
  khachHangId?: number;
  taiKhoanId?: number;
  requestId?: string;
}

export interface CitationItem {
  documentCode: string;
  title: string;
  hierarchyPath: string;
  relevanceScore: number;
}

export interface ChatbotResponse {
  sessionToken: string;
  reply: string;
  intent: string;
  citations: CitationItem[];
  suggestedTrips?: TripSearchResultItem[];
  suggestedQuestions?: string[];
  requiresHumanHandoff: boolean;
  handoffReason?: string;
  latencyMs: number;
  requestId?: string;
}

const GENERATION_TEMPERATURE = 0.15;

const EXPLICIT_HUMAN_KEYWORDS = [
  'gap nhan vien',
  'tong dai vien',
  'nguoi that',
  'tu van vien',
  'gap truc tiep',
  'nhan vien ho tro',
  'tong dai',
  'chuyen may',
];

const NEGATIVE_CRISIS_KEYWORDS = [
  'lua dao',
  'bao cong an',
  'kien',
  'chiem doat',
  'mat tien',
  'an cap',
  'an cuop',
  'to cao',
  'khoi kien',
];

const EMERGENCY_KEYWORDS = [
  'tai nan',
  'hong xe',
  'bo quen khach',
  'that lac hanh ly',
  'quen do',
  'bo roi',
  'cap cuu',
  'khan cap',
];

function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

@Injectable()
export class AiChatbotOrchestratorService {
  private readonly logger = new Logger(AiChatbotOrchestratorService.name);
  private readonly groqApiKey?: string;
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly retrievalService: HybridRetrievalService,
    private readonly businessTools: AiBusinessToolsService,
    private readonly prisma: PrismaService,
    @Optional() private readonly settingsService?: AiChatbotSettingsService,
  ) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY')?.trim();
    this.baseUrl =
      this.configService.get<string>('AI_LLM_BASE_URL')?.trim() ||
      'https://api.groq.com/openai/v1';
    this.modelName =
      this.configService.get<string>('AI_LLM_MODEL')?.trim() ||
      'llama-3.3-70b-versatile';
  }

  getTemperature(): number {
    return GENERATION_TEMPERATURE;
  }

  /**
   * Lấy cấu hình hệ thống AI hiện hành (từ DB hoặc giá trị mặc định)
   */
  async getEffectiveSettings() {
    if (this.settingsService) {
      return this.settingsService.getSettings();
    }
    return {
      temperature: GENERATION_TEMPERATURE,
      contextHistoryLimit: 10,
      idempotencyTtlDays: 7,
      leaseDurationSeconds: 60,
    };
  }

  /**
   * Định dạng Prompt theo tiêu chuẩn XML Grounded In-Context Prompting:
   * <context> ... </context>
   * <realtime_data> ... </realtime_data>
   * <user_query> ... </user_query>
   */
  buildGroundedPrompt(
    contextChunks: RetrievedChunk[],
    realtimeData: unknown,
    userQuery: string,
  ): string {
    const contextContent =
      contextChunks.length > 0
        ? contextChunks
            .map(
              (c, i) =>
                `[Tài liệu ${i + 1}] Mã: ${c.documentCode}\nTiêu đề: ${c.documentTitle}\nMục: ${c.hierarchyPath}\nNội dung: ${c.rawContent}`,
            )
            .join('\n\n---\n\n')
        : 'Không có tài liệu chính sách liên quan đạt ngưỡng.';

    const realtimeContent = realtimeData
      ? JSON.stringify(realtimeData, null, 2)
      : 'Không có dữ liệu thời gian thực được gọi.';

    return `<context>
${contextContent}
</context>

<realtime_data>
${realtimeContent}
</realtime_data>

<user_query>
${userQuery}
</user_query>`;
  }

  /**
   * Luồng xử lý chính của Orchestrator điều phối toàn diện:
   * Kiểm tra Handoff -> Gọi Tool/RAG -> Prompting LLM -> Lưu vết lịch sử
   */
  async processUserMessage(request: ChatbotRequest): Promise<ChatbotResponse> {
    const startTime = Date.now();
    const rawMessage = request.message.trim();
    const cleanNormalized = removeVietnameseDiacritics(rawMessage);

    // 1. Quản lý phiên hội thoại AI (Session)
    const sessionToken = request.sessionToken?.trim() || crypto.randomUUID();
    let sessionId: number | undefined;
    let resolvedKhachHangId = request.khachHangId;

    try {
      if (request.taiKhoanId) {
        const customer = await this.prisma.khachHang.findUnique({
          where: { taiKhoanId: request.taiKhoanId },
          select: { khachHangId: true },
        });
        if (!customer)
          throw new ForbiddenException({
            error: 'AI_CUSTOMER_REQUIRED',
            message: 'Vui lòng dùng tài khoản khách hàng để bắt đầu hội thoại.',
          });
        resolvedKhachHangId = customer.khachHangId;
      } else {
        // Ownership only comes from the verified principal, never a caller hint.
        resolvedKhachHangId = undefined;
      }
      const session = await this.prisma.aiChatSession.findUnique({
        where: { sessionToken },
        select: { id: true, khachHangId: true },
      });
      if (session) {
        await assertAiSessionAccess(
          this.prisma,
          session.khachHangId,
          request.taiKhoanId,
        );
        sessionId = session.id;
      } else {
        const created = await this.prisma.aiChatSession.create({
          data: {
            sessionToken,
            khachHangId: resolvedKhachHangId ?? null,
            status: 'ACTIVE',
          },
        });
        sessionId = created.id;
      }
      // Persist the question before acknowledging any normal/handoff reply.
      await this.prisma.aiChatMessage.create({
        data: { sessionId, role: 'USER', content: rawMessage },
      });
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      this.logger.warn('Could not persist AI session/question.');
      throw new ServiceUnavailableException({
        error: 'AI_HISTORY_UNAVAILABLE',
        message:
          'Chưa lưu được hội thoại. Vui lòng kiểm tra lại lịch sử trước khi gửi lại.',
      });
    }

    // 2. Kiểm tra các điều kiện Handoff tiên nghiệm (Prior Conditions 1, 2, 3)
    if (EXPLICIT_HUMAN_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Bạn hãy chọn “Chat với nhân viên” để mở kênh CSKH của nhà xe. Tin nhắn này chưa tự kết nối hoặc gửi yêu cầu cho nhân viên.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'EXPLICIT_HUMAN_REQUEST',
        startTime,
        requestId: request.requestId,
      });
    }

    if (NEGATIVE_CRISIS_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'VexGo rất tiếc về trải nghiệm không tốt của bạn. Bạn hãy chọn “Chat với nhân viên” hoặc liên hệ trực tiếp nhà xe để được hỗ trợ khiếu nại. AI chưa tự gửi yêu cầu cho nhân viên.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'NEGATIVE_SENTIMENT_CRISIS',
        startTime,
        requestId: request.requestId,
      });
    }

    if (EMERGENCY_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Đây có thể là sự cố hành trình khẩn cấp. Bạn cần liên hệ trực tiếp tổng đài điều hành nhà xe hoặc chọn “Chat với nhân viên”. AI chưa tự liên hệ hoặc điều phối hỗ trợ.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'EMERGENCY_INCIDENT',
        startTime,
        requestId: request.requestId,
      });
    }

    // 3. Phân loại ý định nghiệp vụ & Gọi Tool Calling
    let detectedIntent = 'GENERAL';
    let realtimeData: unknown = null;
    let suggestedTrips: TripSearchResultItem[] | undefined;
    let toolExecutionConflict = false;

    try {
      // 3.1. Tìm kiếm chuyến xe
      if (
        cleanNormalized.includes('chuyen xe') ||
        cleanNormalized.includes('tim xe') ||
        cleanNormalized.includes('ve xe di') ||
        cleanNormalized.includes('ve xe tu') ||
        cleanNormalized.includes('co chuyen') ||
        (cleanNormalized.includes('di') && cleanNormalized.includes('den'))
      ) {
        detectedIntent = 'TRIP_SEARCH';
        const parsed = this.parseTripSearchQuery(rawMessage);
        const searchResult = await this.businessTools.searchAvailableTrips({
          originQuery: parsed.origin,
          destinationQuery: parsed.destination,
          departureDate: parsed.date,
          nhaXeId: request.nhaXeId,
        });
        realtimeData = searchResult;
        suggestedTrips = searchResult.trips;
      }
      // 3.2. Tra cứu vé xe
      else if (
        cleanNormalized.includes('tra cuu ve') ||
        cleanNormalized.includes('kiem tra ve') ||
        cleanNormalized.includes('ma ve') ||
        /tk-[0-9a-z-]+/i.test(rawMessage) ||
        /bk-[0-9a-z-]+/i.test(rawMessage)
      ) {
        detectedIntent = 'TICKET_LOOKUP';
        const codeMatch =
          rawMessage.match(/([A-Z0-9]{2,4}-[0-9A-Z-]+)/i)?.[1] ||
          rawMessage.match(/\b(TK[0-9A-Z]+)\b/i)?.[1] ||
          '';
        const phoneMatch = rawMessage.match(
          /(?<!\d)(\+84\d{9}|0\d{9})(?!\d)/,
        )?.[1];

        if (codeMatch && phoneMatch) {
          const ticketData = await this.businessTools.lookupTicketStatus({
            ticketCode: codeMatch,
            phoneNumber: phoneMatch,
          });
          realtimeData = ticketData;
        } else {
          realtimeData = {
            note: 'Vui lòng cung cấp mã vé (VD: TK-202610-001) và số điện thoại đặt vé để tra cứu.',
          };
        }
      }
      // 3.3. Tra cứu bưu kiện / vận đơn
      else if (
        cleanNormalized.includes('van don') ||
        cleanNormalized.includes('gui hang') ||
        cleanNormalized.includes('buu kien') ||
        cleanNormalized.includes('tra cuu hang') ||
        /\bwb[0-9a-z]+\b/i.test(rawMessage)
      ) {
        detectedIntent = 'SHIPMENT_LOOKUP';
        const wbMatch = rawMessage.match(/\b(WB[0-9A-Z]+)\b/i)?.[1] || '';
        const phoneMatch = rawMessage.match(
          /(?<!\d)(\+84\d{9}|0\d{9})(?!\d)/,
        )?.[1];

        if (wbMatch && phoneMatch) {
          const shipmentData = await this.businessTools.lookupShipmentStatus({
            shipmentCode: wbMatch,
            phoneNumber: phoneMatch,
          });
          realtimeData = shipmentData;
        } else {
          realtimeData = {
            note: 'Vui lòng cung cấp mã vận đơn (VD: WB12345678) và số điện thoại người gửi hoặc người nhận để xác minh.',
          };
        }
      }
      // 3.4. Khuyến mãi
      else if (
        cleanNormalized.includes('khuyen mai') ||
        cleanNormalized.includes('giam gia') ||
        cleanNormalized.includes('ma giam') ||
        cleanNormalized.includes('voucher')
      ) {
        detectedIntent = 'PROMOTION_INQUIRY';
        realtimeData = await this.businessTools.getActivePromotions({
          nhaXeId: request.nhaXeId,
        });
      }
    } catch (toolErr) {
      this.logger.error('AI business tool failed; no personal data returned.');
      toolExecutionConflict = true;
    }

    // Kích hoạt Handoff Condition 2: TOOL_EXECUTION_CONFLICT
    if (toolExecutionConflict) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Chưa tra cứu được dữ liệu giao dịch. Bạn hãy chọn “Chat với nhân viên” để được hỗ trợ đối soát; AI chưa tự kết nối với nhân viên.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'TOOL_EXECUTION_CONFLICT',
        startTime,
        requestId: request.requestId,
      });
    }

    // 4. Truy hồi RAG văn bản quy chế nếu không phải công cụ dữ liệu động thuần túy
    let retrievedChunks: RetrievedChunk[] = [];
    if (
      detectedIntent === 'GENERAL' ||
      cleanNormalized.includes('chinh sach') ||
      cleanNormalized.includes('quy dinh') ||
      cleanNormalized.includes('huy ve') ||
      cleanNormalized.includes('doi tra')
    ) {
      retrievedChunks = await this.retrievalService.retrieve(
        rawMessage,
        request.nhaXeId,
      );
      if (retrievedChunks.length > 0) {
        detectedIntent = 'POLICY_RAG';
      }
    }

    // Kích hoạt Handoff Condition 1: RAG_KNOWLEDGE_GAP
    // Khi câu hỏi yêu cầu chính sách/quy định nhưng tập RAG không có chunk nào đạt ngưỡng >= 0.60
    const isPolicyQuestion =
      cleanNormalized.includes('chinh sach') ||
      cleanNormalized.includes('quy dinh') ||
      cleanNormalized.includes('dieu kien') ||
      cleanNormalized.includes('duoc khong') ||
      cleanNormalized.includes('nhu the nao') ||
      cleanNormalized.includes('bao nhieu');

    if (isPolicyQuestion && retrievedChunks.length === 0 && !realtimeData) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Tôi chưa tìm thấy quy định chính xác cho câu hỏi này trong tài liệu hệ thống. Để đảm bảo thông tin chính xác nhất, tôi xin phép chuyển câu hỏi này tới nhân viên CSKH nhé!',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'RAG_KNOWLEDGE_GAP',
        startTime,
        requestId: request.requestId,
      });
    }

    // 5. Chuẩn bị Trích dẫn (Citations)
    const citations: CitationItem[] = retrievedChunks.map((c) => ({
      documentCode: c.documentCode,
      title: c.documentTitle,
      hierarchyPath: c.hierarchyPath,
      relevanceScore: Math.round(c.hybridScore * 100),
    }));

    // 6. Sinh phản hồi qua LLM (Groq API hoặc Template Grounded Fallback)
    const effectiveSettings = await this.getEffectiveSettings();
    const prompt = this.buildGroundedPrompt(
      retrievedChunks,
      realtimeData,
      rawMessage,
    );
    let reply = '';

    // Lấy ngữ cảnh hội thoại gần nhất dựa trên contextHistoryLimit
    let historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (
      sessionId &&
      effectiveSettings.contextHistoryLimit > 0 &&
      this.prisma.aiChatMessage
    ) {
      try {
        const pastRecords = await this.prisma.aiChatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
          take: effectiveSettings.contextHistoryLimit + 1,
        });
        // Bỏ qua câu hỏi hiện tại vừa tạo ở bước 1 (index 0) và đảo ngược theo thứ tự thời gian
        historyMessages = pastRecords
          .slice(1)
          .reverse()
          .map((m) => ({
            role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
            content: m.content,
          }));
      } catch {
        // Bỏ qua lỗi truy vấn lịch sử ngữ cảnh
      }
    }

    if (this.groqApiKey && !this.groqApiKey.includes('gsk....')) {
      reply = await this.callGroqLlm(
        prompt,
        effectiveSettings.temperature,
        historyMessages,
      );
    }

    if (!reply) {
      reply = this.generateGroundedFallbackReply(
        detectedIntent,
        retrievedChunks,
        realtimeData,
        suggestedTrips,
        rawMessage,
      );
    }

    // Làm sạch tuyệt đối các thẻ trích dẫn rò rỉ (như 【DOC-...】, [DOC-...]) khỏi câu trả lời gửi đến khách hàng
    reply = this.cleanReplyText(reply);

    return this.finalizeResponse({
      sessionId,
      sessionToken,
      reply,
      intent: detectedIntent,
      citations,
      suggestedTrips,
      requiresHumanHandoff: false,
      startTime,
      requestId: request.requestId,
    });
  }

  /**
   * Loại bỏ triệt để các mã tài liệu kỹ thuật, ký hiệu ngoặc vuông/ngoặc đen
   * để câu trả lời luôn sạch sẽ (Clean Output), thân thiện với khách hàng.
   */
  cleanReplyText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[【\[]\s*DOC-[A-Z0-9_-]+\s*[】\]]/gi, '')
      .replace(/【[^】]*】/g, '')
      .replace(/\(\s*Nguồn:[^)]*\)/gi, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Gọi Groq Cloud LLM (OpenAI compatible) với nhiệt độ và ngữ cảnh động theo cấu hình hệ thống
   */
  private async callGroqLlm(
    prompt: string,
    temperature = GENERATION_TEMPERATURE,
    historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature,
          messages: [
            {
              role: 'system',
              content: `Bạn là Trợ lý ảo VexGo AI thông minh và tận tâm hỗ trợ khách hàng đặt vé xe, gửi hàng hóa và giải đáp chính sách xe khách.
CHỈ TRẢ LỜI dựa trên các thông tin được cung cấp trong thẻ <context> và <realtime_data>.
TUYỆT ĐỐI KHÔNG tự bịa đặt hay suy đoán thông tin ngoài dữ liệu đã cho.
VexGo không hoàn tiền trực tuyến: sau khi hủy vé khách phải liên hệ hỗ trợ/nhà xe. Phí và quyền hủy phải dựa trên báo giá hủy của vé cụ thể, không mặc định 10%.
Không khẳng định đã kết nối nhân viên hoặc gửi khiếu nại: chỉ hướng dẫn khách mở kênh Chat với nhân viên.
TUYỆT ĐỐI KHÔNG chèn mã tài liệu kỹ thuật, mã văn bản hay các ký hiệu như 【DOC-...】, [DOC-...] vào câu trả lời. Trả lời văn phong tự nhiên, liền mạch, lịch sự và dễ hiểu cho khách hàng.
Trả lời ngắn gọn, lịch sự, rõ ràng bằng tiếng Việt.`,
            },
            ...historyMessages,
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content || '';
      }
    } catch (err) {
      this.logger.warn(`Groq LLM call error: ${String(err)}`);
    }
    return '';
  }

  /**
   * Phản hồi mẫu tất định tuân thủ XML Grounding khi LLM offline
   */
  private generateGroundedFallbackReply(
    intent: string,
    chunks: RetrievedChunk[],
    realtimeData: unknown,
    trips: TripSearchResultItem[] | undefined,
    userQuery: string,
  ): string {
    if (intent === 'POLICY_RAG' && chunks.length > 0) {
      const topChunk = chunks[0];
      return `Theo quy định hiện hành của VexGo:\n\n${topChunk.rawContent}`;
    }

    if (intent === 'TRIP_SEARCH') {
      if (trips && trips.length > 0) {
        const tripDescriptions = trips
          .map(
            (t) =>
              `- Chuyến ${t.code} (${t.operator}): Giờ chạy ${t.departureTime} ngày ${t.departureDate}. Giá: ${t.price ? t.price.toLocaleString('vi-VN') + 'đ' : 'Liên hệ'}. Còn ${t.availableSeats} ghế trống.`,
          )
          .join('\n');
        return `Tôi tìm thấy các chuyến xe phù hợp với lộ trình của bạn:\n\n${tripDescriptions}\n\nBạn có thể bấm vào thẻ chuyến xe bên dưới để chọn chỗ ngồi và đặt vé nhé!`;
      }
      return 'Hiện tại chưa tìm thấy chuyến xe phù hợp với thời gian và lộ trình yêu cầu của bạn. Bạn vui lòng thử lại với ngày khác hoặc liên hệ hotline nhà xe nhé.';
    }

    if (intent === 'TICKET_LOOKUP' && realtimeData) {
      const t = realtimeData as Record<string, unknown>;
      if (t.ticketCode) {
        return `Thông tin vé ${t.ticketCode}:\n- Tuyến: ${t.route}\n- Giờ khởi hành: ${t.departureTime}\n- Ghế: ${t.seatName}\n- Trạng thái: ${t.status}\n- Thanh toán: ${t.paymentStatus}`;
      }
      if (t.note) return String(t.note);
    }

    if (intent === 'SHIPMENT_LOOKUP' && realtimeData) {
      const s = realtimeData as Record<string, unknown>;
      if (s.waybillCode) {
        return `Thông tin bưu kiện ${s.waybillCode}:\n- Tuyến: ${s.route}\n- Điểm gửi: ${s.originPoint}\n- Điểm nhận: ${s.destinationPoint}\n- Trạng thái: ${s.statusText}\n- Tổng cước: ${Number(s.totalFee || 0).toLocaleString('vi-VN')}đ (${s.paymentStatus})`;
      }
      if (s.note) return String(s.note);
    }

    if (intent === 'PROMOTION_INQUIRY' && realtimeData) {
      const promoData = realtimeData as {
        promotions: Array<{
          code: string;
          name: string;
          discountValue: number;
          discountType: string;
          validUntil: string;
        }>;
      };
      if (promoData.promotions && promoData.promotions.length > 0) {
        const promoList = promoData.promotions
          .map(
            (p) =>
              `- Mã "${p.code}": ${p.name} (${p.discountType} ${p.discountValue.toLocaleString('vi-VN')}) - Hạn đến ${p.validUntil}`,
          )
          .join('\n');
        return `Các mã khuyến mãi đang áp dụng tại VexGo:\n\n${promoList}\n\nBạn hãy nhập mã tại bước thanh toán để được khấu trừ giá vé nhé!`;
      }
      return 'Hiện tại các chương trình khuyến mãi đã hết lượt sử dụng. Bạn vui lòng theo dõi thêm trên fanpage VexGo nhé.';
    }

    return 'Xin chào! Tôi là Trợ lý ảo VexGo AI. Tôi có thể hỗ trợ bạn tìm kiếm chuyến xe, tra cứu vé xe điện tử, theo dõi bưu kiện hoặc giải đáp các chính sách hoàn hủy và hành lý của nhà xe.';
  }

  private parseTripSearchQuery(msg: string): {
    origin: string;
    destination: string;
    date?: string;
  } {
    let origin = '';
    let destination = '';

    const lower = msg.toLowerCase();
    const match = lower.match(
      /(?:tu|tai|o)\s+([a-z0-9\s.]+?)\s+(?:den|ve|di)\s+([a-z0-9\s.]+?)(?:ngay|$|\?)/i,
    );
    if (match) {
      origin = match[1].trim();
      destination = match[2].trim();
    } else {
      const match2 = lower.match(
        /([a-z0-9\s.]+?)\s*(?:-|–|to|den)\s*([a-z0-9\s.]+)/i,
      );
      if (match2) {
        origin = match2[1].replace(/^(tim xe|ve xe|chuyen)\s*/i, '').trim();
        destination = match2[2].trim();
      }
    }

    const dateMatch = msg.match(/\b(202\d-\d{2}-\d{2})\b/);
    const date = dateMatch ? dateMatch[1] : undefined;

    return { origin, destination, date };
  }

  private async finalizeResponse(params: {
    sessionId?: number;
    sessionToken: string;
    reply: string;
    intent: string;
    citations: CitationItem[];
    suggestedTrips?: TripSearchResultItem[];
    requiresHumanHandoff: boolean;
    handoffReason?: string;
    startTime: number;
    requestId?: string;
  }): Promise<ChatbotResponse> {
    const latencyMs = Date.now() - params.startTime;

    // Lưu vết tin nhắn vào AiChatMessage trong DB
    if (params.sessionId) {
      try {
        await this.prisma.aiChatMessage.create({
          data: {
            sessionId: params.sessionId,
            role: 'ASSISTANT',
            content: params.reply,
            intent: params.intent,
            citations: params.citations as unknown as Prisma.InputJsonValue,
            toolCalls: params.suggestedTrips
              ? (params.suggestedTrips as unknown as Prisma.InputJsonValue)
              : undefined,
            requiresHumanHandoff: params.requiresHumanHandoff,
            latencyMs,
          },
        });

        if (params.requiresHumanHandoff && this.prisma.aiChatSession) {
          await this.prisma.aiChatSession.update({
            where: { id: params.sessionId },
            data: { status: 'HANDOFF_REQUIRED' },
          });
        }
      } catch (err) {
        this.logger.warn('Could not persist AI reply.');
        throw new ServiceUnavailableException({
          error: 'AI_HISTORY_UNAVAILABLE',
          message:
            'Chưa xác nhận được việc lưu câu trả lời. Vui lòng kiểm tra lịch sử trước khi gửi lại.',
        });
      }
    } else {
      throw new ServiceUnavailableException({
        error: 'AI_HISTORY_UNAVAILABLE',
        message: 'Chưa lưu được hội thoại.',
      });
    }

    return {
      sessionToken: params.sessionToken,
      reply: params.reply,
      intent: params.intent,
      citations: params.citations,
      suggestedTrips: params.suggestedTrips,
      suggestedQuestions: [
        'Chính sách hoàn hủy vé thế nào?',
        'Quy định hành lý mang theo ra sao?',
        'Tìm chuyến xe từ TP.HCM đi Đà Lạt',
        'Các mã khuyến mãi đang áp dụng?',
      ],
      requiresHumanHandoff: params.requiresHumanHandoff,
      handoffReason: params.handoffReason,
      latencyMs,
      requestId: params.requestId,
    };
  }
}
