import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
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

export interface ChatbotRequest {
  message: string;
  sessionToken?: string;
  nhaXeId?: number;
  khachHangId?: number;
  taiKhoanId?: number;
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

    if (!resolvedKhachHangId && request.taiKhoanId && this.prisma.khachHang) {
      try {
        const customer = await this.prisma.khachHang.findUnique({
          where: { taiKhoanId: request.taiKhoanId },
          select: { khachHangId: true },
        });
        resolvedKhachHangId = customer?.khachHangId;
      } catch {
        // ignore
      }
    }

    if (this.prisma.aiChatSession) {
      try {
        const session = await this.prisma.aiChatSession.findUnique({
          where: { sessionToken },
          select: { id: true },
        });
        if (session) {
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
      } catch (err) {
        this.logger.warn(`Could not sync AI session: ${String(err)}`);
      }
    }

    // 2. Kiểm tra các điều kiện Handoff tiên nghiệm (Prior Conditions 1, 2, 3)
    if (EXPLICIT_HUMAN_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Tôi đã tiếp nhận yêu cầu của bạn. Tôi đang kết nối bạn với nhân viên CSKH của nhà xe để hỗ trợ trực tiếp ngay nhé!',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'EXPLICIT_HUMAN_REQUEST',
        startTime,
      });
    }

    if (NEGATIVE_CRISIS_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'VexGo rất tiếc về trải nghiệm không tốt của bạn. Hệ thống đang chuyển thông tin khẩn cấp đến bộ phận quản lý khiếu nại để trực tiếp liên hệ và bảo vệ quyền lợi của bạn.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'NEGATIVE_SENTIMENT_CRISIS',
        startTime,
      });
    }

    if (EMERGENCY_KEYWORDS.some((kw) => cleanNormalized.includes(kw))) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Đây là sự cố hành trình khẩn cấp. Tôi đang ưu tiên chuyển tiếp bạn đến nhân viên tổng đài điều hành nhà xe để xử lý ngay lập tức.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'EMERGENCY_INCIDENT',
        startTime,
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
        const phoneMatch = rawMessage.match(/\b(0\d{9})\b/)?.[1];

        if (codeMatch) {
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
        const phoneMatch = rawMessage.match(/\b(0\d{9})\b/)?.[1];

        if (wbMatch) {
          const shipmentData = await this.businessTools.lookupShipmentStatus({
            shipmentCode: wbMatch,
            phoneNumber: phoneMatch,
          });
          realtimeData = shipmentData;
        } else {
          realtimeData = {
            note: 'Vui lòng cung cấp mã vận đơn (VD: WB12345678) để tra cứu trạng thái bưu kiện.',
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
      this.logger.error(`Tool execution error: ${String(toolErr)}`);
      toolExecutionConflict = true;
    }

    // Kích hoạt Handoff Condition 2: TOOL_EXECUTION_CONFLICT
    if (toolExecutionConflict) {
      return this.finalizeResponse({
        sessionId,
        sessionToken,
        reply:
          'Đã có sự cố khi kết nối dữ liệu tra cứu giao dịch của bạn. Tôi đang kết nối trực tiếp với nhân viên hỗ trợ để đối soát thủ công ngay nhé.',
        intent: 'HUMAN_HANDOFF',
        citations: [],
        requiresHumanHandoff: true,
        handoffReason: 'TOOL_EXECUTION_CONFLICT',
        startTime,
      });
    }

    // 4. Truy hồi RAG văn bản quy chế nếu không phải công cụ dữ liệu động thuần túy
    let retrievedChunks: RetrievedChunk[] = [];
    if (detectedIntent === 'GENERAL' || cleanNormalized.includes('chinh sach') || cleanNormalized.includes('quy dinh') || cleanNormalized.includes('huy ve') || cleanNormalized.includes('doi tra')) {
      retrievedChunks = await this.retrievalService.retrieve(rawMessage, request.nhaXeId);
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

    if (
      isPolicyQuestion &&
      retrievedChunks.length === 0 &&
      !realtimeData
    ) {
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
    const prompt = this.buildGroundedPrompt(retrievedChunks, realtimeData, rawMessage);
    let reply = '';

    if (this.groqApiKey && !this.groqApiKey.includes('gsk....')) {
      reply = await this.callGroqLlm(prompt);
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

    return this.finalizeResponse({
      sessionId,
      sessionToken,
      reply,
      intent: detectedIntent,
      citations,
      suggestedTrips,
      requiresHumanHandoff: false,
      startTime,
    });
  }

  /**
   * Gọi Groq Cloud LLM (OpenAI compatible) với nhiệt độ T = 0.15
   */
  private async callGroqLlm(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          temperature: GENERATION_TEMPERATURE,
          messages: [
            {
              role: 'system',
              content: `Bạn là Trợ lý ảo VexGo AI thông minh và tận tâm hỗ trợ khách hàng đặt vé xe, gửi hàng hóa và giải đáp chính sách xe khách.
CHỈ TRẢ LỜI dựa trên các thông tin được cung cấp trong thẻ <context> và <realtime_data>.
TUYỆT ĐỐI KHÔNG tự bịa đặt hay suy đoán thông tin ngoài dữ liệu đã cho.
Nếu câu hỏi liên quan đến chính sách, hãy trích dẫn mã quy định theo định dạng [Mã tài liệu].
Trả lời ngắn gọn, lịch sự, rõ ràng bằng tiếng Việt.`,
            },
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
      return `Theo quy định của VexGo [${topChunk.documentCode}]:\n\n${topChunk.rawContent}\n\n(Nguồn: ${topChunk.hierarchyPath})`;
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
      const promoData = realtimeData as { promotions: Array<{ code: string; name: string; discountValue: number; discountType: string; validUntil: string }> };
      if (promoData.promotions && promoData.promotions.length > 0) {
        const promoList = promoData.promotions
          .map((p) => `- Mã "${p.code}": ${p.name} (${p.discountType} ${p.discountValue.toLocaleString('vi-VN')}) - Hạn đến ${p.validUntil}`)
          .join('\n');
        return `Các mã khuyến mãi đang áp dụng tại VexGo:\n\n${promoList}\n\nBạn hãy nhập mã tại bước thanh toán để được khấu trừ giá vé nhé!`;
      }
      return 'Hiện tại các chương trình khuyến mãi đã hết lượt sử dụng. Bạn vui lòng theo dõi thêm trên fanpage VexGo nhé.';
    }

    return 'Xin chào! Tôi là Trợ lý ảo VexGo AI. Tôi có thể hỗ trợ bạn tìm kiếm chuyến xe, tra cứu vé xe điện tử, theo dõi bưu kiện hoặc giải đáp các chính sách hoàn hủy và hành lý của nhà xe.';
  }

  private parseTripSearchQuery(msg: string): { origin: string; destination: string; date?: string } {
    let origin = '';
    let destination = '';

    const lower = msg.toLowerCase();
    const match = lower.match(/(?:tu|tai|o)\s+([a-z0-9\s.]+?)\s+(?:den|ve|di)\s+([a-z0-9\s.]+?)(?:ngay|$|\?)/i);
    if (match) {
      origin = match[1].trim();
      destination = match[2].trim();
    } else {
      const match2 = lower.match(/([a-z0-9\s.]+?)\s*(?:-|–|to|den)\s*([a-z0-9\s.]+)/i);
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
  }): Promise<ChatbotResponse> {
    const latencyMs = Date.now() - params.startTime;

    // Lưu vết tin nhắn vào AiChatMessage trong DB
    if (params.sessionId && this.prisma.aiChatMessage) {
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
        this.logger.warn(`Could not persist AI message: ${String(err)}`);
      }
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
    };
  }
}
