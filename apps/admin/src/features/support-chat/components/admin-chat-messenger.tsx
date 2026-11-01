'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  User,
  Phone,
  Send,
  Loader2,
  AlertCircle,
  Clock,
  XCircle,
  RefreshCw,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/status-badge';
import {
  ResourceConfirmation,
  ResourceNotice,
  ResourceState,
  ResourceStatusBadge,
} from '@/components/admin/resource-ui';
import {
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/resource-filters';
import styles from './admin-chat-messenger.module.css';
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
  const [storedMessages, setMessages] = useState<AdminSupportMessage[]>([]);
  // Scope every render/read/cursor to the selected conversation, including the
  // render before its history request completes or fails.
  const messages = storedMessages.filter(
    (message) => message.cuocTroChuyenId === selectedConv?.cuocTroChuyenId,
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
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
        setMessages((prev) =>
          reconcileAdminMessages(
            prev.filter((message) => message.cuocTroChuyenId === targetConvId),
            msgs.filter((message) => message.cuocTroChuyenId === targetConvId),
          ),
        );
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
  }, [selectedConvId, token, setHasOlderMessages, setErrorMessage]);

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
      toast.success('Đã tiếp nhận cuộc trò chuyện.');
    } catch (err: unknown) {
      toast.error(
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
      setCloseOpen(false);
      toast.success('Đã kết thúc cuộc trò chuyện.');
    } catch (err: unknown) {
      toast.error(
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
      toast.error(
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
      toast.error(
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
    <>
      {errorMessage && (
        <ResourceNotice kind="error">{errorMessage}</ResourceNotice>
      )}
      <div className={styles.workspace}>
        <aside
          aria-label="Hộp thư hỗ trợ"
          className={`${styles.inbox} ${selectedConv ? 'hidden md:flex' : 'flex'}`}
        >
          <div className="shrink-0 space-y-4 border-b bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MessageSquare aria-hidden className="size-4 text-primary" />
                Hộp thư <Badge variant="secondary">{totalItems}</Badge>
              </h2>
              <Button
                variant="ghost"
                size="icon"
                disabled={loadingConversations}
                aria-label="Làm mới danh sách"
                onClick={() => {
                  setLoadingConversations(true);
                  setRefreshTrigger((k) => k + 1);
                }}
              >
                <RefreshCw
                  aria-hidden
                  className={
                    loadingConversations
                      ? 'motion-safe:animate-spin'
                      : undefined
                  }
                />
              </Button>
            </div>
            <SearchInput
              label="Tìm cuộc trò chuyện"
              placeholder="Tên khách hàng, số điện thoại…"
              value={searchQuery}
              onChange={setSearchQuery}
            />
            <SelectFilter
              label="Trạng thái hội thoại"
              allLabel="Tất cả hội thoại"
              value={activeTab === 'ALL' ? '' : activeTab}
              options={[
                { value: 'CHO_TIEP_NHAN', label: 'Chờ tiếp nhận' },
                { value: 'DANG_XU_LY', label: 'Đang xử lý' },
                { value: 'DA_DONG', label: 'Đã đóng' },
              ]}
              onChange={(value) => setActiveTab((value || 'ALL') as FilterTab)}
            />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            aria-busy={loadingConversations}
          >
            {loadingConversations ? (
              <ResourceState loading>Đang tải cuộc trò chuyện…</ResourceState>
            ) : conversations.length === 0 ? (
              <ResourceState>Không có cuộc trò chuyện phù hợp.</ResourceState>
            ) : (
              <ul className="space-y-2 p-3">
                {conversations.map((c) => {
                  const selected =
                    selectedConv?.cuocTroChuyenId === c.cuocTroChuyenId;
                  const unread =
                    c.soTinChuaDoc !== undefined && c.soTinChuaDoc > 0;
                  return (
                    <li key={c.cuocTroChuyenId}>
                      <Button
                        variant="ghost"
                        aria-pressed={selected}
                        className={`h-auto sm:h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg border p-3 text-left font-normal ${selected ? 'border-primary bg-accent' : unread ? 'border-primary/30 bg-accent/40' : 'border-transparent'}`}
                        onClick={() => {
                          adminReconnectRequestIdRef.current++;
                          setSelectedConv(c);
                        }}
                      >
                        <span
                          aria-hidden
                          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary"
                        >
                          {c.khachHang.taiKhoan.hoTen.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 space-y-2">
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={`truncate text-[13px] ${unread ? 'font-bold' : 'font-semibold'}`}
                            >
                              {c.khachHang.taiKhoan.hoTen}
                            </span>
                            {unread && (
                              <Badge
                                data-testid="unread-badge"
                                aria-label={`${c.soTinChuaDoc} tin chưa đọc`}
                              >
                                {c.soTinChuaDoc}
                              </Badge>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {c.khachHang.taiKhoan.soDienThoai}
                          </span>
                          <span className="line-clamp-2 text-[13px] text-muted-foreground">
                            {c.tinNhanCuoi?.noiDung || 'Cuộc trò chuyện mới'}
                          </span>
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <ResourceStatusBadge
                              tone={
                                c.trangThai === 'CHO_TIEP_NHAN'
                                  ? 'warning'
                                  : c.trangThai === 'DANG_XU_LY'
                                    ? 'active'
                                    : 'muted'
                              }
                            >
                              {c.trangThai === 'CHO_TIEP_NHAN'
                                ? 'Chờ tiếp nhận'
                                : c.trangThai === 'DANG_XU_LY'
                                  ? 'Đang xử lý'
                                  : 'Đã đóng'}
                            </ResourceStatusBadge>
                            <time
                              className="text-xs text-muted-foreground"
                              dateTime={c.updatedAt}
                            >
                              {new Date(c.updatedAt).toLocaleTimeString(
                                'vi-VN',
                                { hour: '2-digit', minute: '2-digit' },
                              )}
                            </time>
                          </span>
                          <span className="admin-data-mono block truncate text-xs text-muted-foreground">
                            {c.maCuocTroChuyen}
                          </span>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!loadingConversations && page < totalPages && (
              <div className="p-4">
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                >
                  {loadingMore && (
                    <Loader2 aria-hidden className="motion-safe:animate-spin" />
                  )}
                  {loadingMore ? 'Đang tải…' : 'Tải thêm hội thoại'}
                </Button>
              </div>
            )}
          </div>
        </aside>
        <section
          aria-label="Nội dung hội thoại"
          className={`${styles.detail} ${selectedConv ? 'flex' : 'hidden md:flex'}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 text-xs text-muted-foreground">
            <span>Hỗ trợ khách hàng</span>
            <ResourceStatusBadge tone={socketConnected ? 'active' : 'muted'}>
              {socketConnected
                ? 'Đã kết nối realtime'
                : 'Chưa kết nối realtime'}
            </ResourceStatusBadge>
          </div>
          {!selectedConv ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <div className="max-w-sm space-y-4 text-center">
                <MessageSquare
                  aria-hidden
                  className="mx-auto size-10 text-primary/60"
                />
                <h2 className="text-lg font-semibold">Chọn cuộc trò chuyện</h2>
                <p className="text-sm text-muted-foreground">
                  Chọn khách hàng trong hộp thư để xem nội dung và phản hồi hỗ
                  trợ.
                </p>
              </div>
            </div>
          ) : (
            <>
              <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b p-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Button
                    className="md:hidden"
                    size="icon"
                    variant="ghost"
                    aria-label="Quay lại danh sách"
                    onClick={() => setSelectedConv(null)}
                  >
                    <ArrowLeft aria-hidden />
                  </Button>
                  <div className="min-w-0 space-y-1">
                    <h2 className="break-words text-base font-semibold">
                      {selectedConv.khachHang.taiKhoan.hoTen}
                    </h2>
                    <a
                      className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-primary"
                      href={`tel:${selectedConv.khachHang.taiKhoan.soDienThoai}`}
                    >
                      <Phone aria-hidden className="size-3" />
                      {selectedConv.khachHang.taiKhoan.soDienThoai}
                    </a>
                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={
                        selectedConv.nhanVien?.taiKhoan.hoTen ||
                        'Chưa tiếp nhận'
                      }
                    >
                      Người xử lý:{' '}
                      {selectedConv.nhanVien?.taiKhoan.hoTen ||
                        'Chưa tiếp nhận'}
                    </p>
                    <p className="admin-data-mono hidden break-all text-xs text-muted-foreground sm:block">
                      {selectedConv.maCuocTroChuyen}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isPending && canManageChat && (
                    <Button disabled={actionLoading} onClick={handleClaim}>
                      {actionLoading && (
                        <Loader2
                          aria-hidden
                          className="motion-safe:animate-spin"
                        />
                      )}
                      Tiếp nhận hỗ trợ
                    </Button>
                  )}
                  {!isClosed && canManageChat && (
                    <Button
                      disabled={actionLoading}
                      variant="outline"
                      aria-label="Kết thúc"
                      className="w-11 px-0 sm:w-auto sm:px-4"
                      onClick={() => setCloseOpen(true)}
                    >
                      <XCircle aria-hidden />
                      <span className="hidden sm:inline">Kết thúc</span>
                    </Button>
                  )}
                </div>
              </header>
              <div
                ref={transcriptRef}
                data-testid="admin-chat-transcript"
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-muted/30 p-4 sm:p-5"
                aria-label="Lịch sử tin nhắn"
                aria-busy={loadingMessages}
              >
                {loadingMessages ? (
                  <ResourceState loading>
                    Đang tải lịch sử tin nhắn…
                  </ResourceState>
                ) : (
                  <>
                    {hasOlderMessages && (
                      <div className="text-center">
                        <Button
                          variant="outline"
                          disabled={loadingOlderMessages}
                          onClick={handleLoadOlderMessages}
                        >
                          {loadingOlderMessages && (
                            <Loader2
                              aria-hidden
                              className="motion-safe:animate-spin"
                            />
                          )}
                          {loadingOlderMessages
                            ? 'Đang tải…'
                            : 'Tải tin nhắn cũ hơn'}
                        </Button>
                      </div>
                    )}
                    {messages.map((msg) => {
                      const staff = msg.loaiNguoiGui === 'NHAN_VIEN';
                      const pending = msg.deliveryStatus === 'DANG_GUI';
                      const failed = msg.deliveryStatus === 'THAT_BAI';
                      if (msg.loaiNguoiGui === 'HE_THONG')
                        return (
                          <p
                            key={msg.tinNhanId}
                            className="mx-auto w-fit max-w-full rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground"
                          >
                            {msg.noiDung}
                          </p>
                        );
                      return (
                        <div
                          key={msg.tinNhanId}
                          className={`flex gap-2 ${staff ? 'flex-row-reverse' : ''}`}
                        >
                          <span
                            aria-hidden
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
                          >
                            {staff ? 'NV' : <User className="size-4" />}
                          </span>
                          <div
                            className={`flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[75%] ${staff ? 'items-end' : 'items-start'}`}
                          >
                            <p className="text-xs text-muted-foreground">
                              {staff
                                ? msg.taiKhoanGui?.hoTen || 'Nhân viên'
                                : 'Khách hàng'}{' '}
                              ·{' '}
                              <time dateTime={msg.createdAt}>
                                {new Date(msg.createdAt).toLocaleTimeString(
                                  'vi-VN',
                                  { hour: '2-digit', minute: '2-digit' },
                                )}
                              </time>
                            </p>
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
                              className={`max-w-full whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm leading-normal ${staff ? (failed ? 'border-destructive/40 bg-destructive/10 text-destructive' : 'border-primary bg-primary text-primary-foreground') : 'border-border bg-card'} ${pending ? 'opacity-70' : ''}`}
                            >
                              {msg.noiDung}
                            </div>
                            {pending ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock aria-hidden className="size-3" />
                                Đang gửi
                              </span>
                            ) : failed ? (
                              <div className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                                <AlertCircle aria-hidden className="size-3" />
                                Gửi thất bại
                                <Button
                                  size="sm"
                                  variant="link"
                                  disabled={sending}
                                  onClick={() => handleRetryMessage(msg)}
                                >
                                  <RotateCw aria-hidden />
                                  Thử lại
                                </Button>
                              </div>
                            ) : staff ? (
                              <span className="text-xs text-muted-foreground">
                                {msg.trangThai === 'DA_DOC'
                                  ? 'Đã đọc'
                                  : 'Đã gửi'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {customerTyping && (
                      <p
                        role="status"
                        className="text-xs italic text-muted-foreground"
                      >
                        Khách hàng đang nhập…
                      </p>
                    )}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              <div className="shrink-0 border-t bg-card p-4">
                {!canManageChat ? (
                  <ResourceNotice kind="info">
                    Bạn đang xem hội thoại với quyền chỉ đọc.
                  </ResourceNotice>
                ) : isClosed ? (
                  <ResourceNotice kind="info">
                    Cuộc trò chuyện đã kết thúc. Không thể gửi thêm tin nhắn.
                  </ResourceNotice>
                ) : isPending ? (
                  <ResourceNotice kind="info">
                    Tiếp nhận hỗ trợ để bắt đầu phản hồi khách hàng.
                  </ResourceNotice>
                ) : (
                  <div className="space-y-2">
                    <label
                      htmlFor="support-chat-reply"
                      className="block text-[13px] font-semibold"
                    >
                      Nội dung phản hồi
                    </label>
                    <div className="flex items-end gap-2">
                      <Input
                        id="support-chat-reply"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(event) =>
                          event.key === 'Enter' &&
                          !event.nativeEvent.isComposing &&
                          handleSendMessage()
                        }
                        placeholder="Nhập tin nhắn…"
                        disabled={sending}
                        className="min-w-0 flex-1"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || sending}
                        aria-label="Gửi tin nhắn"
                      >
                        {sending ? (
                          <Loader2
                            aria-hidden
                            className="motion-safe:animate-spin"
                          />
                        ) : (
                          <Send aria-hidden />
                        )}
                        <span className="hidden sm:inline">Gửi</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
      {closeOpen && selectedConv && (
        <ResourceConfirmation
          title="Kết thúc cuộc trò chuyện?"
          description={`Kết thúc hỗ trợ ${selectedConv.khachHang.taiKhoan.hoTen}. Lịch sử tin nhắn vẫn được giữ lại.`}
          busy={actionLoading}
          onClose={() => setCloseOpen(false)}
        >
          <Button
            variant="destructive"
            disabled={actionLoading}
            onClick={handleClose}
          >
            {actionLoading && (
              <Loader2 aria-hidden className="motion-safe:animate-spin" />
            )}
            Kết thúc hội thoại
          </Button>
        </ResourceConfirmation>
      )}
    </>
  );
}
