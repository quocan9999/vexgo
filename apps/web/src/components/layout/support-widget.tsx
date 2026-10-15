'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2, Headphones } from 'lucide-react';
import { CustomerSupportChat } from '@/features/support-chat/components/customer-support-chat';

interface Message {
  id: number;
  text: string;
  sender: 'bot' | 'user';
  time: string;
}

export const SupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bot' | 'staff'>('bot');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: 'Xin chào! Tôi là trợ lý ảo VexGo. Tôi có thể giúp gì cho bạn hôm nay?',
      sender: 'bot',
      time: '10:00',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'bot') {
      scrollToBottom();
    }
  }, [messages, isOpen, activeTab]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      let botReply =
        'Xin lỗi, tôi chưa hiểu ý bạn. Bạn có muốn chuyển máy gặp nhân viên CSKH của nhà xe không?';

      const lowerInput = newUserMsg.text.toLowerCase();
      if (lowerInput.includes('hủy vé') || lowerInput.includes('hoàn tiền')) {
        botReply =
          'Bạn có thể hủy vé trực tiếp trong phần "Vé và đơn hàng" nếu vé của bạn thỏa mãn điều kiện hủy. Tiền sẽ được hoàn tự động về tài khoản thanh toán ban đầu.';
      } else if (
        lowerInput.includes('thanh toán') ||
        lowerInput.includes('momo') ||
        lowerInput.includes('vnpay')
      ) {
        botReply =
          'Chúng tôi hỗ trợ thanh toán qua MoMo, VNPAY, ZaloPay và thẻ ngân hàng. Nếu thanh toán lỗi, hệ thống sẽ tự động hoàn tiền sau 24h làm việc.';
      } else if (lowerInput.includes('chào')) {
        botReply = 'Chào bạn! Bạn cần tư vấn về tuyến đường hay liên hệ nhà xe nào ạ?';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: botReply,
          sender: 'bot',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand text-white rounded-full shadow-lg hover:bg-brand-hover hover:scale-105 transition-all flex items-center justify-center z-50 group"
          aria-label="Mở cửa sổ hỗ trợ"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Hỗ trợ trực tuyến
          </span>
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[560px] max-h-[85vh] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="bg-brand px-4 pt-3 pb-2 text-white shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  {activeTab === 'bot' ? <Bot className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-xs">Trung tâm Hỗ trợ VexGo</h3>
                  <p className="text-[10px] text-white/80">
                    {activeTab === 'bot' ? 'Trợ lý AI tự động 24/7' : 'Nhân viên CSKH Nhà xe'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Thu nhỏ"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex bg-black/15 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveTab('bot')}
                className={`flex-1 py-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'bot' ? 'bg-white text-brand shadow-sm font-semibold' : 'text-white/80 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" /> Trợ lý AI
              </button>
              <button
                onClick={() => setActiveTab('staff')}
                className={`flex-1 py-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'staff' ? 'bg-white text-brand shadow-sm font-semibold' : 'text-white/80 hover:text-white'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" /> Nhân viên CSKH
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'staff' ? (
              <CustomerSupportChat />
            ) : (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                  <div className="text-center">
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full">
                      Hôm nay
                    </span>
                  </div>

                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          msg.sender === 'user' ? 'bg-slate-200' : 'bg-brand/10 text-brand'
                        }`}
                      >
                        {msg.sender === 'user' ? (
                          <User className="w-3.5 h-3.5 text-slate-600" />
                        ) : (
                          <Bot className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div
                        className={`flex flex-col gap-1 max-w-[70%] ${
                          msg.sender === 'user' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl text-xs shadow-sm leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-brand text-white rounded-tr-sm'
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-slate-100 shrink-0">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      placeholder="Nhập câu hỏi của bạn..."
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand text-xs"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim()}
                      className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <button
                      onClick={() => setInputValue('Hủy vé')}
                      className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shrink-0 text-[11px]"
                    >
                      Hủy vé
                    </button>
                    <button
                      onClick={() => setInputValue('Thanh toán')}
                      className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shrink-0 text-[11px]"
                    >
                      Thanh toán
                    </button>
                    <button
                      onClick={() => setActiveTab('staff')}
                      className="px-2.5 py-1 bg-brand/10 text-brand font-medium rounded-lg hover:bg-brand/20 shrink-0 text-[11px] flex items-center gap-1"
                    >
                      <Headphones className="w-3 h-3" /> Gặp nhân viên nhà xe
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SupportWidget;
