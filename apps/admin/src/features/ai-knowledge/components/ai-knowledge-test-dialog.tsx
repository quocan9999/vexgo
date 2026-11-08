'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  User,
  Send,
  Loader2,
  Code2,
  BookOpen,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { sendTestChatMessage } from '../services/ai-knowledge-service';
import type { CitationItem } from '@/features/ai-knowledge/types/ai-knowledge';

interface TestChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  citations?: Array<{
    documentCode: string;
    title: string;
    hierarchyPath: string;
    relevanceScore: number;
  }>;
  time: string;
}

interface AiKnowledgeTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FormattedMessageText({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Loại bỏ triệt để mọi mã tài liệu kỹ thuật rò rỉ nếu có
  const cleaned = content
    .replace(/[【\[]\s*DOC-[A-Z0-9_-]+\s*[】\]]/gi, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\(\s*Nguồn:[^)]*\)/gi, '')
    .trim();

  const lines = cleaned.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const textContent = isBullet ? trimmed.slice(2) : line;

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
              <span className="text-primary font-bold mt-0.5 select-none text-[10px]">•</span>
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <div key={idx}>{renderedLine}</div>;
      })}
    </div>
  );
}

export function AiKnowledgeTestDialog({
  open,
  onOpenChange,
}: AiKnowledgeTestDialogProps) {
  const [messages, setMessages] = useState<TestChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Chào mừng bạn đến với môi trường Kiểm thử Trợ lý AI! Bạn có thể đặt câu hỏi để kiểm tra khả năng trả lời và đối soát nguồn trích dẫn RAG.',
      time: 'Hệ thống',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCitationsDebug, setShowCitationsDebug] = useState(true);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
        const saved = window.sessionStorage.getItem('vexgo_admin_ai_citations_debug');
        if (saved !== null) {
          setShowCitationsDebug(saved === 'true');
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleToggleCitationDebug = () => {
    setShowCitationsDebug((prev) => {
      const next = !prev;
      try {
        if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
          window.sessionStorage.setItem('vexgo_admin_ai_citations_debug', String(next));
        }
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: TestChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendTestChatMessage(text);
      const botMsg: TestChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: res.reply,
        citations: res.citations,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const errorMsg: TestChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `Lỗi kết nối kiểm thử: ${err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ AI.'}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickQuestions = [
    'Chính sách hoàn hủy vé thế nào?',
    'Quy định hành lý mang theo ra sao?',
    'Thời gian giữ vé thanh toán là bao lâu?',
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col h-full p-0 bg-background border-l border-border"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <SheetTitle className="text-base font-bold text-foreground">
              Kiểm thử Trợ lý AI (RAG Debugger)
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            Môi trường kiểm thử phản hồi của AI và đối soát trích dẫn quy chế dành cho nhà phát triển.
          </SheetDescription>
        </SheetHeader>

        {/* Thanh công cụ Debug Citation Toggle (Nằm ở Admin) */}
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Đối soát nguồn RAG:
            </span>
          </div>
          <button
            type="button"
            data-testid="admin-citation-toggle-button"
            onClick={handleToggleCitationDebug}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showCitationsDebug
                ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold dark:bg-amber-950/50 dark:text-amber-200'
                : 'bg-muted text-muted-foreground border border-border hover:bg-muted/80'
            }`}
          >
            <span
              className={`size-2 rounded-full ${
                showCitationsDebug ? 'bg-amber-500 animate-pulse' : 'bg-muted-foreground/40'
              }`}
            />
            {showCitationsDebug ? 'Đang bật (Hiển thị nguồn)' : 'Đang tắt (Clean UI)'}
          </button>
        </div>

        {/* Khung tin nhắn */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-card/30">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`size-7 rounded-full flex items-center justify-center shrink-0 shadow-xs text-xs font-medium ${
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {msg.sender === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
              </div>

              <div
                className={`flex flex-col gap-1 max-w-[85%] ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Bong bóng tin nhắn */}
                <div
                  className={`p-3 rounded-2xl text-xs shadow-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-xs'
                      : 'bg-card border border-border text-foreground rounded-tl-xs'
                  }`}
                >
                  <FormattedMessageText content={msg.text} isUser={msg.sender === 'user'} />
                </div>

                {/* Khối trích dẫn RAG (Chỉ hiển thị khi Admin Toggle = ON) */}
                {showCitationsDebug && msg.citations && msg.citations.length > 0 && (
                  <div
                    className="w-full mt-1"
                    data-testid="admin-citations-container"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCitationId((prev) =>
                          prev === msg.id ? null : msg.id,
                        )
                      }
                      className="text-[11px] text-amber-900 bg-amber-50/90 hover:bg-amber-100 border border-amber-200/80 flex items-center gap-1.5 font-medium px-2.5 py-1.5 rounded-lg transition-colors w-full cursor-pointer shadow-2xs"
                    >
                      <BookOpen className="size-3.5 text-amber-700 shrink-0" />
                      <span className="font-semibold text-amber-950">
                        Nguồn trích dẫn ({msg.citations.length} điều khoản)
                      </span>
                      <ChevronDown
                        className={`size-3.5 ml-auto text-amber-700 transition-transform ${
                          expandedCitationId === msg.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {expandedCitationId === msg.id && (
                      <div className="mt-1.5 p-2.5 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-2 text-[11px] shadow-2xs">
                        {msg.citations.map((cite, idx) => (
                          <div
                            key={idx}
                            className="border-b border-amber-200/50 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="flex items-center justify-between font-semibold text-foreground gap-2">
                              <span className="truncate">{cite.title}</span>
                              <span className="text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 font-medium font-mono">
                                Độ khớp: {cite.relevanceScore}%
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                              {cite.hierarchyPath}
                            </p>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">
                              [{cite.documentCode}]
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <span className="text-[10px] text-muted-foreground px-1">
                  {msg.time}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Trợ lý AI đang tra cứu và suy luận...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Thanh gợi ý câu hỏi nhanh */}
        <div className="px-4 py-2 border-t border-border/60 bg-muted/20 flex flex-wrap gap-1.5 shrink-0">
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-full bg-background border border-border/80 hover:border-primary hover:text-primary transition-colors text-muted-foreground cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input gửi tin nhắn */}
        <div className="p-3 bg-background border-t border-border shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi để kiểm thử phản hồi RAG..."
              disabled={loading}
              className="h-10 text-xs"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-10 px-3.5 gap-1.5"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
