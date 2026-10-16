'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  User,
  Phone,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  XCircle,
  Archive,
  RefreshCw,
  ArrowLeft,
  RotateCw,
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

/**
 * Reconciles server snapshot/fresh messages with existing messages in state.
 * - Replaces optimistic messages (negative IDs or THAT_BAI/DANG_GUI) when server has confirmed them by clientMessageId.
 * - Updates confirmed messages with latest server data (e.g. read status DA_DOC).
 * - Preserves optimistic messages that are still pending/failed and not in server snapshot.
 * - Preserves realtime messages already in state that arrived after the server snapshot.
 * - Deduplicates by tinNhanId and clientMessageId, and sorts chronologically.
 */
export function reconcileAdminMessages(
  prevMessages: AdminSupportMessage[],
  serverMessages: AdminSupportMessage[],
): AdminSupportMessage[] {
  const formattedServerMsgs = serverMessages.map((m) => ({
    ...m,
    deliveryStatus: 'DA_GUI' as const,
  }));

  const serverByClientId = new Map<string, AdminSupportMessage>();
  const serverById = new Map<number, AdminSupportMessage>();

  for (const sm of formattedServerMsgs) {
    if (sm.clientMessageId) {
      serverByClientId.set(sm.clientMessageId, sm);
    }
    if (sm.tinNhanId > 0) {
      serverById.set(sm.tinNhanId, sm);
    }
  }

  const result: AdminSupportMessage[] = [];
  const handledServerClientIds = new Set<string>();
  const handledServerIds = new Set<number>();

  for (const pm of prevMessages) {
    if (pm.clientMessageId && serverByClientId.has(pm.clientMessageId)) {
      // Server confirmed this message: replace optimistic negative ID / THAT_BAI with server confirmed version
      const serverMsg = serverByClientId.get(pm.clientMessageId)!;
      result.push(serverMsg);
      handledServerClientIds.add(pm.clientMessageId);
      if (serverMsg.tinNhanId > 0) handledServerIds.add(serverMsg.tinNhanId);
    } else if (pm.tinNhanId > 0 && serverById.has(pm.tinNhanId)) {
      // Both have it: use server version (with up-to-date trangThai like DA_DOC)
      const serverMsg = serverById.get(pm.tinNhanId)!;
      result.push(serverMsg);
      handledServerIds.add(pm.tinNhanId);
      if (serverMsg.clientMessageId) handledServerClientIds.add(serverMsg.clientMessageId);
    } else {
      // Optimistic message not yet on server, or realtime message in prev not in server snapshot
      result.push(pm);
    }
  }

  // Append any server messages not yet in prev
  for (const sm of formattedServerMsgs) {
    const alreadyHandled =
      (sm.clientMessageId && handledServerClientIds.has(sm.clientMessageId)) ||
      (sm.tinNhanId > 0 && handledServerIds.has(sm.tinNhanId));
    if (!alreadyHandled) {
      result.push(sm);
      if (sm.clientMessageId) handledServerClientIds.add(sm.clientMessageId);
      if (sm.tinNhanId > 0) handledServerIds.add(sm.tinNhanId);
    }
  }

  // Sort chronologically
  return result.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.tinNhanId - b.tinNhanId;
  });
}

export function AdminChatMessenger({ session }: { session: AdminSession }) {
  const token = getAdminAccessToken();
  const canManageChat = hasAdminPermission(session, 'chat:manage');

  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [conversations, setConversations] = useState<AdminSupportConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Pagination states (F-06)
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedConv, setSelectedConv] = useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPrependingOlderRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (isPrependingOlderRef.current) {
      isPrependingOlderRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Debounce search query (400ms) để tìm kiếm server-side có tenant scope (F-06)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Tải trang 1 danh sách cuộc trò chuyện theo filter/search
  useEffect(() => {
    if (!token) return;
    let active = true;

    adminSupportChatApi
      .listConversations(
        {
          trangThai: activeTab === 'ALL' ? undefined : activeTab,
          search: debouncedSearch.trim() || undefined,
          page: 1,
          pageSize: 20,
        },
        token,
      )
      .then((res) => {
        if (!active) return;
        setConversations(res.data || []);
        setPage(1);
        setTotalItems(res.meta?.totalItems || (res.data ? res.data.length : 0));
        setTotalPages(res.meta?.totalPages || 1);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Không thể tải danh sách cuộc trò chuyện.',
        );
      })
      .finally(() => {
        if (active) setLoadingConversations(false);
      });

    return () => {
      active = false;
    };
  }, [token, activeTab, debouncedSearch, refreshTrigger]);

  // Tải thêm cuộc trò chuyện (Load more pagination - F-06)
  const handleLoadMore = async () => {
    if (!token || loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await adminSupportChatApi.listConversations(
        {
          trangThai: activeTab === 'ALL' ? undefined : activeTab,
          search: debouncedSearch.trim() || undefined,
          page: nextPage,
          pageSize: 20,
        },
        token,
      );
      const newItems = res.data || [];
      setConversations((prev) => {
        const existingIds = new Set(prev.map((c) => c.cuocTroChuyenId));
        const filtered = newItems.filter((c) => !existingIds.has(c.cuocTroChuyenId));
        return [...prev, ...filtered];
      });
      setPage(nextPage);
      if (res.meta?.totalItems) setTotalItems(res.meta.totalItems);
      if (res.meta?.totalPages) setTotalPages(res.meta.totalPages);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tải thêm cuộc trò chuyện.',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const selectedConvId = selectedConv?.cuocTroChuyenId;
  const selectedConvIdRef = useRef(selectedConvId);
  const selectedConvRef = useRef(selectedConv);
  const adminReconnectRequestIdRef = useRef(0);
  const messageFetchRequestIdRef = useRef(0);
  const markSocketMessagesAsReadRef = useRef<((convId: number, tinNhanIds?: number[]) => void) | null>(null);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
    selectedConvRef.current = selectedConv;
  }, [selectedConvId, selectedConv]);

  // Tải lịch sử tin nhắn khi chọn một cuộc trò chuyện (chỉ fetch khi selectedConvId thay đổi - F-NEW-02 & F-NEW-03)
  useEffect(() => {
    if (!selectedConvId || !token) return;

    let active = true;
    const targetConvId = selectedConvId;
    const fetchReqId = ++messageFetchRequestIdRef.current;

    queueMicrotask(() => {
      if (active && selectedConvIdRef.current === targetConvId) {
        setLoadingMessages(true);
        setErrorMessage(null);
      }
    });

    adminSupportChatApi
      .getMessages(targetConvId, token, { pageSize: 50 })
      .then((msgs) => {
        if (!active || selectedConvIdRef.current !== targetConvId || messageFetchRequestIdRef.current !== fetchReqId) {
          return;
        }
        setHasOlderMessages(msgs.length >= 50);

        // Chống ghi đè tin nhắn realtime đã nhận trong lúc fetch đang in-flight (F-NEW-03)
        setMessages((prev) => reconcileAdminMessages(prev, msgs));

        // Tự động đánh dấu đã đọc các tin nhắn của khách hàng khi mở cuộc trò chuyện (P1 Regression fix)
        const unreadCustomerMessages = msgs.filter(
          (m) => m.loaiNguoiGui === 'KHACH_HANG' && m.trangThai !== 'DA_DOC' && m.tinNhanId > 0,
        );
        const unreadIds = unreadCustomerMessages.map((m) => m.tinNhanId);

        if (
          unreadIds.length > 0 ||
          (selectedConvRef.current?.soTinChuaDoc && selectedConvRef.current.soTinChuaDoc > 0)
        ) {
          adminSupportChatApi
            .markMessagesAsRead(targetConvId, token, unreadIds.length > 0 ? unreadIds : undefined)
            .catch((err) => {
              console.warn('[AdminChat] Failed to mark messages as read on open:', err);
            });
          markSocketMessagesAsReadRef.current?.(
            targetConvId,
            unreadIds.length > 0 ? unreadIds : undefined,
          );

          // Cập nhật số tin chưa đọc trong danh sách về 0 và tin cuối thành DA_DOC
          setConversations((prevList) =>
            prevList.map((conv) => {
              if (conv.cuocTroChuyenId === targetConvId) {
                return {
                  ...conv,
                  soTinChuaDoc: 0,
                  tinNhanCuoi:
                    conv.tinNhanCuoi && conv.tinNhanCuoi.loaiNguoiGui === 'KHACH_HANG'
                      ? { ...conv.tinNhanCuoi, trangThai: 'DA_DOC' }
                      : conv.tinNhanCuoi,
                };
              }
              return conv;
            }),
          );

          // Cập nhật tin nhắn trong khung chat thành DA_DOC
          setMessages((prevMsgs) =>
            prevMsgs.map((m) =>
              m.loaiNguoiGui === 'KHACH_HANG' && (unreadIds.length === 0 || unreadIds.includes(m.tinNhanId))
                ? { ...m, trangThai: 'DA_DOC', daDocLuc: new Date().toISOString() }
                : m,
            ),
          );
        }
      })
      .catch((err: unknown) => {
        if (active && selectedConvIdRef.current === targetConvId) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Không thể tải tin nhắn cuộc trò chuyện.',
          );
        }
      })
      .finally(() => {
        if (active && selectedConvIdRef.current === targetConvId) {
          setLoadingMessages(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedConvId, token]);

  // Tải tin nhắn cũ hơn (Load older messages - F-NEW-04)
  const handleLoadOlderMessages = async () => {
    if (!selectedConvId || !token || loadingOlderMessages || !hasOlderMessages) return;
    const targetConvId = selectedConvId;
    const positiveIds = messages.map((m) => m.tinNhanId).filter((id) => id > 0);
    if (positiveIds.length === 0) return;
    const oldestId = Math.min(...positiveIds);

    setLoadingOlderMessages(true);
    try {
      const older = await adminSupportChatApi.getMessages(targetConvId, token, {
        beforeId: oldestId,
        pageSize: 50,
      });
      if (selectedConvIdRef.current !== targetConvId) return;

      if (older.length < 50) {
        setHasOlderMessages(false);
      }
      if (older.length > 0) {
        isPrependingOlderRef.current = true;
        setMessages((prev) => {
          const currentIds = new Set(prev.map((m) => m.tinNhanId).filter((id) => id > 0));
          const newOlder = older
            .filter((m) => !currentIds.has(m.tinNhanId))
            .map((m) => ({ ...m, deliveryStatus: 'DA_GUI' as const }));
          return [...newOlder, ...prev];
        });
      }
    } catch (err: unknown) {
      if (selectedConvIdRef.current === targetConvId) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Không thể tải thêm tin nhắn cũ.',
        );
      }
    } finally {
      if (selectedConvIdRef.current === targetConvId) {
        setLoadingOlderMessages(false);
      }
    }
  };

  // Đồng bộ lại khi Socket reconnect (F-NEW-01, F-NEW-02, F-NEW-04)
  const handleReconnected = useCallback(async () => {
    setRefreshTrigger((k) => k + 1);

    if (!selectedConvId || !token) return;
    const targetConvId = selectedConvId;
    const reqId = ++adminReconnectRequestIdRef.current;
    try {
      const updatedConv = await adminSupportChatApi.getConversationById(targetConvId, token);
      if (adminReconnectRequestIdRef.current !== reqId || selectedConvIdRef.current !== targetConvId) return;
      setSelectedConv((prev) => (prev?.cuocTroChuyenId === targetConvId ? { ...prev, ...updatedConv } : prev));

      const freshMsgs = await adminSupportChatApi.getMessages(targetConvId, token, { pageSize: 50 });
      if (adminReconnectRequestIdRef.current !== reqId || selectedConvIdRef.current !== targetConvId) return;

      setMessages((prev) => {
        if (selectedConvIdRef.current !== targetConvId) return prev;
        return reconcileAdminMessages(prev, freshMsgs);
      });
    } catch (err) {
      console.warn('[AdminChat] Reconnect sync error:', err);
    }
  }, [selectedConvId, token]);

  // Callback khi có tin nhắn mới từ WebSocket
  const handleNewMessage = useCallback(
    (newMsg: AdminSupportMessage) => {
      const isCurrentlyOpen = selectedConvIdRef.current === newMsg.cuocTroChuyenId;

      // 1. Cập nhật tin nhắn trong khung chat hiện tại nếu trùng cuocTroChuyenId
      if (isCurrentlyOpen) {
        // Nếu Admin đang mở hội thoại và tin nhắn từ khách hàng, đánh dấu đã đọc ngay lập tức (P1)
        if (newMsg.loaiNguoiGui === 'KHACH_HANG' && token) {
          adminSupportChatApi
            .markMessagesAsRead(newMsg.cuocTroChuyenId, token, [newMsg.tinNhanId])
            .catch((err) => {
              console.warn('[AdminChat] Failed to mark realtime message as read:', err);
            });
          markSocketMessagesAsReadRef.current?.(newMsg.cuocTroChuyenId, [newMsg.tinNhanId]);
        }

        const msgWithStatus: AdminSupportMessage = {
          ...newMsg,
          trangThai: newMsg.loaiNguoiGui === 'KHACH_HANG' ? 'DA_DOC' : newMsg.trangThai,
          deliveryStatus: 'DA_GUI',
        };

        setMessages((prev) => {
          if (prev.some((m) => m.tinNhanId === msgWithStatus.tinNhanId && m.tinNhanId > 0)) return prev;
          if (msgWithStatus.clientMessageId && prev.some((m) => m.clientMessageId === msgWithStatus.clientMessageId)) {
            return prev.map((m) =>
              m.clientMessageId === msgWithStatus.clientMessageId
                ? msgWithStatus
                : m,
            );
          }
          return [...prev, msgWithStatus];
        });
      }

      // 2. Cập nhật preview tin nhắn cuối trong danh sách cuộc trò chuyện
      setConversations((prev) =>
        prev.map((c) => {
          if (c.cuocTroChuyenId === newMsg.cuocTroChuyenId) {
            const updatedUnread = isCurrentlyOpen
              ? 0
              : newMsg.loaiNguoiGui === 'KHACH_HANG'
                ? (c.soTinChuaDoc || 0) + 1
                : c.soTinChuaDoc;
            return {
              ...c,
              tinNhanCuoi: {
                ...newMsg,
                trangThai: isCurrentlyOpen && newMsg.loaiNguoiGui === 'KHACH_HANG' ? 'DA_DOC' : newMsg.trangThai,
              },
              soTinChuaDoc: updatedUnread,
              updatedAt: newMsg.createdAt,
            };
          }
          return c;
        }),
      );
    },
    [token],
  );

  // Callback khi có nhân viên tiếp nhận
  const handleConversationClaimed = useCallback((claimedConv: AdminSupportConversation) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.cuocTroChuyenId === claimedConv.cuocTroChuyenId ? { ...c, ...claimedConv } : c,
      ),
    );
    setSelectedConv((prev) =>
      prev?.cuocTroChuyenId === claimedConv.cuocTroChuyenId ? { ...prev, ...claimedConv } : prev,
    );
  }, []);

  // Callback khi cuộc trò chuyện kết thúc
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

  // Callback khi nhận read receipt từ socket
  const handleMessagesReadReceipt = useCallback(
    (payload: {
      cuocTroChuyenId: number;
      readByTaiKhoanId: number;
      tinNhanIds?: number[];
      updatedCount: number;
    }) => {
      if (selectedConvIdRef.current && payload.cuocTroChuyenId === selectedConvIdRef.current) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.loaiNguoiGui === 'NHAN_VIEN') {
              if (
                !payload.tinNhanIds ||
                payload.tinNhanIds.length === 0 ||
                payload.tinNhanIds.includes(m.tinNhanId)
              ) {
                return { ...m, trangThai: 'DA_DOC' };
              }
            }
            return m;
          }),
        );
      }
    },
    [],
  );

  // Hook WebSocket kết nối namespace /chat
  const {
    isConnected: socketConnected,
    customerTyping,
    sendMessage: sendSocketMessage,
    claimConversation: claimSocketConversation,
    closeConversation: closeSocketConversation,
    emitTyping,
    markMessagesAsRead: markSocketMessagesAsRead,
  } = useAdminChatSocket({
    token,
    activeConversationId: selectedConv?.cuocTroChuyenId ?? null,
    onNewMessage: handleNewMessage,
    onConversationClaimed: handleConversationClaimed,
    onConversationClosed: handleConversationClosed,
    onMessagesReadReceipt: handleMessagesReadReceipt,
    onReconnected: handleReconnected,
  });

  useEffect(() => {
    markSocketMessagesAsReadRef.current = markSocketMessagesAsRead;
  }, [markSocketMessagesAsRead]);

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

  // Gửi tin nhắn phản hồi (F-03 timeout resilience & F-04 delivery states)
  const handleSendMessage = async () => {
    if (!selectedConv || !inputValue.trim() || !token || sending) return;

    const content = inputValue.trim();
    const clientMsgId = `staff-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const tempId = -Date.now();
    setInputValue('');
    setSending(true);
    setErrorMessage(null);

    // Optimistic message với deliveryStatus = DANG_GUI
    const tempMsg: AdminSupportMessage = {
      tinNhanId: tempId,
      cuocTroChuyenId: selectedConv.cuocTroChuyenId,
      taiKhoanGuiId: session.accountId,
      loaiNguoiGui: 'NHAN_VIEN',
      loaiTinNhan: 'VAN_BAN',
      noiDung: content,
      clientMessageId: clientMsgId,
      trangThai: 'DA_GUI',
      deliveryStatus: 'DANG_GUI',
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
      // 1. Gửi qua socket (có timeout 5000ms - F-03)
      if (socketConnected) {
        const socketRes = await sendSocketMessage(
          selectedConv.cuocTroChuyenId,
          content,
          clientMsgId,
        );
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      // 2. Fallback REST nếu socket timeout/lỗi (BẮT BUỘC dùng lại cùng clientMsgId để backend deduplicate)
      if (!sentSuccess) {
        const restMsg = await adminSupportChatApi.sendMessage(
          selectedConv.cuocTroChuyenId,
          content,
          token,
          clientMsgId,
        );
        handleNewMessage({ ...restMsg, deliveryStatus: 'DA_GUI' });
      }
    } catch (err: unknown) {
      // Đánh dấu tin nhắn là thất bại để nhân viên có thể bấm Thử lại (F-04)
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, deliveryStatus: 'THAT_BAI' }
            : m,
        ),
      );
      setErrorMessage(
        err instanceof Error ? err.message : 'Gửi tin nhắn thất bại. Vui lòng bấm Thử lại.',
      );
    } finally {
      // Luôn luôn giải phóng sending để input không bao giờ bị khóa vô hạn (F-03)
      setSending(false);
    }
  };

  // Thử lại tin nhắn đã gửi thất bại (F-04)
  const handleRetryMessage = async (failedMsg: AdminSupportMessage) => {
    if (!selectedConv || !token || sending) return;

    const clientMsgId = failedMsg.clientMessageId || `staff-retry-${failedMsg.tinNhanId}`;
    const content = failedMsg.noiDung;

    setSending(true);
    setErrorMessage(null);

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
        const socketRes = await sendSocketMessage(
          selectedConv.cuocTroChuyenId,
          content,
          clientMsgId,
        );
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      if (!sentSuccess) {
        const restMsg = await adminSupportChatApi.sendMessage(
          selectedConv.cuocTroChuyenId,
          content,
          token,
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
      setErrorMessage(
        err instanceof Error ? err.message : 'Gửi lại tin nhắn thất bại.',
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

  const isClosed = selectedConv?.trangThai === 'DA_DONG';
  const isPending = selectedConv?.trangThai === 'CHO_TIEP_NHAN';

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ============================================================== */}
      {/* CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN (MASTER PANE - F-05 RESPONSIVE) */}
      {/* Trên mobile: ẩn khi đang chọn cuộc trò chuyện (selectedConv !== null) */}
      {/* ============================================================== */}
      <div
        className={`${
          selectedConv ? 'hidden md:flex' : 'flex'
        } w-full md:w-96 border-r border-slate-200 flex-col bg-slate-50 shrink-0`}
      >
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
                  setRefreshTrigger((k) => k + 1);
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

          {/* Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-lg text-[11px] font-medium">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'CHO_TIEP_NHAN', label: 'Chờ nhận' },
                { key: 'DANG_XU_LY', label: 'Đang chat' },
                { key: 'DA_DONG', label: 'Đã đóng' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-1 rounded-md text-center transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-brand shadow-sm font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-brand" />
              <span>Đang tải danh sách...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Không có cuộc trò chuyện nào phù hợp.
            </div>
          ) : (
            <>
              {conversations.map((c) => {
                const isSelected = selectedConv?.cuocTroChuyenId === c.cuocTroChuyenId;
                const isWaiting = c.trangThai === 'CHO_TIEP_NHAN';

                return (
                  <button
                    key={c.cuocTroChuyenId}
                    onClick={() => {
                      adminReconnectRequestIdRef.current++;
                      setSelectedConv(c);
                    }}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors ${
                      isSelected
                        ? 'bg-brand/5 border-l-4 border-l-brand'
                        : 'hover:bg-slate-100/60'
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.soTinChuaDoc !== undefined && c.soTinChuaDoc > 0 && (
                            <span
                              data-testid="unread-badge"
                              className="bg-brand text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                            >
                              {c.soTinChuaDoc}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {new Date(c.updatedAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
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
              })}

              {/* Nút tải thêm cuộc trò chuyện (F-06 Pagination) */}
              {conversations.length < totalItems && (
                <div className="p-3 bg-white text-center border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-2 px-3 text-xs font-semibold text-brand hover:bg-brand/5 rounded-lg border border-brand/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải thêm...
                      </>
                    ) : (
                      <>Tải thêm cuộc trò chuyện ({conversations.length}/{totalItems})</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* CỘT PHẢI: KHUNG CHAT CHI TIẾT (DETAIL PANE - F-05 RESPONSIVE)   */}
      {/* Trên mobile: chỉ hiển thị khi đã chọn cuộc trò chuyện (selectedConv !== null) */}
      {/* ============================================================== */}
      <div
        className={`${
          selectedConv ? 'flex' : 'hidden md:flex'
        } flex-1 flex-col bg-white overflow-hidden`}
      >
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
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                {/* Nút quay lại danh sách trên mobile (F-05) */}
                <button
                  type="button"
                  onClick={() => setSelectedConv(null)}
                  className="md:hidden p-1.5 text-slate-600 hover:text-brand hover:bg-slate-100 rounded-lg shrink-0"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                  {selectedConv.khachHang.taiKhoan.hoTen.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs text-slate-800 truncate">
                      {selectedConv.khachHang.taiKhoan.hoTen}
                    </h3>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono truncate">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      {selectedConv.khachHang.taiKhoan.soDienThoai}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 truncate">
                    <span>Mã: {selectedConv.maCuocTroChuyen}</span>
                    <span>•</span>
                    <span className="truncate">
                      Người xử lý:{' '}
                      <strong className="text-slate-600">
                        {selectedConv.nhanVien?.taiKhoan.hoTen || 'Chưa tiếp nhận'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
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
                    <span className="hidden sm:inline">Tiếp nhận hỗ trợ</span>
                    <span className="sm:hidden">Nhận</span>
                  </button>
                )}

                {!isClosed && canManageChat && (
                  <button
                    onClick={handleClose}
                    disabled={actionLoading}
                    className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kết thúc</span>
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
                  {hasOlderMessages && (
                    <div className="text-center py-1">
                      <button
                        type="button"
                        onClick={handleLoadOlderMessages}
                        disabled={loadingOlderMessages}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full text-xs font-medium shadow-2xs transition-colors disabled:opacity-50"
                      >
                        {loadingOlderMessages ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Clock className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{loadingOlderMessages ? 'Đang tải tin cũ...' : 'Tải tin nhắn cũ hơn'}</span>
                      </button>
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isStaff = msg.loaiNguoiGui === 'NHAN_VIEN';
                    const isSystem = msg.loaiNguoiGui === 'HE_THONG';
                    const isPendingMsg = msg.deliveryStatus === 'DANG_GUI';
                    const isFailedMsg = msg.deliveryStatus === 'THAT_BAI';

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
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">
                              {isStaff ? msg.taiKhoanGui?.hoTen || 'Nhân viên' : 'Khách hàng'} •{' '}
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {isPendingMsg && (
                              <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5 animate-spin" /> Đang gửi
                              </span>
                            )}
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm break-words transition-opacity ${
                              isStaff
                                ? isFailedMsg
                                  ? 'bg-rose-50 border border-rose-300 text-rose-800 rounded-tr-none'
                                  : isPendingMsg
                                    ? 'bg-brand/75 text-white rounded-tr-none'
                                    : 'bg-brand text-white rounded-tr-none'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                            }`}
                          >
                            {msg.noiDung}
                          </div>
                          {isFailedMsg && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-rose-600">
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
