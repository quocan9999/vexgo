'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Loader2,
  User,
  CheckCircle2,
  Clock,
  Archive,
  Phone,
  AlertCircle,
  MessageSquare,
  XCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  getAdminAccessToken,
  type AdminSession,
} from '@/features/admin-auth/services/admin-auth';
import { hasAdminPermission } from '@/features/admin-auth/services/admin-access';
import { adminSupportChatApi } from '../services/admin-support-chat.api';
import { useAdminChatSocket } from '../hooks/use-admin-chat-socket';
import { AdminSupportConversation, AdminSupportMessage } from '../types';

type FilterTab = 'ALL' | 'CHO_TIEP_NHAN' | 'DANG_XU_LY' | 'DA_DONG';

export function AdminChatMessenger({ session }: { session: AdminSession }) {
  const token = getAdminAccessToken();
  const canManageChat = hasAdminPermission(session, 'chat:manage');

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);

  const [selectedConv, setSelectedConv] = useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Tải danh sách cuộc trò chuyện từ API thật
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminSupportChatApi.listConversations(
        {
          trangThai: activeTab === 'ALL' ? undefined : activeTab,
          pageSize: 50,
        },
        token,
      );
      setConversations(res.data || []);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tải danh sách cuộc trò chuyện.',
      );
    } finally {
      setLoadingConversations(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    adminSupportChatApi
      .listConversations(
        {
          trangThai: activeTab === 'ALL' ? undefined : activeTab,
          pageSize: 50,
        },
        token,
      )
      .then((res) => {
        if (active) setConversations(res.data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Không thể tải danh sách cuộc trò chuyện.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingConversations(false);
      });

    return () => {
      active = false;
    };
  }, [token, activeTab]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setLoadingConversations(true);
  };

  // Tải tin nhắn khi chọn cuộc trò chuyện
  const handleSelectConversation = async (conv: AdminSupportConversation) => {
    setSelectedConv(conv);
    setErrorMessage(null);
    if (!token) return;

    setLoadingMessages(true);
    try {
      const msgList = await adminSupportChatApi.getMessages(conv.cuocTroChuyenId, token);
      setMessages(msgList);
      // Đánh dấu đã đọc
      adminSupportChatApi.markMessagesAsRead(conv.cuocTroChuyenId, token).catch(() => {});
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể tải tin nhắn.');
    } finally {
      setLoadingMessages(false);
    }
  };

  // Socket callbacks
  const handleNewConversation = useCallback((conv: AdminSupportConversation) => {
    setConversations((prev) => {
      if (prev.some((c) => c.cuocTroChuyenId === conv.cuocTroChuyenId)) return prev;
      return [conv, ...prev];
    });
  }, []);

  const handleNewMessage = useCallback(
    (msg: AdminSupportMessage) => {
      // Cập nhật tin nhắn trong khung chat nếu đang xem cuộc trò chuyện này
      if (selectedConv && msg.cuocTroChuyenId === selectedConv.cuocTroChuyenId) {
        setMessages((prev) => {
          if (prev.some((m) => m.tinNhanId === msg.tinNhanId)) return prev;
          if (msg.clientMessageId && prev.some((m) => m.clientMessageId === msg.clientMessageId)) {
            return prev.map((m) => (m.clientMessageId === msg.clientMessageId ? msg : m));
          }
          return [...prev, msg];
        });
      }

      // Cập nhật tin nhắn cuối trong danh sách cuộc trò chuyện
      setConversations((prev) =>
        prev.map((c) =>
          c.cuocTroChuyenId === msg.cuocTroChuyenId
            ? { ...c, tinNhanCuoi: msg, updatedAt: msg.createdAt }
            : c,
        ),
      );
    },
    [selectedConv],
  );

  const handleConversationClaimed = useCallback((updatedConv: AdminSupportConversation) => {
    setConversations((prev) =>
      prev.map((c) => (c.cuocTroChuyenId === updatedConv.cuocTroChuyenId ? updatedConv : c)),
    );
    setSelectedConv((prev) =>
      prev?.cuocTroChuyenId === updatedConv.cuocTroChuyenId ? updatedConv : prev,
    );
  }, []);

  const handleConversationClosed = useCallback((closedConv: AdminSupportConversation) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.cuocTroChuyenId === closedConv.cuocTroChuyenId ? { ...c, trangThai: 'DA_DONG' } : c,
      ),
    );
    setSelectedConv((prev) =>
      prev?.cuocTroChuyenId === closedConv.cuocTroChuyenId ? { ...prev, trangThai: 'DA_DONG' } : prev,
    );
  }, []);

  // Hook WebSocket
  const {
    isConnected: socketConnected,
    customerTyping,
    sendMessage: sendSocketMessage,
    claimConversation: claimSocketConversation,
    closeConversation: closeSocketConversation,
    emitTyping,
  } = useAdminChatSocket({
    token,
    activeConversationId: selectedConv?.cuocTroChuyenId ?? null,
    onNewConversation: handleNewConversation,
    onNewMessage: handleNewMessage,
    onConversationClaimed: handleConversationClaimed,
    onConversationClosed: handleConversationClosed,
  });

  // Tiếp nhận cuộc trò chuyện (Claim)
  const handleClaim = async () => {
    if (!selectedConv || !token || actionLoading) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      let claimed = false;
      if (socketConnected) {
        const socketRes = await claimSocketConversation(selectedConv.cuocTroChuyenId);
        if (socketRes.success && socketRes.data) {
          claimed = true;
          handleConversationClaimed(socketRes.data);
        }
      }
      if (!claimed) {
        const restConv = await adminSupportChatApi.claimConversation(
          selectedConv.cuocTroChuyenId,
          token,
        );
        handleConversationClaimed(restConv);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tiếp nhận cuộc trò chuyện.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Đóng cuộc trò chuyện (Close)
  const handleClose = async () => {
    if (!selectedConv || !token || actionLoading) return;
    if (!confirm('Bạn có chắc chắn muốn kết thúc cuộc trò chuyện này?')) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      let closed = false;
      if (socketConnected) {
        const socketRes = await closeSocketConversation(
          selectedConv.cuocTroChuyenId,
          'Nhân viên CSKH kết thúc hỗ trợ',
        );
        if (socketRes.success && socketRes.data) {
          closed = true;
          handleConversationClosed(socketRes.data);
        }
      }
      if (!closed) {
        const restConv = await adminSupportChatApi.closeConversation(
          selectedConv.cuocTroChuyenId,
          token,
          'Nhân viên CSKH kết thúc hỗ trợ',
        );
        handleConversationClosed(restConv);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể kết thúc cuộc trò chuyện.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Gửi tin nhắn phản hồi
  const handleSendMessage = async () => {
    if (!selectedConv || !inputValue.trim() || !token || sending) return;

    const content = inputValue.trim();
    const clientMsgId = `staff-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setInputValue('');
    setSending(true);

    // Optimistic message
    const tempMsg: AdminSupportMessage = {
      tinNhanId: -Date.now(),
      cuocTroChuyenId: selectedConv.cuocTroChuyenId,
      taiKhoanGuiId: session.accountId,
      loaiNguoiGui: 'NHAN_VIEN',
      loaiTinNhan: 'VAN_BAN',
      noiDung: content,
      clientMessageId: clientMsgId,
      trangThai: 'DA_GUI',
      createdAt: new Date().toISOString(),
      taiKhoanGui: {
        taiKhoanId: session.accountId,
        hoTen: session.fullName,
        avatarUrl: null,
      },
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      let sentSuccess = false;
      if (socketConnected) {
        const socketRes = await sendSocketMessage(
          selectedConv.cuocTroChuyenId,
          content,
          clientMsgId,
        );
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage(socketRes.data);
        }
      }

      if (!sentSuccess) {
        const restMsg = await adminSupportChatApi.sendMessage(
          selectedConv.cuocTroChuyenId,
          content,
          token,
          clientMsgId,
        );
        handleNewMessage(restMsg);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gửi tin nhắn thất bại.',
      );
    } finally {
      setSending(false);
    }
  };

  // Typing event
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!selectedConv) return;

    emitTyping(selectedConv.cuocTroChuyenId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitTyping(selectedConv.cuocTroChuyenId, false);
    }, 1500);
  };

  // Lọc cuộc trò chuyện theo thanh tìm kiếm
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const customerName = c.khachHang.taiKhoan.hoTen.toLowerCase();
    const customerPhone = c.khachHang.taiKhoan.soDienThoai.toLowerCase();
    const code = c.maCuocTroChuyen.toLowerCase();
    return customerName.includes(query) || customerPhone.includes(query) || code.includes(query);
  });

  const isClosed = selectedConv?.trangThai === 'DA_DONG';
  const isPending = selectedConv?.trangThai === 'CHO_TIEP_NHAN';

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN */}
      <div className="w-80 md:w-96 border-r border-slate-200 flex flex-col bg-slate-50 shrink-0">
        {/* Header danh sách & Tab lọc */}
        <div className="p-3 border-b border-slate-200 bg-white space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand" /> Hộp thư hỗ trợ
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLoadingConversations(true);
                  void fetchConversations();
                }}
                title="Làm mới danh sách"
                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin' : ''}`} />
              </button>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  socketConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {socketConnected ? '● Trực tuyến' : '○ Ngoại tuyến'}
              </span>
            </div>
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm khách hàng, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-brand"
            />
          </div>

          {/* Tabs trạng thái */}
          <div className="flex gap-1 text-[11px] font-medium bg-slate-100 p-0.5 rounded-lg">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'CHO_TIEP_NHAN', label: 'Chờ nhận' },
                { key: 'DANG_XU_LY', label: 'Đang chat' },
                { key: 'DA_DONG', label: 'Đã đóng' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                className={`flex-1 py-1 rounded-md transition-all text-center ${
                  activeTab === t.key
                    ? 'bg-white text-slate-800 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs px-4">
              Không có cuộc trò chuyện nào trong mục này.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedConv?.cuocTroChuyenId === c.cuocTroChuyenId;
              const isWaiting = c.trangThai === 'CHO_TIEP_NHAN';

              return (
                <button
                  key={c.cuocTroChuyenId}
                  onClick={() => handleSelectConversation(c)}
                  className={`w-full text-left p-3 transition-colors flex items-start gap-3 ${
                    isSelected ? 'bg-brand/5 border-l-4 border-l-brand' : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      {c.khachHang.taiKhoan.hoTen.charAt(0).toUpperCase()}
                    </div>
                    {isWaiting && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-xs text-slate-800 truncate">
                        {c.khachHang.taiKhoan.hoTen}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(c.updatedAt).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate mb-1">
                      {c.tinNhanCuoi ? c.tinNhanCuoi.noiDung : 'Cuộc trò chuyện mới'}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {c.trangThai === 'CHO_TIEP_NHAN' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-2.5 h-2.5" /> Chờ tiếp nhận
                        </span>
                      )}
                      {c.trangThai === 'DANG_XU_LY' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Đang xử lý
                        </span>
                      )}
                      {c.trangThai === 'DA_DONG' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          <Archive className="w-2.5 h-2.5" /> Đã đóng
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 truncate">
                        {c.khachHang.taiKhoan.soDienThoai}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* KHUNG CHAT CHÍNH */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {!selectedConv ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-sm text-slate-700">Chọn cuộc trò chuyện</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Chọn một khách hàng từ danh sách bên trái để xem nội dung và trả lời hỗ trợ.
            </p>
          </div>
        ) : (
          <>
            {/* Topbar cuộc trò chuyện */}
            <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs">
                  {selectedConv.khachHang.taiKhoan.hoTen.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-800">
                      {selectedConv.khachHang.taiKhoan.hoTen}
                    </h3>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {selectedConv.khachHang.taiKhoan.soDienThoai}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Mã: {selectedConv.maCuocTroChuyen}</span>
                    <span>•</span>
                    <span>
                      Người xử lý:{' '}
                      <strong className="text-slate-600">
                        {selectedConv.nhanVien?.taiKhoan.hoTen || 'Chưa tiếp nhận'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {isPending && canManageChat && (
                  <button
                    onClick={handleClaim}
                    disabled={actionLoading}
                    className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Tiếp nhận hỗ trợ
                  </button>
                )}

                {!isClosed && canManageChat && (
                  <button
                    onClick={handleClose}
                    disabled={actionLoading}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Kết thúc
                  </button>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Khung tin nhắn */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải lịch sử tin nhắn...
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isStaff = msg.loaiNguoiGui === 'NHAN_VIEN';
                    const isSystem = msg.loaiNguoiGui === 'HE_THONG';

                    if (isSystem) {
                      return (
                        <div key={msg.tinNhanId} className="text-center my-2">
                          <span className="inline-block text-[10px] text-slate-500 bg-slate-200/60 px-3 py-1 rounded-full font-medium">
                            {msg.noiDung}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.tinNhanId}
                        className={`flex gap-2.5 ${isStaff ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                            isStaff ? 'bg-brand text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isStaff ? 'NV' : <User className="w-4 h-4" />}
                        </div>

                        <div
                          className={`flex flex-col gap-0.5 max-w-[70%] ${
                            isStaff ? 'items-end' : 'items-start'
                          }`}
                        >
                          <span className="text-[10px] text-slate-400">
                            {isStaff ? msg.taiKhoanGui?.hoTen || 'Nhân viên' : 'Khách hàng'} •{' '}
                            {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm break-words ${
                              isStaff
                                ? 'bg-brand text-white rounded-tr-none'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                            }`}
                          >
                            {msg.noiDung}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {customerTyping && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                      <User className="w-3.5 h-3.5 animate-pulse" />
                      <span>Khách hàng đang nhập...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Ô nhập tin nhắn */}
            <div className="p-3 bg-white border-t border-slate-200 shrink-0">
              {isClosed ? (
                <div className="p-2.5 bg-slate-100 text-slate-500 text-xs rounded-xl text-center font-medium">
                  Cuộc trò chuyện này đã kết thúc. Không thể gửi thêm tin nhắn.
                </div>
              ) : isPending ? (
                <div className="p-2.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs rounded-xl text-center flex items-center justify-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4" /> Vui lòng bấm &quot;Tiếp nhận hỗ trợ&quot; ở trên để bắt đầu phản hồi cho khách hàng.
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Nhập nội dung phản hồi khách hàng..."
                    disabled={sending}
                    className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand text-xs"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sending}
                    className="px-5 h-11 rounded-xl bg-brand text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Gửi
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
