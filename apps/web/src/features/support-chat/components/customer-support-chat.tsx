'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Phone,
  Send,
  Loader2,
  User,
  Headphones,
  AlertCircle,
  ArrowLeft,
  XCircle,
  RotateCw,
  History,
  PlusCircle,
  Clock,
  Calendar,
} from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { supportChatApi } from '../services/support-chat.api';
import { useSupportChatSocket } from '../hooks/use-support-chat-socket';
import { BusCompany, SupportConversation, SupportMessage } from '../types';

export function CustomerSupportChat() {
  const { isAuthenticated, accessToken, user } = useAuthSession();

  const [busCompanies, setBusCompanies] = useState<BusCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<BusCompany | null>(null);
  const [searchCompany, setSearchCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null);
  const [pastConversations, setPastConversations] = useState<SupportConversation[]>([]);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const companyRequestIdRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Tải danh sách nhà xe thật khi ở màn hình chọn nhà xe
  useEffect(() => {
    if (!isAuthenticated || activeConversation) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setLoadingCompanies(true);
    });
    supportChatApi
      .getActiveBusCompanies(searchCompany)
      .then((data) => {
        if (active) setBusCompanies(data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách nhà xe.');
        }
      })
      .finally(() => {
        if (active) setLoadingCompanies(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, activeConversation, searchCompany]);

  // Callback nhận tin nhắn mới từ WebSocket
  const handleNewMessage = useCallback((newMsg: SupportMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.tinNhanId === newMsg.tinNhanId && m.tinNhanId > 0)) return prev;
      if (newMsg.clientMessageId && prev.some((m) => m.clientMessageId === newMsg.clientMessageId)) {
        return prev.map((m) =>
          m.clientMessageId === newMsg.clientMessageId
            ? { ...newMsg, deliveryStatus: 'DA_GUI' }
            : m,
        );
      }
      return [...prev, { ...newMsg, deliveryStatus: 'DA_GUI' }];
    });
  }, []);

  // Callback khi có nhân viên tiếp nhận
  const handleConversationClaimed = useCallback((updatedConv: SupportConversation) => {
    setActiveConversation((prev) => (prev ? { ...prev, ...updatedConv } : updatedConv));
  }, []);

  // Callback khi cuộc trò chuyện kết thúc
  const handleConversationClosed = useCallback((closedConv: SupportConversation) => {
    setActiveConversation((prev) => (prev ? { ...prev, ...closedConv, trangThai: 'DA_DONG' } : closedConv));
  }, []);

  // Socket connection hook
  const {
    isConnected: socketConnected,
    isTyping: staffTyping,
    sendMessage: sendSocketMessage,
    emitTyping,
    closeConversation: closeSocketConversation,
  } = useSupportChatSocket({
    token: accessToken,
    activeConversationId: activeConversation?.cuocTroChuyenId ?? null,
    onNewMessage: handleNewMessage,
    onConversationClaimed: handleConversationClaimed,
    onConversationClosed: handleConversationClosed,
  });

  // Chọn nhà xe: chống race condition out-of-order & hỗ trợ xem lịch sử chat đã đóng (F-01)
  const handleSelectCompany = async (company: BusCompany) => {
    if (!accessToken) return;
    if (!Number.isInteger(company.busCompanyId) || company.busCompanyId <= 0) {
      setErrorMsg('Thông tin nhà xe không hợp lệ.');
      return;
    }

    const currentReqId = ++companyRequestIdRef.current;
    setSelectedCompany(company);
    setShowHistoryList(false);
    setErrorMsg(null);
    setLoadingMessages(true);
    setActiveConversation(null);
    setMessages([]);
    setPastConversations([]);

    try {
      const [active, convsRes] = await Promise.all([
        supportChatApi.getActiveConversation(company.busCompanyId, accessToken),
        supportChatApi.listConversations({ nhaXeId: company.busCompanyId }, accessToken),
      ]);

      // Guard: Nếu có request sau đã được gọi, bỏ qua response cũ để ngăn race condition (F-01)
      if (currentReqId !== companyRequestIdRef.current) {
        return;
      }

      const allConvs = convsRes?.data || [];
      const closedList = allConvs.filter((c) => c.trangThai === 'DA_DONG');
      setPastConversations(closedList);

      if (active) {
        setActiveConversation(active);
        const history = await supportChatApi.getMessages(active.cuocTroChuyenId, accessToken);
        if (currentReqId === companyRequestIdRef.current) {
          setMessages(history.map((m) => ({ ...m, deliveryStatus: 'DA_GUI' })));
        }
      } else if (closedList.length > 0) {
        // Nếu không có phiên đang mở nhưng có phiên cũ đã đóng, hiển thị phiên gần nhất cho khách đọc
        const latestClosed = closedList[0];
        setActiveConversation(latestClosed);
        const history = await supportChatApi.getMessages(latestClosed.cuocTroChuyenId, accessToken);
        if (currentReqId === companyRequestIdRef.current) {
          setMessages(history.map((m) => ({ ...m, deliveryStatus: 'DA_GUI' })));
        }
      } else {
        // Chưa có cuộc trò chuyện nào, giữ activeConversation null để hiện form bắt đầu mới
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err: unknown) {
      if (currentReqId === companyRequestIdRef.current) {
        setErrorMsg(err instanceof Error ? err.message : 'Không thể kiểm tra cuộc trò chuyện.');
      }
    } finally {
      if (currentReqId === companyRequestIdRef.current) {
        setLoadingMessages(false);
      }
    }
  };

  // Xem một cuộc trò chuyện cụ thể trong lịch sử
  const handleSelectHistoryConversation = async (conv: SupportConversation) => {
    if (!accessToken) return;
    setActiveConversation(conv);
    setShowHistoryList(false);
    setLoadingMessages(true);
    try {
      const history = await supportChatApi.getMessages(conv.cuocTroChuyenId, accessToken);
      setMessages(history.map((m) => ({ ...m, deliveryStatus: 'DA_GUI' })));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải tin nhắn cuộc trò chuyện này.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Bắt đầu cuộc trò chuyện mới
  const handleStartConversation = async () => {
    if (!selectedCompany || !accessToken || !initialMessage.trim()) return;
    if (!Number.isInteger(selectedCompany.busCompanyId) || selectedCompany.busCompanyId <= 0) {
      setErrorMsg('Thông tin nhà xe không hợp lệ.');
      return;
    }

    setStartingChat(true);
    setErrorMsg(null);

    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    try {
      const conv = await supportChatApi.createConversation(
        {
          nhaXeId: selectedCompany.busCompanyId,
          tieuDe: `Hỗ trợ khách hàng - ${selectedCompany.name}`,
          tinNhanDauTien: initialMessage.trim(),
          clientMessageId: clientMsgId,
        },
        accessToken,
      );

      setActiveConversation(conv);
      const history = await supportChatApi.getMessages(conv.cuocTroChuyenId, accessToken);
      setMessages(history.map((m) => ({ ...m, deliveryStatus: 'DA_GUI' })));
      setInitialMessage('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tạo cuộc trò chuyện.');
    } finally {
      setStartingChat(false);
    }
  };

  // Gửi tin nhắn trong cuộc trò chuyện (F-03 timeout resilience & F-04 delivery states)
  const handleSendMessage = async () => {
    if (!activeConversation || !inputValue.trim() || !accessToken || sending) return;

    const content = inputValue.trim();
    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const tempId = -Date.now();
    setInputValue('');
    setSending(true);
    setErrorMsg(null);

    // Optimistic message với trạng thái DANG_GUI
    const tempMessage: SupportMessage = {
      tinNhanId: tempId,
      cuocTroChuyenId: activeConversation.cuocTroChuyenId,
      taiKhoanGuiId: user?.accountId ?? 0,
      loaiNguoiGui: 'KHACH_HANG',
      loaiTinNhan: 'VAN_BAN',
      noiDung: content,
      clientMessageId: clientMsgId,
      trangThai: 'DA_GUI',
      deliveryStatus: 'DANG_GUI',
      createdAt: new Date().toISOString(),
      taiKhoanGui: {
        taiKhoanId: user?.accountId ?? 0,
        hoTen: user?.fullName || 'Bạn',
        avatarUrl: null,
      },
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      let sentSuccess = false;
      // 1. Ưu tiên gửi qua WebSocket (có timeout 5000ms - F-03)
      if (socketConnected) {
        const socketRes = await sendSocketMessage(activeConversation.cuocTroChuyenId, content, clientMsgId);
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      // 2. Fallback REST nếu socket không gửi được / timeout (BẮT BUỘC dùng lại cùng clientMsgId để backend deduplicate)
      if (!sentSuccess) {
        const restMsg = await supportChatApi.sendMessage(
          activeConversation.cuocTroChuyenId,
          content,
          accessToken,
          clientMsgId,
        );
        handleNewMessage({ ...restMsg, deliveryStatus: 'DA_GUI' });
      }
    } catch (err: unknown) {
      // Đánh dấu tin nhắn thất bại để người dùng có thể bấm Thử lại (F-04)
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, deliveryStatus: 'THAT_BAI' }
            : m,
        ),
      );
      setErrorMsg(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại. Vui lòng bấm Thử lại.');
    } finally {
      // Luôn luôn giải phóng sending để input không bị khóa vô hạn (F-03)
      setSending(false);
    }
  };

  // Thử lại tin nhắn đã gửi thất bại (F-04)
  const handleRetryMessage = async (failedMsg: SupportMessage) => {
    if (!activeConversation || !accessToken || sending) return;

    const clientMsgId = failedMsg.clientMessageId || `client-retry-${failedMsg.tinNhanId}`;
    const content = failedMsg.noiDung;

    setSending(true);
    setErrorMsg(null);

    // Chuyển lại trạng thái thành DANG_GUI
    setMessages((prev) =>
      prev.map((m) =>
        m.clientMessageId === clientMsgId
          ? { ...m, deliveryStatus: 'DANG_GUI' }
          : m,
      ),
    );

    try {
      let sentSuccess = false;
      if (socketConnected) {
        const socketRes = await sendSocketMessage(activeConversation.cuocTroChuyenId, content, clientMsgId);
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      if (!sentSuccess) {
        const restMsg = await supportChatApi.sendMessage(
          activeConversation.cuocTroChuyenId,
          content,
          accessToken,
          clientMsgId,
        );
        handleNewMessage({ ...restMsg, deliveryStatus: 'DA_GUI' });
      }
    } catch (err: unknown) {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, deliveryStatus: 'THAT_BAI' }
            : m,
        ),
      );
      setErrorMsg(err instanceof Error ? err.message : 'Gửi lại tin nhắn thất bại.');
    } finally {
      setSending(false);
    }
  };

  // Đóng cuộc trò chuyện
  const handleCloseChat = async () => {
    if (!activeConversation || !accessToken) return;
    if (!confirm('Bạn có chắc chắn muốn kết thúc cuộc trò chuyện này không?')) return;

    try {
      await closeSocketConversation(activeConversation.cuocTroChuyenId, 'Khách hàng kết thúc hỗ trợ');
      const updated = await supportChatApi.closeConversation(
        activeConversation.cuocTroChuyenId,
        accessToken,
        'Khách hàng kết thúc hỗ trợ',
      );
      handleConversationClosed(updated);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể kết thúc cuộc trò chuyện.');
    }
  };

  // Quản lý gõ phím (typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!activeConversation) return;

    emitTyping(activeConversation.cuocTroChuyenId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitTyping(activeConversation.cuocTroChuyenId, false);
    }, 1500);
  };

  // CHƯA ĐĂNG NHẬP
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-full space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
          <Headphones className="w-7 h-7" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm">Yêu cầu đăng nhập</h4>
          <p className="text-xs text-slate-500 mt-1">
            Vui lòng đăng nhập tài khoản Khách hàng để kết nối trực tiếp với nhân viên hỗ trợ của nhà xe.
          </p>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-colors shadow-sm"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  // MÀN HÌNH DANH SÁCH LỊCH SỬ CÁC PHIÊN CHAT CŨ (F-01)
  if (showHistoryList && selectedCompany) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHistoryList(false)}
              className="text-xs text-slate-500 hover:text-brand flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
            </button>
            <span className="text-xs font-semibold text-slate-700 ml-1">
              Lịch sử hỗ trợ - {selectedCompany.name}
            </span>
          </div>
          <button
            onClick={() => {
              setActiveConversation(null);
              setShowHistoryList(false);
            }}
            className="text-xs text-brand font-medium hover:underline flex items-center gap-1"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Tạo chat mới
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {pastConversations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Chưa có lịch sử cuộc trò chuyện nào đã đóng.
            </div>
          ) : (
            pastConversations.map((c) => (
              <button
                key={c.cuocTroChuyenId}
                onClick={() => handleSelectHistoryConversation(c)}
                className="w-full text-left p-3 bg-white border border-slate-200 rounded-xl hover:border-brand/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                  <span className="truncate">{c.tieuDe || c.maCuocTroChuyen}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                    Đã đóng
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                  {c.nhanVien && (
                    <span className="truncate">CSKH: {c.nhanVien.taiKhoan.hoTen}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // MÀN HÌNH CHỌN NHÀ XE & BẮT ĐẦU CUỘC TRÒ CHUYỆN MỚI
  if (!activeConversation) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <div className="p-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Chọn nhà xe cần hỗ trợ</span>
          {selectedCompany && (
            <div className="flex items-center gap-2">
              {pastConversations.length > 0 && (
                <button
                  onClick={() => setShowHistoryList(true)}
                  className="text-xs text-slate-600 hover:text-brand flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> Lịch sử ({pastConversations.length})
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedCompany(null);
                  setPastConversations([]);
                }}
                className="text-xs text-brand hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Đổi nhà xe
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="m-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!selectedCompany ? (
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            <div className="mb-2">
              <input
                type="text"
                placeholder="Tìm kiếm nhà xe theo tên..."
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingCompanies ? (
                <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách nhà xe...
                </div>
              ) : busCompanies.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">Không tìm thấy nhà xe nào.</div>
              ) : (
                busCompanies.map((c) => (
                  <button
                    key={c.busCompanyId}
                    onClick={() => handleSelectCompany(c)}
                    className="w-full text-left p-2.5 bg-white border border-slate-100 rounded-xl hover:border-brand/50 hover:shadow-sm transition-all flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-100">
                      <Building2 className="w-5 h-5 text-slate-400 group-hover:text-brand transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-slate-800 truncate group-hover:text-brand">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {c.contactInfo ? `Liên hệ: ${c.contactInfo}` : 'Chưa cập nhật thông tin liên hệ'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-4 flex flex-col justify-between bg-white">
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0 border border-slate-200">
                  <Building2 className="w-5 h-5 text-brand" />
                </div>
                <div className="min-w-0">
                  <h5 className="font-bold text-xs text-slate-800 truncate">{selectedCompany.name}</h5>
                  <p className="text-[11px] text-slate-500 truncate">
                    {selectedCompany.contactInfo
                      ? `Liên hệ: ${selectedCompany.contactInfo}`
                      : 'Chưa cập nhật thông tin liên hệ'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nhập câu hỏi hoặc vấn đề của bạn:
                </label>
                <textarea
                  rows={4}
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Ví dụ: Em cần hỗ trợ đổi vé chuyến 19h tối nay từ Hà Nội đi Đà Nẵng..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleStartConversation}
              disabled={!initialMessage.trim() || startingChat}
              className="w-full py-2.5 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {startingChat ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang kết nối...
                </>
              ) : (
                <>Bắt đầu trò chuyện với nhà xe</>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // MÀN HÌNH TRÒ CHUYỆN REAL-TIME VỚI NHÂN VIÊN NHÀ XE (HOẶC XEM LỊCH SỬ ĐÃ ĐÓNG)
  const isClosed = activeConversation.trangThai === 'DA_DONG';
  const staffName = activeConversation.nhanVien?.taiKhoan.hoTen || 'Nhân viên CSKH';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header cuộc trò chuyện */}
      <div className="px-3 py-2 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs">
              {activeConversation.nhaXe.tenNhaXe.charAt(0)}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                isClosed ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-slate-800 truncate">
              {activeConversation.nhaXe.tenNhaXe}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
              {isClosed ? (
                <span className="text-slate-500 font-medium">Cuộc trò chuyện đã kết thúc</span>
              ) : activeConversation.nhanVien ? (
                <span className="text-emerald-600 font-medium">{staffName}</span>
              ) : (
                <span className="text-amber-600 font-medium">Đang chờ nhân viên tiếp nhận</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {pastConversations.length > 0 && (
            <button
              onClick={() => setShowHistoryList(true)}
              title="Lịch sử hỗ trợ"
              className="text-[11px] text-slate-500 hover:text-brand p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-0.5"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          {!isClosed && (
            <button
              onClick={handleCloseChat}
              title="Kết thúc hỗ trợ"
              className="text-[11px] text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              setActiveConversation(null);
              setSelectedCompany(null);
            }}
            title="Đổi nhà xe"
            className="text-[11px] text-slate-500 hover:text-brand px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Đổi nhà xe
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2 bg-rose-50 text-rose-700 text-xs text-center border-b border-rose-100 flex items-center justify-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Danh sách tin nhắn */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải tin nhắn...
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMe = msg.loaiNguoiGui === 'KHACH_HANG';
              const isSystem = msg.loaiNguoiGui === 'HE_THONG';
              const isPending = msg.deliveryStatus === 'DANG_GUI';
              const isFailed = msg.deliveryStatus === 'THAT_BAI';

              if (isSystem) {
                return (
                  <div key={msg.tinNhanId} className="text-center my-2">
                    <span className="inline-block text-[10px] text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full font-medium">
                      {msg.noiDung}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.tinNhanId} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      isMe ? 'bg-slate-200 text-slate-700' : 'bg-brand/10 text-brand'
                    }`}
                  >
                    {isMe ? <User className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">
                        {isMe ? 'Bạn' : msg.taiKhoanGui?.hoTen || staffName}
                      </span>
                      {isPending && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 animate-spin" /> Đang gửi
                        </span>
                      )}
                    </div>
                    <div
                      className={`p-2.5 rounded-2xl text-xs leading-relaxed shadow-sm break-words transition-opacity ${
                        isMe
                          ? isFailed
                            ? 'bg-rose-50 border border-rose-300 text-rose-800 rounded-tr-none'
                            : isPending
                              ? 'bg-brand/75 text-white rounded-tr-none'
                              : 'bg-brand text-white rounded-tr-none'
                          : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      {msg.noiDung}
                    </div>
                    {isFailed && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-rose-600">
                        <AlertCircle className="w-3 h-3" />
                        <span>Gửi thất bại</span>
                        <button
                          type="button"
                          onClick={() => handleRetryMessage(msg)}
                          disabled={sending}
                          className="font-semibold underline hover:text-rose-700 flex items-center gap-0.5 ml-1"
                        >
                          <RotateCw className="w-2.5 h-2.5" /> Thử lại
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {staffTyping && (
              <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                <Headphones className="w-3.5 h-3.5 animate-pulse" />
                <span>Nhân viên hỗ trợ đang nhập...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input gửi tin nhắn */}
      <div className="p-2.5 bg-white border-t border-slate-100 shrink-0">
        {isClosed ? (
          <div className="space-y-2">
            <div className="p-2 bg-slate-100 text-slate-500 text-xs rounded-xl text-center font-medium">
              Cuộc trò chuyện này đã kết thúc.
            </div>
            <button
              onClick={() => {
                setActiveConversation(null);
                setMessages([]);
              }}
              className="w-full py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover transition-colors flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Bắt đầu cuộc trò chuyện mới
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Nhập tin nhắn..."
              disabled={sending}
              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand text-xs"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || sending}
              className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
