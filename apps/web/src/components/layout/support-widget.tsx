'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  X,
  Send,
  Bot,
  User,
  Minimize2,
  Headphones,
  BookOpen,
  Calendar,
  Clock,
  Bus,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  Sparkles,
  Loader2,
  ArrowRightLeft,
  PlusCircle,
} from 'lucide-react';
import { CustomerSupportChat } from '@/features/support-chat/components/customer-support-chat';
import { aiChatbotService } from '@/features/ai-chatbot/services/ai-chatbot.service';
import type {
  AiChatMessageItem,
  CitationItem,
  TripSearchResultItem,
  AiSuggestionItem,
} from '@/features/ai-chatbot/types/ai-chatbot.types';

function convertMarkdownTablesToText(text: string): string {
  if (!text || !text.includes('|')) return text;

  const lines = text.split('\n');
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];
  const tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      for (const row of tableRows) {
        const parts: string[] = [];
        let title = '';

        for (let i = 0; i < row.length; i++) {
          const val = row[i];
          const header = headers[i] || '';

          if (!val) continue;

          // Bỏ qua UUIDs (32 hex chars hoặc UUID format)
          if (
            /^[0-9a-f]{32}$/i.test(val) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
          ) {
            continue;
          }

          // Bỏ qua link đặt vé thô /trips/...
          if (val.startsWith('/trips/') || val.startsWith('http')) {
            continue;
          }

          // Bỏ qua cột mã chuyến hoặc link
          if (/mã\s*chuyến/i.test(header) || /link/i.test(header)) {
            continue;
          }

          // Chọn title chính (ưu tiên cột Nhà xe)
          if (!title && (/nhà\s*xe/i.test(header) || i === 0 || i === 1)) {
            title = val;
            continue;
          }

          if (header && !/cột/i.test(header)) {
            parts.push(`${header}: ${val}`);
          } else {
            parts.push(val);
          }
        }

        if (title && parts.length > 0) {
          result.push(`- **${title}**: ${parts.join(', ')}`);
        } else if (title) {
          result.push(`- **${title}**`);
        } else if (parts.length > 0) {
          result.push(`- ${parts.join(', ')}`);
        }
      }
    }
    inTable = false;
    headers = [];
    tableRows.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isTableRow = line.startsWith('|') && line.endsWith('|');
    const isSeparator = isTableRow && /^\|(\s*:?-+:?\s*\|)+$/.test(line);

    if (isSeparator) {
      inTable = true;
      continue;
    }

    if (isTableRow) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());

      if (!inTable) {
        headers = cells;
        inTable = true;
      } else {
        tableRows.push(cells);
      }
      continue;
    }

    if (inTable) {
      flushTable();
    }
    result.push(lines[i]);
  }

  if (inTable) {
    flushTable();
  }

  return result.join('\n');
}

function FormattedMessageText({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Chuyển đổi bảng Markdown sang văn bản gạch đầu dòng rõ ràng
  const textWithoutTables = convertMarkdownTablesToText(content);

  // Loại bỏ triệt để mọi mã tài liệu kỹ thuật, thẻ [DOC-...], 【DOC-...】 hoặc (Nguồn: ...)
  const cleaned = textWithoutTables
    .replace(/[【\[]\s*DOC-[A-Z0-9_-]+\s*[】\]]/gi, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\(\s*Nguồn:[^)]*\)/gi, '')
    .trim();

  const lines = cleaned.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Xử lý dòng gạch đầu dòng (- hoặc * )
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const textContent = isBullet ? trimmed.slice(2) : line;

        // Parse định dạng in đậm **text**
        const parts = textContent.split(/(\*\*[^*]+\*\*)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {boldText}
              </strong>
            );
          }
          return <React.Fragment key={pIdx}>{part}</React.Fragment>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-0.5">
              <span className="text-emerald-600 font-bold mt-0.5 select-none text-[10px]">•</span>
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <div key={idx}>{renderedLine}</div>;
      })}
    </div>
  );
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const AI_CHAT_STORAGE_KEY = 'vexgo_ai_chat_data';
const AI_CHAT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày tính theo Rolling TTL

interface StoredAiChatData {
  sessionToken: string;
  lastActiveAt: number;
  messages: AiChatMessageItem[];
}

const DEFAULT_WELCOME_MESSAGE: AiChatMessageItem = {
  id: 'welcome',
  text: 'Xin chào! Tôi là Trợ lý ảo VexGo AI. Tôi có thể hỗ trợ bạn tìm kiếm chuyến xe, tra cứu vé xe điện tử, thông tin bưu kiện và giải đáp các chính sách của VexGo.',
  sender: 'bot',
  time: 'Vừa xong',
};

const persistChatData = (token: string, msgs: AiChatMessageItem[]) => {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const data: StoredAiChatData = {
        sessionToken: token,
        lastActiveAt: Date.now(),
        messages: msgs,
      };
      window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota or environment errors
  }
};


const WIDGET_FALLBACK: Record<string, string> = {
  aiBotTitle: 'Trợ lý ảo VexGo AI',
  aiBotSubtitle: 'Trực tuyến • Phản hồi tức thì',
  ragBadge: 'RAG 24/7',
  newChat: 'Đoạn chat mới',
  minimize: 'Thu nhỏ',
  close: 'Đóng',
  today: 'Hôm nay',
  aiThinking: 'Trợ lý AI đang tra cứu và suy nghĩ...',
  citations: 'Trích dẫn tài liệu',
  hideCitations: 'Đang ẩn nguồn',
  viewCitations: 'Xem nguồn',
  viewTicket: 'Xem vé điện tử',
  seatsLeft: 'Còn {count} ghế',
  details: 'Chi tiết',
  contactOperator: 'Liên hệ',
  quickMeetStaff: 'Gặp CSKH',
  askQuestionPlaceholder: 'Nhập câu hỏi hoặc yêu cầu hỗ trợ...',
  send: 'Gửi tin nhắn',
  floatingStaffButtonAria: 'Mở chat CSKH nhà xe',
  floatingStaffButtonTitle: 'Chat trực tiếp với CSKH Nhà xe',
  operatorSupport: 'CSKH Nhà xe',
  operatorSupportSubtitle: 'Hỗ trợ trực tiếp từ đối tác',
  floatingAiButtonAria: 'Mở trợ lý ảo AI',
  floatingAiButtonTitle: 'Trợ lý ảo VexGo 24/7',
};

function useSafeWidgetTranslations() {
  try {
    return useTranslations('chat');
  } catch {
    return ((key: string, values?: Record<string, any>) => {
      let text = WIDGET_FALLBACK[key] || key;
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    }) as any;
  }
}

export const SupportWidget: React.FC = () => {
  const t = useSafeWidgetTranslations();
  // Quản lý trạng thái mở/đóng độc lập cho 2 nút nổi (F-02)
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [pendingHandoffToken, setPendingHandoffToken] = useState<string | null>(null);

  const [sessionToken, setSessionToken] = useState<string>('');
  const [messages, setMessages] = useState<AiChatMessageItem[]>([DEFAULT_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestionItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khởi tạo và khôi phục session/tin nhắn từ localStorage (Rolling TTL 7 ngày)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const raw = window.localStorage.getItem(AI_CHAT_STORAGE_KEY);
        if (raw) {
          const parsed: StoredAiChatData = JSON.parse(raw);
          const isUuidValid =
            typeof parsed.sessionToken === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              parsed.sessionToken,
            );
          const isNotExpired =
            typeof parsed.lastActiveAt === 'number' &&
            Date.now() - parsed.lastActiveAt < AI_CHAT_TTL_MS;

          if (
            isUuidValid &&
            isNotExpired &&
            Array.isArray(parsed.messages) &&
            parsed.messages.length > 0
          ) {
            setSessionToken(parsed.sessionToken);
            setMessages(parsed.messages);

            // Kiểm tra tính hợp lệ với backend trong nền
            aiChatbotService
              .getSessionHistory(parsed.sessionToken)
              .catch(() => {});
            return;
          }
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }

    // Nếu không có dữ liệu hoặc đã hết hạn quá 7 ngày, tạo phiên mới
    const newSession = generateUuidV4();
    setSessionToken(newSession);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    persistChatData(newSession, [DEFAULT_WELCOME_MESSAGE]);
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem('vexgo_ai_session_token');
      }
    } catch {
      // Ignore
    }
  }, []);

  // Tải các gợi ý câu hỏi mặc định
  useEffect(() => {
    aiChatbotService.getSuggestions().then((res) => {
      if (res && res.length > 0) {
        setSuggestions(res);
      }
    });
  }, []);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isBotOpen) {
      scrollToBottom();
    }
  }, [messages, isBotOpen, isLoading]);

  const handleToggleBot = () => {
    setIsBotOpen((prev) => {
      const next = !prev;
      if (next) setIsStaffOpen(false);
      return next;
    });
  };

  const handleToggleStaff = () => {
    setIsStaffOpen((prev) => {
      const next = !prev;
      if (next) setIsBotOpen(false);
      return next;
    });
  };

  const handleResetChat = () => {
    const newSession = generateUuidV4();
    setSessionToken(newSession);
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    persistChatData(newSession, [DEFAULT_WELCOME_MESSAGE]);
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        window.sessionStorage.removeItem('vexgo_ai_session_token');
      }
    } catch {
      // Ignore
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: AiChatMessageItem = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      time: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    persistChatData(sessionToken, nextMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await aiChatbotService.sendMessage({
        message: text,
        sessionToken,
      });

      let currentToken = sessionToken;
      if (res.sessionToken && res.sessionToken !== sessionToken) {
        currentToken = res.sessionToken;
        setSessionToken(currentToken);
      }

      const botMessage: AiChatMessageItem = {
        id: (Date.now() + 1).toString(),
        text: res.reply,
        sender: 'bot',
        time: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        citations: res.citations,
        suggestedTrips: res.suggestedTrips,
        suggestedReturnTrips: res.suggestedReturnTrips,
        isRoundTrip: res.isRoundTrip,
        roundTripBookingUrl: res.roundTripBookingUrl,
        requiresHumanHandoff: res.requiresHumanHandoff,
        handoffReason: res.handoffReason,
      };

      const finalMessages = [...nextMessages, botMessage];
      setMessages(finalMessages);
      persistChatData(currentToken, finalMessages);
    } catch {
      const errorMessage: AiChatMessageItem = {
        id: (Date.now() + 1).toString(),
        text: 'Xin lỗi, hiện tại kết nối đến hệ thống AI đang gặp gián đoạn. Bạn có thể thử lại hoặc bấm nút dưới đây để kết nối trực tiếp với nhân viên hỗ trợ nhé!',
        sender: 'bot',
        time: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        requiresHumanHandoff: true,
      };
      const errorMessages = [...nextMessages, errorMessage];
      setMessages(errorMessages);
      persistChatData(sessionToken, errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectHuman = () => {
    setPendingHandoffToken(sessionToken);
    setIsBotOpen(false);
    setIsStaffOpen(true);
  };

  return (
    <>
      {/* ============================================================== */}
      {/* 1. NÚT NỔI THỨ NHẤT: CSKH NHÀ XE (HEADPHONES) - ĐẶT Ở TRÊN (F-02) */}
      {/* ============================================================== */}
      {!isStaffOpen && (
        <button
          onClick={handleToggleStaff}
          data-testid="staff-chat-floating-button"
          className="fixed bottom-[74px] sm:bottom-24 right-3.5 sm:right-6 w-11 h-11 sm:w-14 sm:h-14 bg-brand text-white rounded-full shadow-lg hover:bg-brand-hover hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40 group cursor-pointer"
          aria-label={t("floatingStaffButtonAria")}
          title={t("floatingStaffButtonTitle")}
        >
          <Headphones className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md hidden sm:block">
            {t("operatorSupport")}
          </span>
          <span className="absolute top-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
        </button>
      )}

      {/* ============================================================== */}
      {/* 2. NÚT NỔI THỨ HAI: TRỢ LÝ ẢO AI (BOT) - ĐẶT Ở DƯỚI (F-02)      */}
      {/* ============================================================== */}
      {!isBotOpen && (
        <button
          onClick={handleToggleBot}
          data-testid="ai-bot-floating-button"
          className="fixed bottom-4 sm:bottom-6 right-3.5 sm:right-6 w-11 h-11 sm:w-14 sm:h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-40 group cursor-pointer"
          aria-label={t("floatingAiButtonAria")}
          title={t("floatingAiButtonTitle")}
        >
          <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md hidden sm:block">
            {t("aiBotTitle")}
          </span>
          <span className="absolute top-0 right-0 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-rose-500 border-2 border-white rounded-full" />
        </button>
      )}

      {/* ============================================================== */}
      {/* 3. CỬA SỔ CHAT CSKH NHÀ XE ĐỘC LẬP (F-02)                       */}
      {/* ============================================================== */}
      {isStaffOpen && (
        <div
          data-testid="staff-chat-window"
          className="fixed bottom-6 right-6 w-[380px] h-[580px] max-h-[85vh] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-200"
        >
          {/* Header CSKH */}
          <div className="bg-brand px-4 py-3 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Headphones className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs">{t("operatorSupport")}</h3>
                <p className="text-[10px] text-white/80">{t("operatorSupportSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsStaffOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label={t("minimize")}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsStaffOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: CustomerSupportChat Component */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <CustomerSupportChat
              handoffSessionToken={pendingHandoffToken || undefined}
              onHandoffCompleted={() => setPendingHandoffToken(null)}
            />
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. CỬA SỔ TRỢ LÝ AI NÂNG CẤP HYBRID RAG & TOOL CALLING          */}
      {/* ============================================================== */}
      {isBotOpen && (
        <div
          data-testid="ai-bot-window"
          className="fixed bottom-6 right-6 w-[420px] h-[640px] max-h-[90vh] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-200"
        >
          {/* Header AI Bot */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-3 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Sparkles className="w-4 h-4 text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs tracking-tight">{t("aiBotTitle")}</h3>
                  <span className="text-[9px] bg-emerald-500/50 px-1.5 py-0.5 rounded-full font-medium border border-emerald-400/40">
                    RAG 24/7
                  </span>
                </div>
                <p className="text-[10px] text-white/80">Tra cứu chuyến đi & chính sách thông minh</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                title={t("newChat")}
                aria-label={t("newChat")}
              >
                <PlusCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsBotOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={t("minimize")}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsBotOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={t("close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full">
                {t("today")}
              </span>
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                    msg.sender === 'user'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <User className="w-3.5 h-3.5" />
                  ) : (
                    <Bot className="w-3.5 h-3.5" />
                  )}
                </div>

                <div
                  className={`flex flex-col gap-1.5 max-w-[85%] ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Bong bóng nội dung chính */}
                  <div
                    className={`p-3 rounded-2xl text-xs shadow-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-xs font-medium'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    <FormattedMessageText content={msg.text} isUser={msg.sender === 'user'} />
                  </div>

                  {/* 1. HIỂN THỊ DANH SÁCH CHUYẾN XE KHÚ HỒI HOẶC 1 CHIỀU */}
                  {msg.isRoundTrip ? (
                    <div className="w-full space-y-3 mt-1.5">
                      {/* KHỐI LƯỢT ĐI */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <span>🛫</span>
                          <span>
                            Chiều đi:{' '}
                            {msg.suggestedTrips?.[0]
                              ? `${msg.suggestedTrips[0].origin} → ${msg.suggestedTrips[0].destination}`
                              : 'Lộ trình đi'}
                          </span>
                        </div>
                        {msg.suggestedTrips && msg.suggestedTrips.length > 0 ? (
                          msg.suggestedTrips.map((trip) => (
                            <div
                              key={`outbound-${trip.tripId}`}
                              className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs hover:border-emerald-500 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-xs">
                                  {trip.operator}
                                </span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                                  Còn {trip.availableSeats} ghế
                                </span>
                              </div>

                              <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-2">
                                <span className="flex items-center gap-1 font-medium text-slate-800">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {trip.departureTime}
                                </span>
                                <span>•</span>
                                <span>
                                  {trip.origin} → {trip.destination}
                                </span>
                              </div>

                              <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {trip.departureDate} ({trip.vehicleType})
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="font-bold text-rose-600 text-xs">
                                  {trip.price
                                    ? trip.price.toLocaleString('vi-VN') + ' đ'
                                    : 'Liên hệ'}
                                </span>
                                <Link
                                  href={`/trips/${trip.tripId}`}
                                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                                >
                                  Chi tiết
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-500 text-center">
                            Chưa tìm thấy chuyến đi phù hợp.
                          </div>
                        )}
                      </div>

                      {/* KHỐI LƯỢT VỀ */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <span>🛬</span>
                          <span>
                            Chiều về:{' '}
                            {msg.suggestedReturnTrips?.[0]
                              ? `${msg.suggestedReturnTrips[0].origin} → ${msg.suggestedReturnTrips[0].destination}`
                              : 'Lộ trình về'}
                          </span>
                        </div>
                        {msg.suggestedReturnTrips && msg.suggestedReturnTrips.length > 0 ? (
                          msg.suggestedReturnTrips.map((trip) => (
                            <div
                              key={`return-${trip.tripId}`}
                              className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs hover:border-teal-500 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-xs">
                                  {trip.operator}
                                </span>
                                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-semibold border border-teal-200">
                                  Còn {trip.availableSeats} ghế
                                </span>
                              </div>

                              <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-2">
                                <span className="flex items-center gap-1 font-medium text-slate-800">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {trip.departureTime}
                                </span>
                                <span>•</span>
                                <span>
                                  {trip.origin} → {trip.destination}
                                </span>
                              </div>

                              <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {trip.departureDate} ({trip.vehicleType})
                              </div>

                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="font-bold text-rose-600 text-xs">
                                  {trip.price
                                    ? trip.price.toLocaleString('vi-VN') + ' đ'
                                    : 'Liên hệ'}
                                </span>
                                <Link
                                  href={`/trips/${trip.tripId}`}
                                  className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                                >
                                  Chi tiết
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-500 text-center">
                            Chưa tìm thấy chuyến về phù hợp.
                          </div>
                        )}
                      </div>

                      {/* NÚT CTA CHÍNH: ĐẶT VÉ KHỨ HỒI */}
                      {msg.roundTripBookingUrl && (
                        <Link
                          href={msg.roundTripBookingUrl}
                          className="w-full mt-2 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          <span>Đặt vé khứ hồi ngay</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  ) : msg.suggestedTrips && msg.suggestedTrips.length > 0 ? (
                    <div className="w-full space-y-2 mt-1">
                      <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        <Bus className="w-3.5 h-3.5 text-emerald-600" />
                        Chuyến xe gợi ý:
                      </div>
                      {msg.suggestedTrips.map((trip) => (
                        <div
                          key={trip.tripId}
                          className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs hover:border-emerald-500 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-xs">
                              {trip.operator}
                            </span>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                              Còn {trip.availableSeats} ghế
                            </span>
                          </div>

                          <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-2">
                            <span className="flex items-center gap-1 font-medium text-slate-800">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {trip.departureTime}
                            </span>
                            <span>•</span>
                            <span>{trip.origin} → {trip.destination}</span>
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {trip.departureDate} ({trip.vehicleType})
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <span className="font-bold text-rose-600 text-xs">
                              {trip.price ? trip.price.toLocaleString('vi-VN') + ' đ' : 'Liên hệ'}
                            </span>
                            <Link
                              href={`/trips/${trip.tripId}`}
                              className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                            >
                              Đặt vé ngay
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* 2. NÚT CHUYỂN TIẾP NHÂN VIÊN (HUMAN HANDOFF) */}
                  {msg.requiresHumanHandoff && (
                    <div className="w-full mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                      <div className="flex items-center gap-1.5 text-amber-800 text-[11px]">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Cần nhân viên CSKH hỗ trợ trực tiếp?</span>
                      </div>
                      <button
                        onClick={handleConnectHuman}
                        className="bg-brand hover:bg-brand-hover text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        {t("quickMeetStaff")}
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 font-medium px-1">
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-slate-200/80 p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span>{t("aiThinking")}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input & Quick Suggestions Area */}
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
            {/* Quick Suggestions Chips */}
            {suggestions.length > 0 && (
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    onClick={() => handleSendMessage(sug.question)}
                    disabled={isLoading}
                    className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent shrink-0 text-[11px] transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {sug.question}
                  </button>
                ))}
              </div>
            )}

            {/* Input Box */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder={t("askQuestionPlaceholder")}
                disabled={isLoading}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600 text-xs transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                aria-label={t("send")}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportWidget;
