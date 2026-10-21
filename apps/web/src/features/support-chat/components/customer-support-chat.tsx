'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
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
  Check,
  CheckCheck,
} from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { supportChatApi } from '../services/support-chat.api';
import { useSupportChatSocket } from '../hooks/use-support-chat-socket';
import { BusCompany, SupportConversation, SupportMessage } from '../types';

/**
 * Reconciles server snapshot/fresh messages with existing messages in state.
 * - Replaces optimistic messages (negative IDs or THAT_BAI/DANG_GUI) when server has confirmed them by clientMessageId.
 * - Updates confirmed messages with latest server data (e.g. read status DA_DOC).
 * - Preserves optimistic messages that are still pending/failed and not in server snapshot.
 * - Preserves realtime messages already in state that arrived after the server snapshot.
 * - Deduplicates by tinNhanId and clientMessageId, and sorts chronologically.
 */
export function reconcileMessages(
  prevMessages: SupportMessage[],
  serverMessages: SupportMessage[],
): SupportMessage[] {
  const formattedServerMsgs = serverMessages.map((m) => ({
    ...m,
    deliveryStatus: 'DA_GUI' as const,
  }));

  const serverByClientId = new Map<string, SupportMessage>();
  const serverById = new Map<number, SupportMessage>();

  for (const sm of formattedServerMsgs) {
    if (sm.clientMessageId) {
      serverByClientId.set(sm.clientMessageId, sm);
    }
    if (sm.tinNhanId > 0) {
      serverById.set(sm.tinNhanId, sm);
    }
  }

  const result: SupportMessage[] = [];
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

export function CustomerSupportChat() {
  const { user } = useAuthSession();
  // A different account must never inherit a mounted conversation or its callbacks.
  return <CustomerSupportChatSession key={user?.accountId ?? 'guest'} />;
}

function CustomerSupportChatSession() {
  const { isAuthenticated, accessToken, user, executeWithAuth } =
    useAuthSession();
  const chatApi = useMemo(
    () => ({
      getActiveBusCompanies: supportChatApi.getActiveBusCompanies,
      getActiveConversation: (
        ...args: Parameters<typeof supportChatApi.getActiveConversation>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.getActiveConversation(args[0], token),
        ),
      getConversationById: (
        ...args: Parameters<typeof supportChatApi.getConversationById>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.getConversationById(args[0], token),
        ),
      listConversations: (
        ...args: Parameters<typeof supportChatApi.listConversations>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.listConversations(args[0], token),
        ),
      getMessages: (...args: Parameters<typeof supportChatApi.getMessages>) =>
        executeWithAuth((token) =>
          supportChatApi.getMessages(args[0], token, args[2]),
        ),
      createConversation: (
        ...args: Parameters<typeof supportChatApi.createConversation>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.createConversation(args[0], token),
        ),
      sendMessage: (...args: Parameters<typeof supportChatApi.sendMessage>) =>
        executeWithAuth((token) =>
          supportChatApi.sendMessage(args[0], args[1], token, args[3]),
        ),
      closeConversation: (
        ...args: Parameters<typeof supportChatApi.closeConversation>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.closeConversation(args[0], token, args[2]),
        ),
      markMessagesAsRead: (
        ...args: Parameters<typeof supportChatApi.markMessagesAsRead>
      ) =>
        executeWithAuth((token) =>
          supportChatApi.markMessagesAsRead(args[0], token, args[2]),
        ),
    }),
    [executeWithAuth],
  );
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const onVisibilityChange = () =>
      setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const [busCompanies, setBusCompanies] = useState<BusCompany[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<BusCompany | null>(
    null,
  );
  const [searchCompany, setSearchCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  const [activeConversation, setActiveConversation] =
    useState<SupportConversation | null>(null);
  const [pastConversations, setPastConversations] = useState<
    SupportConversation[]
  >([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [showHistoryList, setShowHistoryList] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const [startingChat, setStartingChat] = useState(false);

  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const companyRequestIdRef = useRef(0);
  const historyRequestIdRef = useRef(0);
  const reconnectRequestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const invalidateRequests = useCallback(() => {
    companyRequestIdRef.current++;
    historyRequestIdRef.current++;
    reconnectRequestIdRef.current++;
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateRequests();
    };
  }, [invalidateRequests]);
  const isPrependingOlderRef = useRef(false);

  const activeConversationId = activeConversation?.cuocTroChuyenId ?? null;
  const activeConversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

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

  // Tải danh sách nhà xe thật khi ở màn hình chọn nhà xe
  useEffect(() => {
    if (!isAuthenticated || activeConversation) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setLoadingCompanies(true);
    });
    chatApi
      .getActiveBusCompanies(searchCompany)
      .then((data) => {
        if (active) setBusCompanies(data || []);
      })
      .catch((err: unknown) => {
        if (active) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách nhà xe.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCompanies(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, activeConversation, searchCompany, chatApi]);

  // Callback nhận tin nhắn mới từ WebSocket
  const handleNewMessage = useCallback((newMsg: SupportMessage) => {
    if (newMsg.cuocTroChuyenId !== activeConversationIdRef.current) return;
    setMessages((prev) => {
      if (prev.some((m) => m.tinNhanId === newMsg.tinNhanId && m.tinNhanId > 0))
        return prev;
      if (
        newMsg.clientMessageId &&
        prev.some((m) => m.clientMessageId === newMsg.clientMessageId)
      ) {
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
  const handleConversationClaimed = useCallback(
    (updatedConv: SupportConversation) => {
      setActiveConversation((prev) =>
        prev?.cuocTroChuyenId === updatedConv.cuocTroChuyenId
          ? { ...prev, ...updatedConv }
          : prev,
      );
    },
    [],
  );

  // Callback khi cuộc trò chuyện kết thúc
  const handleConversationClosed = useCallback(
    (closedConv: SupportConversation) => {
      setActiveConversation((prev) =>
        prev?.cuocTroChuyenId === closedConv.cuocTroChuyenId
          ? { ...prev, ...closedConv, trangThai: 'DA_DONG' }
          : prev,
      );
    },
    [],
  );

  // Callback khi tin nhắn của khách hàng được nhân viên đọc (read receipt)
  const handleMessagesReadReceipt = useCallback(
    (payload: {
      cuocTroChuyenId: number;
      readByTaiKhoanId: number;
      tinNhanIds?: number[];
      updatedCount: number;
    }) => {
      if (payload.readByTaiKhoanId === user?.accountId) return;
      if (
        activeConversationIdRef.current &&
        payload.cuocTroChuyenId === activeConversationIdRef.current
      ) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.loaiNguoiGui === 'KHACH_HANG') {
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
    [user?.accountId],
  );

  // Đồng bộ lại khi Socket reconnect (F-NEW-01, F-NEW-02, F-NEW-04)
  const handleReconnected = useCallback(async () => {
    if (!activeConversationId || !accessToken) return;
    const targetConvId = activeConversationId;
    const reqId = ++reconnectRequestIdRef.current;
    try {
      const updatedConv = await chatApi.getConversationById(
        targetConvId,
        accessToken,
      );
      if (
        reconnectRequestIdRef.current !== reqId ||
        activeConversationIdRef.current !== targetConvId
      )
        return;
      setActiveConversation((prev) =>
        prev?.cuocTroChuyenId === targetConvId
          ? { ...prev, ...updatedConv }
          : prev,
      );

      const freshMsgs = await chatApi.getMessages(targetConvId, accessToken, {
        pageSize: 40,
      });
      if (
        reconnectRequestIdRef.current !== reqId ||
        activeConversationIdRef.current !== targetConvId
      )
        return;

      setMessages((prev) => {
        if (activeConversationIdRef.current !== targetConvId) return prev;
        return reconcileMessages(prev, freshMsgs);
      });
    } catch (err) {
      console.warn('[CustomerSupportChat] Reconnect sync error:', err);
    }
  }, [activeConversationId, accessToken, chatApi]);

  // Socket connection hook
  const recoverSocketAuthentication = useCallback(() => {
    // A protected REST read uses the existing single-flight token refresh.
    // Publishing the rotated token recreates the Socket.IO connection.
    void chatApi
      .listConversations({ page: 1, pageSize: 1 }, accessToken ?? '')
      .catch(() => {});
  }, [chatApi, accessToken]);
  const {
    isConnected: socketConnected,
    isTyping: staffTyping,
    sendMessage: sendSocketMessage,
    emitTyping,
    closeConversation: closeSocketConversation,
  } = useSupportChatSocket({
    token: accessToken,
    activeConversationId,
    onNewMessage: handleNewMessage,
    onConversationClaimed: handleConversationClaimed,
    onConversationClosed: handleConversationClosed,
    onMessagesReadReceipt: handleMessagesReadReceipt,
    onReconnected: handleReconnected,
    onAuthenticationError: recoverSocketAuthentication,
  });

  // Read only messages actually loaded in this thread. An empty/omitted ID list
  // means "all" to the API and could mark off-screen history as read.
  useEffect(() => {
    if (
      !isAuthenticated ||
      !accessToken ||
      !activeConversationId ||
      loadingMessages ||
      !documentVisible ||
      showHistoryList
    )
      return;
    const ids = messages
      .filter(
        (message) =>
          message.cuocTroChuyenId === activeConversationId &&
          message.loaiNguoiGui === 'NHAN_VIEN' &&
          message.trangThai === 'DA_GUI' &&
          message.tinNhanId > 0,
      )
      .map((message) => message.tinNhanId);
    if (ids.length === 0 || document.visibilityState === 'hidden') return;

    let current = true;
    const targetId = activeConversationId;
    chatApi
      .markMessagesAsRead(targetId, accessToken, ids)
      .then(() => {
        if (!current || activeConversationIdRef.current !== targetId) return;
        setMessages((previous) =>
          previous.map((message) =>
            message.cuocTroChuyenId === targetId &&
            ids.includes(message.tinNhanId)
              ? { ...message, trangThai: 'DA_DOC' }
              : message,
          ),
        );
      })
      .catch((error: unknown) => {
        if (current)
          console.warn('[CustomerSupportChat] Mark read failed:', error);
      });
    return () => {
      current = false;
    };
  }, [
    isAuthenticated,
    accessToken,
    activeConversationId,
    loadingMessages,
    documentVisible,
    showHistoryList,
    messages,
    chatApi,
  ]);

  // Chọn nhà xe: chống race condition out-of-order & hỗ trợ xem lịch sử chat đã đóng (F-01, F-NEW-03)
  const handleSelectCompany = async (company: BusCompany) => {
    if (!accessToken) return;
    if (!Number.isInteger(company.busCompanyId) || company.busCompanyId <= 0) {
      setErrorMsg('Thông tin nhà xe không hợp lệ.');
      return;
    }

    const currentReqId = ++companyRequestIdRef.current;
    reconnectRequestIdRef.current++;
    setSending(false);
    setStartingChat(false);
    setSelectedCompany(company);
    setShowHistoryList(false);
    setErrorMsg(null);
    setLoadingMessages(true);
    setActiveConversation(null);
    setMessages([]);
    setPastConversations([]);
    setHistoryPage(1);
    setHistoryTotalPages(1);

    try {
      const [active, convsRes] = await Promise.all([
        chatApi.getActiveConversation(company.busCompanyId, accessToken),
        chatApi.listConversations(
          {
            nhaXeId: company.busCompanyId,
            trangThai: 'DA_DONG',
            page: 1,
            pageSize: 20,
          },
          accessToken,
        ),
      ]);

      // Guard: Nếu có request sau đã được gọi, bỏ qua response cũ để ngăn race condition (F-01)
      if (currentReqId !== companyRequestIdRef.current) {
        return;
      }

      const closedList = convsRes?.data || [];
      setPastConversations(closedList);
      if (convsRes?.meta?.totalPages) {
        setHistoryTotalPages(convsRes.meta.totalPages);
      }

      if (active) {
        setActiveConversation(active);
        const history = await chatApi.getMessages(
          active.cuocTroChuyenId,
          accessToken,
          { pageSize: 40 },
        );
        if (currentReqId === companyRequestIdRef.current) {
          setHasOlderMessages(history.length >= 40);
          setMessages((previous) =>
            reconcileMessages(
              previous.filter(
                (message) => message.cuocTroChuyenId === active.cuocTroChuyenId,
              ),
              history,
            ),
          );
        }
      } else if (closedList.length > 0) {
        // Nếu không có phiên đang mở nhưng có phiên cũ đã đóng, hiển thị phiên gần nhất cho khách đọc
        const latestClosed = closedList[0];
        setActiveConversation(latestClosed);
        const history = await chatApi.getMessages(
          latestClosed.cuocTroChuyenId,
          accessToken,
          { pageSize: 40 },
        );
        if (currentReqId === companyRequestIdRef.current) {
          setHasOlderMessages(history.length >= 40);
          setMessages((previous) =>
            reconcileMessages(
              previous.filter(
                (message) =>
                  message.cuocTroChuyenId === latestClosed.cuocTroChuyenId,
              ),
              history,
            ),
          );
        }
      } else {
        // Chưa có cuộc trò chuyện nào, giữ activeConversation null để hiện form bắt đầu mới
        setActiveConversation(null);
        setMessages([]);
        setHasOlderMessages(false);
      }
    } catch (err: unknown) {
      if (currentReqId === companyRequestIdRef.current) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Không thể kiểm tra cuộc trò chuyện.',
        );
      }
    } finally {
      if (currentReqId === companyRequestIdRef.current) {
        setLoadingMessages(false);
      }
    }
  };

  // Tải thêm lịch sử cuộc trò chuyện đã đóng (F-NEW-03)
  const handleLoadMoreHistory = async () => {
    if (
      !selectedCompany ||
      !accessToken ||
      loadingMoreHistory ||
      historyPage >= historyTotalPages
    )
      return;
    const nextPage = historyPage + 1;
    setLoadingMoreHistory(true);
    try {
      const res = await chatApi.listConversations(
        {
          nhaXeId: selectedCompany.busCompanyId,
          trangThai: 'DA_DONG',
          page: nextPage,
          pageSize: 20,
        },
        accessToken,
      );
      const newItems = res.data || [];
      setPastConversations((prev) => {
        const existingIds = new Set(prev.map((c) => c.cuocTroChuyenId));
        return [
          ...prev,
          ...newItems.filter((c) => !existingIds.has(c.cuocTroChuyenId)),
        ];
      });
      setHistoryPage(nextPage);
      if (res.meta?.totalPages) setHistoryTotalPages(res.meta.totalPages);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể tải thêm lịch sử cuộc trò chuyện.',
      );
    } finally {
      setLoadingMoreHistory(false);
    }
  };

  // Tải tin nhắn cũ hơn (F-NEW-04)
  const handleLoadOlderMessages = async () => {
    if (
      !activeConversationId ||
      !accessToken ||
      loadingOlderMessages ||
      !hasOlderMessages
    )
      return;
    const targetConvId = activeConversationId;
    const positiveIds = messages.map((m) => m.tinNhanId).filter((id) => id > 0);
    if (positiveIds.length === 0) return;
    const oldestId = Math.min(...positiveIds);

    setLoadingOlderMessages(true);
    try {
      const older = await chatApi.getMessages(targetConvId, accessToken, {
        beforeId: oldestId,
        pageSize: 40,
      });
      if (activeConversationIdRef.current !== targetConvId) return;

      if (older.length < 40) {
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
      if (activeConversationIdRef.current === targetConvId) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Không thể tải thêm tin nhắn cũ.',
        );
      }
    } finally {
      if (activeConversationIdRef.current === targetConvId) {
        setLoadingOlderMessages(false);
      }
    }
  };

  // Xem một cuộc trò chuyện cụ thể trong lịch sử (có stale guard chống out-of-order - F-NEW-03)
  const handleSelectHistoryConversation = async (conv: SupportConversation) => {
    if (!accessToken) return;
    const reqId = ++historyRequestIdRef.current;
    const companyReqId = companyRequestIdRef.current;
    reconnectRequestIdRef.current++;
    setSending(false);
    setActiveConversation(conv);
    setShowHistoryList(false);
    setLoadingMessages(true);
    try {
      const history = await chatApi.getMessages(
        conv.cuocTroChuyenId,
        accessToken,
        { pageSize: 40 },
      );
      if (
        historyRequestIdRef.current !== reqId ||
        companyRequestIdRef.current !== companyReqId
      )
        return;
      setHasOlderMessages(history.length >= 40);
      setMessages((previous) =>
        reconcileMessages(
          previous.filter(
            (message) => message.cuocTroChuyenId === conv.cuocTroChuyenId,
          ),
          history,
        ),
      );
    } catch (err: unknown) {
      if (historyRequestIdRef.current === reqId) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Không thể tải tin nhắn cuộc trò chuyện này.',
        );
      }
    } finally {
      if (historyRequestIdRef.current === reqId) {
        setLoadingMessages(false);
      }
    }
  };

  // Bắt đầu cuộc trò chuyện mới
  const handleStartConversation = async () => {
    if (!selectedCompany || !accessToken || !initialMessage.trim()) return;
    if (
      !Number.isInteger(selectedCompany.busCompanyId) ||
      selectedCompany.busCompanyId <= 0
    ) {
      setErrorMsg('Thông tin nhà xe không hợp lệ.');
      return;
    }

    const requestId = companyRequestIdRef.current;
    const stillCurrent = () =>
      mountedRef.current && requestId === companyRequestIdRef.current;
    setStartingChat(true);
    setErrorMsg(null);
    reconnectRequestIdRef.current++;

    const clientMsgId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    try {
      const conv = await chatApi.createConversation(
        {
          nhaXeId: selectedCompany.busCompanyId,
          tieuDe: `Hỗ trợ khách hàng - ${selectedCompany.name}`,
          tinNhanDauTien: initialMessage.trim(),
          clientMessageId: clientMsgId,
        },
        accessToken,
      );

      if (!stillCurrent()) return;
      setActiveConversation(conv);
      const history = await chatApi.getMessages(
        conv.cuocTroChuyenId,
        accessToken,
      );
      if (!stillCurrent()) return;
      setHasOlderMessages(history.length >= 40);
      setMessages(history.map((m) => ({ ...m, deliveryStatus: 'DA_GUI' })));
      setInitialMessage('');
    } catch (err: unknown) {
      if (!stillCurrent()) return;
      setErrorMsg(
        err instanceof Error ? err.message : 'Không thể tạo cuộc trò chuyện.',
      );
    } finally {
      if (stillCurrent()) setStartingChat(false);
    }
  };

  // Gửi tin nhắn trong cuộc trò chuyện (F-03 timeout resilience & F-04 delivery states)
  const handleSendMessage = async () => {
    if (!activeConversation || !inputValue.trim() || !accessToken || sending)
      return;

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

    const targetId = activeConversation.cuocTroChuyenId;
    const currentView = () =>
      mountedRef.current && activeConversationIdRef.current === targetId;
    try {
      let sentSuccess = false;
      // 1. Ưu tiên gửi qua WebSocket (có timeout 5000ms - F-03)
      if (socketConnected) {
        const socketRes = await sendSocketMessage(
          activeConversation.cuocTroChuyenId,
          content,
          clientMsgId,
        );
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      // 2. Fallback REST nếu socket không gửi được / timeout (BẮT BUỘC dùng lại cùng clientMsgId để backend deduplicate)
      if (!sentSuccess) {
        if (!currentView()) return;
        const restMsg = await chatApi.sendMessage(
          activeConversation.cuocTroChuyenId,
          content,
          accessToken,
          clientMsgId,
        );
        handleNewMessage({ ...restMsg, deliveryStatus: 'DA_GUI' });
      }
    } catch (err: unknown) {
      if (!currentView()) return;
      // Đánh dấu tin nhắn thất bại để người dùng có thể bấm Thử lại (F-04)
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, deliveryStatus: 'THAT_BAI' }
            : m,
        ),
      );
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gửi tin nhắn thất bại. Vui lòng bấm Thử lại.',
      );
    } finally {
      // Luôn luôn giải phóng sending để input không bị khóa vô hạn (F-03)
      if (currentView()) setSending(false);
    }
  };

  // Thử lại tin nhắn đã gửi thất bại (F-04)
  const handleRetryMessage = async (failedMsg: SupportMessage) => {
    if (!activeConversation || !accessToken || sending) return;

    const clientMsgId =
      failedMsg.clientMessageId || `client-retry-${failedMsg.tinNhanId}`;
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

    const targetId = activeConversation.cuocTroChuyenId;
    const currentView = () =>
      mountedRef.current && activeConversationIdRef.current === targetId;
    try {
      let sentSuccess = false;
      if (socketConnected) {
        const socketRes = await sendSocketMessage(
          activeConversation.cuocTroChuyenId,
          content,
          clientMsgId,
        );
        if (socketRes.success && socketRes.data) {
          sentSuccess = true;
          handleNewMessage({ ...socketRes.data, deliveryStatus: 'DA_GUI' });
        }
      }

      if (!sentSuccess) {
        if (!currentView()) return;
        const restMsg = await chatApi.sendMessage(
          activeConversation.cuocTroChuyenId,
          content,
          accessToken,
          clientMsgId,
        );
        handleNewMessage({ ...restMsg, deliveryStatus: 'DA_GUI' });
      }
    } catch (err: unknown) {
      if (!currentView()) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, deliveryStatus: 'THAT_BAI' }
            : m,
        ),
      );
      setErrorMsg(
        err instanceof Error ? err.message : 'Gửi lại tin nhắn thất bại.',
      );
    } finally {
      if (currentView()) setSending(false);
    }
  };

  // Đóng cuộc trò chuyện
  const handleCloseChat = async () => {
    if (!activeConversation || !accessToken) return;
    if (!confirm('Bạn có chắc chắn muốn kết thúc cuộc trò chuyện này không?'))
      return;

    const targetId = activeConversation.cuocTroChuyenId;
    const currentView = () =>
      mountedRef.current && activeConversationIdRef.current === targetId;
    try {
      await closeSocketConversation(
        activeConversation.cuocTroChuyenId,
        'Khách hàng kết thúc hỗ trợ',
      );
      if (!currentView()) return;
      const updated = await chatApi.closeConversation(
        activeConversation.cuocTroChuyenId,
        accessToken,
        'Khách hàng kết thúc hỗ trợ',
      );
      handleConversationClosed(updated);
    } catch (err: unknown) {
      if (!currentView()) return;
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể kết thúc cuộc trò chuyện.',
      );
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
          <h4 className="font-semibold text-slate-800 text-sm">
            Yêu cầu đăng nhập
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Vui lòng đăng nhập tài khoản Khách hàng để kết nối trực tiếp với
            nhân viên hỗ trợ của nhà xe.
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
                  <span className="truncate">
                    {c.tieuDe || c.maCuocTroChuyen}
                  </span>
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
                    <span className="truncate">
                      CSKH: {c.nhanVien.taiKhoan.hoTen}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
          {historyPage < historyTotalPages && (
            <div className="pt-2 text-center">
              <button
                onClick={handleLoadMoreHistory}
                disabled={loadingMoreHistory}
                className="text-xs text-brand hover:underline font-medium py-1.5 px-3 rounded-lg border border-brand/20 bg-brand/5 hover:bg-brand/10 transition-colors disabled:opacity-50"
              >
                {loadingMoreHistory ? (
                  <span className="flex items-center gap-1 justify-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải
                    thêm...
                  </span>
                ) : (
                  'Tải thêm lịch sử'
                )}
              </button>
            </div>
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
          <span className="text-xs font-semibold text-slate-700">
            Chọn nhà xe cần hỗ trợ
          </span>
          {selectedCompany && (
            <div className="flex items-center gap-2">
              {pastConversations.length > 0 && (
                <button
                  onClick={() => setShowHistoryList(true)}
                  className="text-xs text-slate-600 hover:text-brand flex items-center gap-1"
                >
                  <History className="w-3.5 h-3.5" /> Lịch sử (
                  {pastConversations.length})
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh
                  sách nhà xe...
                </div>
              ) : busCompanies.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Không tìm thấy nhà xe nào.
                </div>
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
                          {c.contactInfo
                            ? `Liên hệ: ${c.contactInfo}`
                            : 'Chưa cập nhật thông tin liên hệ'}
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
                  <h5 className="font-bold text-xs text-slate-800 truncate">
                    {selectedCompany.name}
                  </h5>
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
  const staffName =
    activeConversation.nhanVien?.taiKhoan.hoTen || 'Nhân viên CSKH';

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
                <span className="text-slate-500 font-medium">
                  Cuộc trò chuyện đã kết thúc
                </span>
              ) : activeConversation.nhanVien ? (
                <span className="text-emerald-600 font-medium">
                  {staffName}
                </span>
              ) : (
                <span className="text-amber-600 font-medium">
                  Đang chờ nhân viên tiếp nhận
                </span>
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
            {hasOlderMessages && (
              <div className="text-center py-1">
                <button
                  onClick={handleLoadOlderMessages}
                  disabled={loadingOlderMessages}
                  className="text-[11px] text-brand hover:underline font-medium py-1 px-3 rounded-full border border-brand/20 bg-white hover:bg-brand/5 shadow-xs transition-colors disabled:opacity-50"
                >
                  {loadingOlderMessages ? (
                    <span className="flex items-center gap-1 justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" /> Đang tải tin
                      nhắn cũ...
                    </span>
                  ) : (
                    'Tải tin nhắn cũ hơn'
                  )}
                </button>
              </div>
            )}
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
                <div
                  key={msg.tinNhanId}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      isMe
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-brand/10 text-brand'
                    }`}
                  >
                    {isMe ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Headphones className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div
                    className={`flex flex-col gap-0.5 max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">
                        {isMe ? 'Bạn' : msg.taiKhoanGui?.hoTen || staffName}
                      </span>
                      {isPending && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 animate-spin" /> Đang
                          gửi
                        </span>
                      )}
                      {!isPending && !isFailed && isMe && (
                        <span
                          className="text-[9px] flex items-center gap-0.5"
                          data-testid="message-delivery-status"
                          title={
                            msg.trangThai === 'DA_DOC' ? 'Đã xem' : 'Đã gửi'
                          }
                        >
                          {msg.trangThai === 'DA_DOC' ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-sky-500" />
                              <span className="text-sky-600 font-medium">
                                Đã xem
                              </span>
                            </>
                          ) : (
                            <>
                              <Check className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-slate-400">Đã gửi</span>
                            </>
                          )}
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
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-0.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
