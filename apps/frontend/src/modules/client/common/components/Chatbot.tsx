'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Minimize2 } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'bot' | 'user';
  time: string;
}

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: 'Xin chào! Tôi là trợ lý ảo BusWay. Tôi có thể giúp gì cho bạn hôm nay?', sender: 'bot', time: '10:00' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');

    // Simulate bot response
    setTimeout(() => {
      let botReply = 'Xin lỗi, tôi chưa hiểu ý bạn. Bạn có muốn chuyển máy gặp nhân viên CSKH không?';
      
      const lowerInput = newUserMsg.text.toLowerCase();
      if (lowerInput.includes('hủy vé') || lowerInput.includes('hoàn tiền')) {
        botReply = 'Bạn có thể hủy vé trực tiếp trong phần "Vé và đơn hàng" nếu vé của bạn thỏa mãn điều kiện hủy (trước 3-12 tiếng tùy nhà xe). Tiền sẽ được hoàn tự động về tài khoản thanh toán ban đầu.';
      } else if (lowerInput.includes('thanh toán') || lowerInput.includes('momo') || lowerInput.includes('vnpay')) {
        botReply = 'Chúng tôi hỗ trợ thanh toán qua MoMo, VNPAY, ZaloPay và thẻ ngân hàng. Nếu thanh toán lỗi, hệ thống sẽ tự động hoàn tiền sau 24h làm việc.';
      } else if (lowerInput.includes('chào')) {
        botReply = 'Chào bạn! Bạn cần tư vấn về tuyến đường nào ạ?';
      }

      setMessages(prev => [...prev, {
        id: Date.now(),
        text: botReply,
        sender: 'bot',
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-brand text-white rounded-full shadow-lg hover:bg-brand-hover hover:scale-105 transition-all flex items-center justify-center z-50 group"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Chat hỗ trợ
          </span>
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[360px] h-[540px] max-h-[80vh] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-5 fade-in duration-200">
          {/* Header */}
          <div className="h-16 bg-brand px-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-brand rounded-full"></div>
              </div>
              <div>
                <h3 className="font-bold text-sm">Trợ lý BusWay</h3>
                <p className="text-[10px] text-white/80">Trả lời tự động (Luôn trực tuyến)</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">
                <Minimize2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full">Hôm nay</span>
            </div>
            
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.sender === 'user' ? 'bg-slate-200' : 'bg-brand/10 text-brand'}`}>
                  {msg.sender === 'user' ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`flex flex-col gap-1 max-w-[70%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.sender === 'user' ? 'bg-brand text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'}`}>
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
                className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm"
              />
              <button 
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button onClick={() => setInputValue('Hủy vé')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shrink-0">Hủy vé</button>
              <button onClick={() => setInputValue('Gửi hàng')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shrink-0">Gửi hàng</button>
              <button onClick={() => setInputValue('Gặp nhân viên')} className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shrink-0">Gặp nhân viên</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
