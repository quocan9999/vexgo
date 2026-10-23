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
  X,
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
      if (serverMsg.clientMessageId)
        handledServerClientIds.add(serverMsg.clientMessageId);
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
  const [conversations, setConversations] = useState<
    AdminSupportConversation[]
  >([]);
  const [searchQuery, setSearchQuery] = useState('');
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Pagination states (F-06)
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedConv, setSelectedConv] =
    useState<AdminSupportConversation | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const messageElementsRef = useRef(new Map<number, HTMLDivElement>());
  const confirmedReadIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () =>
      setDocumentVisible(document.visibilityState !== 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPrependingOlderRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const messageSequence = messages
    .map((message) => message.clientMessageId ?? message.tinNhanId)
    .join('|');
  useEffect(() => {
    if (isPrependingOlderRef.current) {
      isPrependingOlderRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messageSequence, scrollToBottom]);

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
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách cuộc trò chuyện.',
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
        const filtered = newItems.filter(
          (c) => !existingIds.has(c.cuocTroChuyenId),
        );
        return [...prev, ...filtered];
      });
      setPage(nextPage);
      if (res.meta?.totalItems) setTotalItems(res.meta.totalItems);
      if (res.meta?.totalPages) setTotalPages(res.meta.totalPages);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể tải thêm cuộc trò chuyện.',
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
  const historyWatermarkRef = useRef<{ id: number; messageId: number } | null>(
    null,
  );
  const readInFlightRef = useRef<string | null>(null);
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    selectedConvIdRef.current = selectedConvId;
    selectedConvRef.current = selectedConv;
  }, [selectedConvId, selectedConv]);

  // Only actual text-bubble intersections count as viewed. Keep one explicit-ID
  // REST read in flight; acknowledge before changing local status or badge.
  useEffect(() => {
    if (
      !selectedConvId ||
      !token ||
      loadingMessages ||
      document.visibilityState === 'hidden'
    )
      return;
    const root = transcriptRef.current;
    if (!root || !documentVisible) return;
    const targetId = selectedConvId;
    const requestId = messageFetchRequestIdRef.current;
    const key = `${token}:${targetId}:${requestId}`;
    let disposed = false;
    const current = () =>
      mountedRef.current &&
      tokenRef.current === token &&
      selectedConvIdRef.current === targetId &&
      messageFetchRequestIdRef.current === requestId;
    const checkVisible = () => {
      if (
        disposed ||
        !current() ||
        document.visibilityState === 'hidden' ||
        readInFlightRef.current === key
      )
        return;
      const area = root.getBoundingClientRect();
      const top = Math.max(0, area.top),
        bottom = Math.min(window.innerHeight, area.bottom);
      const left = Math.max(0, area.left),
        right = Math.min(window.innerWidth, area.right);
      if (bottom <= top || right <= left) return;
      const ids = messages
        .filter((message) => {
          if (
            message.cuocTroChuyenId !== targetId ||
            message.loaiNguoiGui !== 'KHACH_HANG' ||
            message.trangThai !== 'DA_GUI' ||
            message.tinNhanId <= 0 ||
            confirmedReadIdsRef.current.has(`${targetId}:${message.tinNhanId}`)
          )
            return false;
          const box = messageElementsRef.current
            .get(message.tinNhanId)
            ?.getBoundingClientRect();
          return (
            box &&
            box.width > 0 &&
            box.height > 0 &&
            box.bottom > top &&
            box.top < bottom &&
            box.right > left &&
            box.left < right
          );
        })
        .map((message) => message.tinNhanId);
      if (!ids.length) return;
      readInFlightRef.current = key;
      void (async () => {
        let acknowledged = false;
        try {
          const acknowledgement = await adminSupportChatApi.markMessagesAsRead(
            targetId,
            token,
            ids,
          );
          if (!current()) return;
          // Detail may carry an authoritative count; older API versions omit it.
          let detail: AdminSupportConversation | undefined;
          try {
            detail = await adminSupportChatApi.getConversationById(
              targetId,
              token,
            );
          } catch {}
          if (!current()) return;
          ids.forEach((id) =>
            confirmedReadIdsRef.current.add(`${targetId}:${id}`),
          );
          setMessages((previous) =>
            previous.map((m) =>
              m.cuocTroChuyenId === targetId && ids.includes(m.tinNhanId)
                ? { ...m, trangThai: 'DA_DOC' }
                : m,
            ),
          );
          setConversations((previous) =>
            previous.map((c) =>
              c.cuocTroChuyenId === targetId
                ? {
                    ...c,
                    soTinChuaDoc:
                      detail?.soTinChuaDoc ??
                      (c.soTinChuaDoc === undefined
                        ? undefined
                        : Math.max(
                            0,
                            c.soTinChuaDoc - acknowledgement.updatedCount,
                          )),
                    tinNhanCuoi:
                      c.tinNhanCuoi && ids.includes(c.tinNhanCuoi.tinNhanId)
                        ? { ...c.tinNhanCuoi, trangThai: 'DA_DOC' }
                        : c.tinNhanCuoi,
                  }
                : c,
            ),
          );
          acknowledged = true;
        } catch (error) {
          console.warn('[AdminChat] Read acknowledgement failed:', error);
        } finally {
          if (readInFlightRef.current === key) readInFlightRef.current = null;
          // A user can scroll to another bubble while the first ACK is pending.
          // Recheck it after success, but never spin on a failed request.
          if (acknowledged) checkVisible();
        }
      })();
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(checkVisible, { root });
    messageElementsRef.current.forEach((element) => observer?.observe(element));
    root.addEventListener('scroll', checkVisible);
    window.addEventListener('resize', checkVisible);
    checkVisible();
    return () => {
      disposed = true;
      observer?.disconnect();
      root.removeEventListener('scroll', checkVisible);
      window.removeEventListener('resize', checkVisible);
    };
  }, [messages, selectedConvId, token, loadingMessages, documentVisible]);

  // Tải lịch sử tin nhắn khi chọn một cuộc trò chuyện (chỉ fetch khi selectedConvId thay đổi - F-NEW-02 & F-NEW-03)
  useEffect(() => {
    if (!selectedConvId || !token) return;

    let active = true;
    const targetConvId = selectedConvId;
    historyWatermarkRef.current = null;
    const fetchReqId = ++messageFetchRequestIdRef.current;

    queueMicrotask(() => {
      if (active && selectedConvIdRef.current === targetConvId) {
        setLoadingMessages(true);
        setErrorMessage(null);
      }
    });

    Promise.all([
      adminSupportChatApi.getMessages(targetConvId, token, { pageSize: 50 }),
      adminSupportChatApi
        .getConversationById(targetConvId, token)
        .catch(() => undefined),
    ])
      .then(([msgs, detail]) => {
        if (
          !active ||
          selectedConvIdRef.current !== targetConvId ||
          messageFetchRequestIdRef.current !== fetchReqId
        ) {
          return;
        }
        historyWatermarkRef.current = {
          id: targetConvId,
          messageId: Math.max(0, ...msgs.map((m) => m.tinNhanId)),
        };
        setHasOlderMessages(msgs.length >= 50);
        if (detail?.soTinChuaDoc !== undefined) {
          setConversations((previous) =>
            previous.map((c) =>
              c.cuocTroChuyenId === targetConvId
                ? { ...c, soTinChuaDoc: detail.soTinChuaDoc }
                : c,
            ),
          );
        }

        // Chống ghi đè tin nhắn realtime đã nhận trong lúc fetch đang in-flight (F-NEW-03)
        setMessages((prev) => reconcileAdminMessages(prev, msgs));
      })
      .catch((err: unknown) => {
        if (active && selectedConvIdRef.current === targetConvId) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Không thể tải tin nhắn cuộc trò chuyện.',
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
    if (!selectedConvId || !token || loadingOlderMessages || !hasOlderMessages)
      return;
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
          const currentIds = new Set(
            prev.map((m) => m.tinNhanId).filter((id) => id > 0),
          );
          const newOlder = older
            .filter((m) => !currentIds.has(m.tinNhanId))
            .map((m) => ({ ...m, deliveryStatus: 'DA_GUI' as const }));
          return [...newOlder, ...prev];
        });
      }
    } catch (err: unknown) {
      if (selectedConvIdRef.current === targetConvId) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Không thể tải thêm tin nhắn cũ.',
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
    const historyRequest = messageFetchRequestIdRef.current;
    const current = () =>
      adminReconnectRequestIdRef.current === reqId &&
      selectedConvIdRef.current === targetConvId &&
      messageFetchRequestIdRef.current === historyRequest &&
      tokenRef.current === token;
    const watermark =
      historyWatermarkRef.current?.id === targetConvId
        ? historyWatermarkRef.current.messageId
        : 0;
    try {
      const updatedConv = await adminSupportChatApi.getConversationById(
        targetConvId,
        token,
      );
      if (
        adminReconnectRequestIdRef.current !== reqId ||
        selectedConvIdRef.current !== targetConvId
      )
        return;
      setSelectedConv((prev) =>
        prev?.cuocTroChuyenId === targetConvId
          ? { ...prev, ...updatedConv }
          : prev,
      );

      const freshMsgs = await adminSupportChatApi.getMessages(
        targetConvId,
        token,
        { pageSize: 50 },
      );
      if (!current()) return;
      let pageMessages = freshMsgs;
      let oldest = Math.min(
        ...pageMessages.filter((m) => m.tinNhanId > 0).map((m) => m.tinNhanId),
      );
      // Realtime delivery may be ahead of the last complete history snapshot.
      // Bridge to that snapshot, not the newest event we happened to receive.
      while (watermark > 0 && pageMessages.length >= 50 && oldest > watermark) {
        const older = await adminSupportChatApi.getMessages(
          targetConvId,
          token,
          { pageSize: 50, beforeId: oldest },
        );
        if (!current()) return;
        const nextOldest = Math.min(
          ...older.filter((m) => m.tinNhanId > 0).map((m) => m.tinNhanId),
        );
        if (older.length && nextOldest >= oldest)
          throw new Error('History cursor did not advance.');
        freshMsgs.push(...older);
        pageMessages = older;
        oldest = nextOldest;
      }
      if (
        adminReconnectRequestIdRef.current !== reqId ||
        selectedConvIdRef.current !== targetConvId
      )
        return;

      setMessages((prev) => {
        if (!current()) return prev;
        return reconcileAdminMessages(prev, freshMsgs);
      });
      historyWatermarkRef.current = {
        id: targetConvId,
        messageId: Math.max(watermark, ...freshMsgs.map((m) => m.tinNhanId)),
      };
      if (watermark === 0) setHasOlderMessages(pageMessages.length >= 50);
    } catch (err) {
      if (current()) {
        console.warn('[AdminChat] Reconnect sync error:', err);
        setErrorMessage('Chưa đồng bộ đủ tin nhắn. Vui lòng thử kết nối lại.');
      }
    }
  }, [selectedConvId, token]);

  // Callback khi có tin nhắn mới từ WebSocket
  const handleNewMessage = useCallback((newMsg: AdminSupportMessage) => {
    if (
      !conversationsRef.current.some(
        (conversation) =>
          conversation.cuocTroChuyenId === newMsg.cuocTroChuyenId,
      )
    ) {
      setRefreshTrigger((value) => value + 1);
    }
    const isCurrentlyOpen =
      selectedConvIdRef.current === newMsg.cuocTroChuyenId;

    // 1. Cập nhật tin nhắn trong khung chat hiện tại nếu trùng cuocTroChuyenId
    if (isCurrentlyOpen) {
      const msgWithStatus: AdminSupportMessage = {
        ...newMsg,
        deliveryStatus: 'DA_GUI',
      };

      setMessages((prev) => {
        if (
          prev.some(
            (m) => m.tinNhanId === msgWithStatus.tinNhanId && m.tinNhanId > 0,
          )
        )
          return prev;
        if (
          msgWithStatus.clientMessageId &&
          prev.some((m) => m.clientMessageId === msgWithStatus.clientMessageId)
        ) {
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
          const updatedUnread =
            newMsg.loaiNguoiGui === 'KHACH_HANG' &&
            newMsg.trangThai !== 'DA_DOC'
              ? (c.soTinChuaDoc || 0) + 1
              : c.soTinChuaDoc;
          return {
            ...c,
            tinNhanCuoi: newMsg,
            soTinChuaDoc: updatedUnread,
            updatedAt: newMsg.createdAt,
          };
        }
        return c;
      }),
    );
  }, []);

  // Callback khi có nhân viên tiếp nhận
  const handleConversationClaimed = useCallback(
    (claimedConv: AdminSupportConversation) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.cuocTroChuyenId === claimedConv.cuocTroChuyenId
            ? { ...c, ...claimedConv }
            : c,
        ),
      );
      setSelectedConv((prev) =>
        prev?.cuocTroChuyenId === claimedConv.cuocTroChuyenId
          ? { ...prev, ...claimedConv }
          : prev,
      );
    },
    [],
  );

  // Callback khi cuộc trò chuyện kết thúc
  const handleConversationClosed = useCallback(
    (closedConv: AdminSupportConversation) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.cuocTroChuyenId === closedConv.cuocTroChuyenId
            ? { ...c, trangThai: 'DA_DONG' }
            : c,
        ),
      );
      setSelectedConv((prev) =>
        prev?.cuocTroChuyenId === closedConv.cuocTroChuyenId
          ? { ...prev, trangThai: 'DA_DONG' }
          : prev,
      );
    },
    [],
  );

  // Callback khi nhận read receipt từ socket
  const handleMessagesReadReceipt = useCallback(
    (payload: {
      cuocTroChuyenId: number;
      readByTaiKhoanId: number;
      tinNhanIds?: number[];
      updatedCount: number;
    }) => {
      if (payload.readByTaiKhoanId === session.accountId) return;
      if (
        selectedConvIdRef.current &&
        payload.cuocTroChuyenId === selectedConvIdRef.current
      ) {
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
    [session.accountId],
  );

  // Hook WebSocket kết nối namespace /chat
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
    onNewConversation: () => setRefreshTrigger((value) => value + 1),
    onNewMessage: handleNewMessage,
    onConversationClaimed: handleConversationClaimed,
    onConversationClosed: handleConversationClosed,
    onMessagesReadReceipt: handleMessagesReadReceipt,
    onReconnected: handleReconnected,
  });

  // Tiếp nhận cuộc trò chuyện (Claim)
  const handleClaim = async () => {
    if (!selectedConv || !token || actionLoading) return;
    setActionLoading(true);
    setErrorMessage(null);

    try {
      let claimed = false;
      if (socketConnected) {
        const socketRes = await claimSocketConversation(
          selectedConv.cuocTroChuyenId,
        );
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
        err instanceof Error
          ? err.message
          : 'Không thể tiếp nhận cuộc trò chuyện.',
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
        err instanceof Error
          ? err.message
          : 'Không thể kết thúc cuộc trò chuyện.',
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
        err instanceof Error
          ? err.message
          : 'Gửi tin nhắn thất bại. Vui lòng bấm Thử lại.',
      );
    } finally {
      // Luôn luôn giải phóng sending để input không bao giờ bị khóa vô hạn (F-03)
      setSending(false);
    }
  };

  // Thử lại tin nhắn đã gửi thất bại (F-04)
  const handleRetryMessage = async (failedMsg: AdminSupportMessage) => {
    if (!selectedConv || !token || sending) return;

    const clientMsgId =
      failedMsg.clientMessageId || `staff-retry-${failedMsg.tinNhanId}`;
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
    <div className="flex h-[calc(100vh-175px)] min-h-[600px] bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* ============================================================== */}
      {/* CỘT TRÁI: DANH SÁCH CUỘC TRÒ CHUYỆN (MASTER PANE - F-05 RESPONSIVE) */}
      {/* Trên mobile: ẩn khi đang chọn cuộc trò chuyện (selectedConv !== null) */}
      {/* ============================================================== */}
      <div
        className={`${
          selectedConv ? 'hidden md:flex' : 'flex'
        } w-full md:w-[380px] lg:w-[420px] xl:w-[450px] border-r border-slate-200 flex-col bg-slate-50/70 shrink-0`}
      >
        {/* Header danh sách & Tab lọc */}
        <div className="p-3.5 md:p-4 border-b border-slate-200 bg-white space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--admin-blue)]" /> Hộp
                thư hỗ trợ
              </h2>
              {totalItems > 0 && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {totalItems}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoadingConversations(true);
                  setRefreshTrigger((k) => k + 1);
                }}
                title="Làm mới danh sách"
                aria-label="Làm mới danh sách"
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingConversations ? 'animate-spin text-[var(--admin-blue)]' : ''}`}
                />
              </button>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-semibold border flex items-center gap-1.5 ${
                  socketConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title={socketConnected ? 'Hệ thống realtime đang hoạt động bình thường' : 'Chưa kết nối realtime'}
              >
                {socketConnected ? '● Trực tuyến' : '○ Ngoại tuyến'}
              </span>
            </div>
          </div>

          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm khách hàng, số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-8 py-2 border border-slate-200 rounded-xl bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--admin-blue)] focus:border-[var(--admin-blue)] transition-all placeholder:text-slate-400 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'CHO_TIEP_NHAN', label: 'Chờ nhận' },
                { key: 'DANG_XU_LY', label: 'Đang chat' },
                { key: 'DA_DONG', label: 'Đã đóng' },
              ] as const
            ).map((tab) => {
              const tabCount =
                tab.key === 'CHO_TIEP_NHAN'
                  ? conversations.filter((c) => c.trangThai === 'CHO_TIEP_NHAN').length
                  : tab.key === 'DANG_XU_LY'
                    ? conversations.filter((c) => c.trangThai === 'DANG_XU_LY').length
                    : tab.key === 'DA_DONG'
                      ? conversations.filter((c) => c.trangThai === 'DA_DONG').length
                      : 0;

              return (
                <button
                  key={tab.key}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-white text-[var(--admin-blue)] shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tabCount > 0 && (
                    <span
                      aria-hidden="true"
                      className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeTab === tab.key
                          ? 'bg-blue-100 text-[var(--admin-blue)]'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tabCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Danh sách các cuộc trò chuyện */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2.5 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--admin-blue)]" />
              <span className="font-medium">Đang tải danh sách cuộc trò chuyện...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="font-medium">Không có cuộc trò chuyện nào phù hợp.</p>
            </div>
          ) : (
            <>
              {conversations.map((c) => {
                const isSelected =
                  selectedConv?.cuocTroChuyenId === c.cuocTroChuyenId;
                const isWaiting = c.trangThai === 'CHO_TIEP_NHAN';
                const hasUnread =
                  c.soTinChuaDoc !== undefined && c.soTinChuaDoc > 0;

                return (
                  <button
                    key={c.cuocTroChuyenId}
                    onClick={() => {
                      adminReconnectRequestIdRef.current++;
                      setSelectedConv(c);
                    }}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors border-l-4 cursor-pointer relative ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-[var(--admin-blue)] shadow-2xs'
                        : hasUnread
                          ? 'bg-blue-50/30 hover:bg-slate-100/80 border-l-blue-400'
                          : 'hover:bg-slate-100/70 border-l-transparent'
                    }`}
                  >
                    <div className="relative shrink-0 mt-0.5">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${
                          isSelected
                            ? 'bg-[var(--admin-blue)] text-white shadow-xs'
                            : hasUnread
                              ? 'bg-blue-100 text-[var(--admin-blue)] font-bold'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c.khachHang.taiKhoan.hoTen.charAt(0).toUpperCase()}
                      </div>
                      {isWaiting ? (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse"
                          title="Chờ tiếp nhận"
                        />
                      ) : c.trangThai === 'DANG_XU_LY' ? (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"
                          title="Đang xử lý"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Row 1: Tên khách hàng & Thời gian & Badge unread */}
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs truncate ${
                            hasUnread
                              ? 'font-bold text-slate-900'
                              : 'font-semibold text-slate-800'
                          }`}
                        >
                          {c.khachHang.taiKhoan.hoTen}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasUnread && (
                            <span
                              data-testid="unread-badge"
                              className="bg-[var(--admin-blue)] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full shadow-2xs"
                            >
                              {c.soTinChuaDoc}
                            </span>
                          )}
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(c.updatedAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Số điện thoại + Mã cuộc trò chuyện */}
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-mono flex items-center gap-1 text-slate-500">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          {c.khachHang.taiKhoan.soDienThoai}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          #{c.maCuocTroChuyen}
                        </span>
                      </div>

                      {/* Row 3: Tin nhắn xem trước (2 dòng line-clamp-2) */}
                      <div
                        className={`text-xs leading-relaxed mb-2 line-clamp-2 ${
                          hasUnread
                            ? 'font-medium text-slate-900'
                            : 'text-slate-600'
                        }`}
                      >
                        {c.tinNhanCuoi
                          ? c.tinNhanCuoi.noiDung
                          : 'Cuộc trò chuyện mới'}
                      </div>

                      {/* Row 4: Trạng thái nghiệp vụ */}
                      <div className="flex items-center gap-1.5">
                        {c.trangThai === 'CHO_TIEP_NHAN' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" /> Chờ tiếp nhận
                          </span>
                        )}
                        {c.trangThai === 'DANG_XU_LY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đang xử lý
                          </span>
                        )}
                        {c.trangThai === 'DA_DONG' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                            <Archive className="w-3 h-3 text-slate-500" /> Đã đóng
                          </span>
                        )}
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
                    className="w-full py-2.5 px-3 text-xs font-semibold text-[var(--admin-blue)] hover:bg-[var(--admin-blue)]/5 rounded-xl border border-[var(--admin-blue)]/20 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang
                        tải thêm...
                      </>
                    ) : (
                      <>
                        Tải thêm cuộc trò chuyện ({conversations.length}/
                        {totalItems})
                      </>
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center bg-gradient-to-b from-slate-50/40 to-white overflow-y-auto">
            <div className="max-w-md w-full flex flex-col items-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50/80 rounded-3xl border border-blue-100 flex items-center justify-center text-[var(--admin-blue)] shadow-xs mb-4">
                <MessageSquare className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              <h3 className="font-bold text-base md:text-lg text-slate-900">
                Chọn cuộc trò chuyện
              </h3>
              <p className="text-xs md:text-sm text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                Chọn một khách hàng từ danh sách bên trái để xem nội dung và trả
                lời hỗ trợ.
              </p>

              {/* Quick Metrics Cards */}
              <div className="grid grid-cols-3 gap-3 w-full mt-6">
                <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-center shadow-2xs">
                  <div className="text-lg font-bold text-amber-600 font-mono">
                    {conversations.filter((c) => c.trangThai === 'CHO_TIEP_NHAN').length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Chờ nhận</div>
                </div>
                <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-center shadow-2xs">
                  <div className="text-lg font-bold text-emerald-600 font-mono">
                    {conversations.filter((c) => c.trangThai === 'DANG_XU_LY').length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Đang chat</div>
                </div>
                <div className="p-3 bg-white border border-slate-200/80 rounded-xl text-center shadow-2xs">
                  <div className="text-lg font-bold text-slate-700 font-mono">
                    {conversations.filter((c) => c.trangThai === 'DA_DONG').length}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 mt-0.5">Đã đóng</div>
                </div>
              </div>

              {/* Quick action button */}
              {conversations.some((c) => c.trangThai === 'CHO_TIEP_NHAN') && (
                <div className="mt-6 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const firstWaiting = conversations.find((c) => c.trangThai === 'CHO_TIEP_NHAN');
                      if (firstWaiting) {
                        adminReconnectRequestIdRef.current++;
                        setSelectedConv(firstWaiting);
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-[var(--admin-blue)] hover:bg-[var(--admin-blue-hover)] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Tiếp nhận hội thoại chờ gần nhất</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        ) : (
          <>
            {/* Topbar cuộc trò chuyện */}
            <div className="p-3.5 md:p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5 md:gap-3.5 min-w-0">
                {/* Nút quay lại danh sách trên mobile (F-05) */}
                <button
                  type="button"
                  onClick={() => setSelectedConv(null)}
                  className="md:hidden p-2 text-slate-600 hover:text-[var(--admin-blue)] hover:bg-slate-100 rounded-lg shrink-0 cursor-pointer"
                  title="Quay lại danh sách"
                  aria-label="Quay lại danh sách"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-full bg-blue-100 text-[var(--admin-blue)] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  {selectedConv.khachHang.taiKhoan.hoTen
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 truncate">
                      {selectedConv.khachHang.taiKhoan.hoTen}
                    </h3>
                    <a
                      href={`tel:${selectedConv.khachHang.taiKhoan.soDienThoai}`}
                      className="text-xs text-slate-600 hover:text-[var(--admin-blue)] flex items-center gap-1 font-mono transition-colors"
                      title="Gọi điện cho khách hàng"
                    >
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      {selectedConv.khachHang.taiKhoan.soDienThoai}
                    </a>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 truncate">
                    <span className="font-mono">Mã: {selectedConv.maCuocTroChuyen}</span>
                    <span>•</span>
                    <span className="truncate">
                      Người xử lý:{' '}
                      <strong className="text-slate-700 font-semibold">
                        {selectedConv.nhanVien?.taiKhoan.hoTen ||
                          'Chưa tiếp nhận'}
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
                    className="px-3.5 py-2 bg-[var(--admin-blue)] text-white rounded-xl text-xs font-semibold hover:bg-[var(--admin-blue-hover)] transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
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
                    className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kết thúc</span>
                  </button>
                )}
              </div>
            </div>

            {errorMessage && (
              <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Khung tin nhắn */}
            <div
              ref={transcriptRef}
              data-testid="admin-chat-transcript"
              className="flex-1 overflow-y-auto p-4 md:p-5 bg-slate-50/50 space-y-3.5"
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-16 text-slate-500 gap-2.5 text-xs font-medium">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--admin-blue)]" />
                  <span>Đang tải lịch sử tin nhắn...</span>
                </div>
              ) : (
                <>
                  {hasOlderMessages && (
                    <div className="text-center py-1">
                      <button
                        type="button"
                        onClick={handleLoadOlderMessages}
                        disabled={loadingOlderMessages}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-full text-xs font-medium shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {loadingOlderMessages ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--admin-blue)]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>
                          {loadingOlderMessages
                            ? 'Đang tải tin cũ...'
                            : 'Tải tin nhắn cũ hơn'}
                        </span>
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
                        <div key={msg.tinNhanId} className="text-center my-2.5">
                          <span className="inline-block text-xs text-slate-600 bg-slate-200/70 border border-slate-200/80 px-3.5 py-1 rounded-full font-medium">
                            {msg.noiDung}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.tinNhanId}
                        className={`flex gap-2.5 md:gap-3 ${isStaff ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold shadow-2xs ${
                            isStaff
                              ? 'bg-[var(--admin-blue)] text-white'
                              : 'bg-white border border-slate-200 text-slate-700'
                          }`}
                        >
                          {isStaff ? 'NV' : <User className="w-4 h-4 text-slate-500" />}
                        </div>

                        <div
                          className={`flex flex-col gap-1 max-w-[75%] ${
                            isStaff ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">
                              {isStaff
                                ? msg.taiKhoanGui?.hoTen || 'Nhân viên'
                                : 'Khách hàng'}{' '}
                              •{' '}
                              <span className="font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  'vi-VN',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )}
                              </span>
                            </span>
                            {isPendingMsg && (
                              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3 animate-spin text-[var(--admin-blue)]" />{' '}
                                Đang gửi
                              </span>
                            )}
                          </div>
                          <div
                            data-chat-message-id={msg.tinNhanId}
                            ref={(element) => {
                              if (element)
                                messageElementsRef.current.set(
                                  msg.tinNhanId,
                                  element,
                                );
                              else
                                messageElementsRef.current.delete(
                                  msg.tinNhanId,
                                );
                            }}
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs break-words transition-opacity ${
                              isStaff
                                ? isFailedMsg
                                  ? 'bg-rose-50 border border-rose-300 text-rose-800 rounded-tr-none'
                                  : isPendingMsg
                                    ? 'bg-[var(--admin-blue)]/80 text-white rounded-tr-none'
                                    : 'bg-[var(--admin-blue)] text-white rounded-tr-none'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                            }`}
                          >
                            {msg.noiDung}
                          </div>
                          {isStaff && !isPendingMsg && !isFailedMsg && (
                            <span className="text-xs text-slate-500 font-medium">
                              {msg.trangThai === 'DA_DOC' ? 'Đã đọc' : 'Đã gửi'}
                            </span>
                          )}
                          {isFailedMsg && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-rose-600 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Gửi thất bại</span>
                              <button
                                type="button"
                                onClick={() => handleRetryMessage(msg)}
                                disabled={sending}
                                className="font-semibold underline hover:text-rose-700 flex items-center gap-1 ml-1 cursor-pointer"
                              >
                                <RotateCw className="w-3 h-3" /> Thử lại
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {customerTyping && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 italic p-1 bg-white/60 rounded-lg inline-flex">
                      <User className="w-3.5 h-3.5 animate-pulse text-[var(--admin-blue)]" />
                      <span>Khách hàng đang nhập...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Ô nhập tin nhắn */}
            <div className="p-3.5 md:p-4 bg-white border-t border-slate-200 shrink-0">
              {isClosed ? (
                <div className="p-3 bg-slate-100 text-slate-600 text-xs rounded-xl text-center font-medium border border-slate-200">
                  Cuộc trò chuyện này đã kết thúc. Không thể gửi thêm tin nhắn.
                </div>
              ) : isPending ? (
                <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 text-xs rounded-xl text-center flex items-center justify-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Vui lòng bấm &quot;Tiếp nhận hỗ trợ&quot; ở trên để bắt đầu phản hồi cho khách hàng.
                  </span>
                </div>
              ) : (
                <div className="flex gap-2.5 items-center">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Nhập nội dung phản hồi khách hàng..."
                    disabled={sending}
                    className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--admin-blue)] focus:border-[var(--admin-blue)] text-xs text-slate-800 transition-colors"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sending}
                    className="px-5 h-11 rounded-xl bg-[var(--admin-blue)] text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--admin-blue-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs shrink-0 cursor-pointer"
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
