'use client';

import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { CustomerSupportChat } from '@/features/support-chat/components/customer-support-chat';
import { aiChatbotService } from '@/features/ai-chatbot/services/ai-chatbot.service';
import type {
  AiChatMessageItem,
  CitationItem,
  TripSearchResultItem,
  AiSuggestionItem,
} from '@/features/ai-chatbot/types/ai-chatbot.types';

export const SupportWidget: React.FC = () => {
  // Quản lý trạng thái mở/đóng độc lập cho 2 nút nổi (F-02)
  const [isBotOpen, setIsBotOpen] = useState(false);
  const [isStaffOpen, setIsStaffOpen] = useState(false);

  const [sessionToken, setSessionToken] = useState<string>('');
  const [messages, setMessages] = useState<AiChatMessageItem[]>([
    {
      id: 'welcome',
      text: 'Xin chào! Tôi là Trợ lý ảo VexGo AI. Tôi có thể hỗ trợ bạn tìm kiếm chuyến xe, tra cứu vé xe điện tử, thông tin bưu kiện và giải đáp các chính sách của VexGo.',
      sender: 'bot',
      time: 'Vừa xong',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestionItem[]>([]);
  const [expandedCitationId, setExpandedCitationId] = useState<string | number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khởi tạo sessionToken từ sessionStorage khi client load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('vexgo_ai_session_token');
      if (stored) {
        setSessionToken(stored);
      } else {
        const newSession = crypto.randomUUID();
        sessionStorage.setItem('vexgo_ai_session_token', newSession);
        setSessionToken(newSession);
      }
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

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await aiChatbotService.sendMessage({
        message: text,
        sessionToken,
      });

      if (res.sessionToken && res.sessionToken !== sessionToken) {
        setSessionToken(res.sessionToken);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('vexgo_ai_session_token', res.sessionToken);
        }
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
        requiresHumanHandoff: res.requiresHumanHandoff,
        handoffReason: res.handoffReason,
      };

      setMessages((prev) => [...prev, botMessage]);
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
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectHuman = () => {
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
          aria-label="Mở chat CSKH nhà xe"
          title="Chat trực tiếp với CSKH Nhà xe"
        >
          <Headphones className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md hidden sm:block">
            CSKH Nhà xe
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
          aria-label="Mở trợ lý ảo AI"
          title="Trợ lý ảo VexGo 24/7"
        >
          <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-md hidden sm:block">
            Trợ lý AI VexGo
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
                <h3 className="font-bold text-xs">CSKH Nhà Xe</h3>
                <p className="text-[10px] text-white/80">Hỗ trợ trực tiếp từ đối tác</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsStaffOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Thu nhỏ"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsStaffOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body: CustomerSupportChat Component */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <CustomerSupportChat />
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
                  <h3 className="font-bold text-xs tracking-tight">Trợ lý ảo VexGo AI</h3>
                  <span className="text-[9px] bg-emerald-500/50 px-1.5 py-0.5 rounded-full font-medium border border-emerald-400/40">
                    RAG 24/7
                  </span>
                </div>
                <p className="text-[10px] text-white/80">Tra cứu chuyến đi & chính sách thông minh</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsBotOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Thu nhỏ"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsBotOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/50 px-2.5 py-1 rounded-full">
                Hôm nay
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
                    className={`p-3 rounded-2xl text-xs shadow-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-xs font-medium'
                        : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* 1. HIỂN THỊ DANH SÁCH THẺ CHUYẾN XE GỢI Ý (SUGGESTED TRIPS) */}
                  {msg.suggestedTrips && msg.suggestedTrips.length > 0 && (
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
                  )}

                  {/* 2. HIỂN THỊ DANH SÁCH TRÍCH DẪN NGUỒN (CITATIONS) */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="w-full mt-1">
                      <button
                        onClick={() =>
                          setExpandedCitationId((prev) =>
                            prev === msg.id ? null : msg.id,
                          )
                        }
                        className="text-[10px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 font-medium bg-slate-100/80 px-2 py-1 rounded-md transition-colors"
                      >
                        <BookOpen className="w-3 h-3 text-emerald-600" />
                        {msg.citations.length} điều khoản chính sách trích dẫn
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            expandedCitationId === msg.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {expandedCitationId === msg.id && (
                        <div className="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/60 rounded-xl space-y-1.5 text-[11px] animate-in fade-in duration-150">
                          {msg.citations.map((cite, idx) => (
                            <div
                              key={idx}
                              className="border-b border-emerald-100 pb-1.5 last:border-0 last:pb-0"
                            >
                              <div className="flex items-center justify-between font-semibold text-emerald-900">
                                <span>{cite.title}</span>
                                <span className="text-[10px] text-emerald-600 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                                  {cite.relevanceScore}% phù hợp
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {cite.hierarchyPath}
                              </p>
                              <span className="text-[9px] font-mono text-slate-400">
                                [{cite.documentCode}]
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. NÚT CHUYỂN TIẾP NHÂN VIÊN (HUMAN HANDOFF) */}
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
                        Gặp CSKH
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
                  <span>Trợ lý AI đang tra cứu và suy nghĩ...</span>
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
                placeholder="Nhập câu hỏi hoặc yêu cầu hỗ trợ..."
                disabled={isLoading}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-600 text-xs transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                aria-label="Gửi tin nhắn"
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
