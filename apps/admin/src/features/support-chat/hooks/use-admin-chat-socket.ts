'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/lib/api-url';
import {
  getAdminAccessToken,
  refreshAdminAccessToken,
} from '@/features/admin-auth/services/admin-auth';
import { AdminSupportConversation, AdminSupportMessage } from '../types';

export interface UseAdminChatSocketProps {
  token: string | null;
  activeConversationId: number | null;
  onNewConversation?: (conversation: AdminSupportConversation) => void;
  onNewMessage?: (message: AdminSupportMessage) => void;
  onConversationClaimed?: (conversation: AdminSupportConversation) => void;
  onConversationClosed?: (conversation: AdminSupportConversation) => void;
  onMessagesReadReceipt?: (payload: {
    cuocTroChuyenId: number;
    readByTaiKhoanId: number;
    tinNhanIds?: number[];
    updatedCount: number;
  }) => void;
  onReconnected?: () => void;
}

export function useAdminChatSocket({
  token,
  activeConversationId,
  onNewConversation,
  onNewMessage,
  onConversationClaimed,
  onConversationClosed,
  onMessagesReadReceipt,
  onReconnected,
}: UseAdminChatSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [customerTyping, setCustomerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onNewConversationRef = useRef(onNewConversation);
  const onNewMessageRef = useRef(onNewMessage);
  const onConversationClaimedRef = useRef(onConversationClaimed);
  const onConversationClosedRef = useRef(onConversationClosed);
  const onMessagesReadReceiptRef = useRef(onMessagesReadReceipt);
  const onReconnectedRef = useRef(onReconnected);
  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    onNewConversationRef.current = onNewConversation;
    onNewMessageRef.current = onNewMessage;
    onConversationClaimedRef.current = onConversationClaimed;
    onConversationClosedRef.current = onConversationClosed;
    onMessagesReadReceiptRef.current = onMessagesReadReceipt;
    onReconnectedRef.current = onReconnected;
    activeConversationIdRef.current = activeConversationId;
  });

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // REST and realtime must reach the same backend unless explicitly split.
    const socketOrigin = new URL(
      process.env.NEXT_PUBLIC_SOCKET_URL?.trim() || getApiBaseUrl(),
    ).origin;
    const socket = io(`${socketOrigin}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;
    let disposed = false;
    let attemptedAuthRefresh = false;
    const isCurrentSocket = () => !disposed && socketRef.current === socket;

    socket.on('support.error', (payload: { error?: string; code?: string }) => {
      if (!isCurrentSocket() || getAdminAccessToken() !== token) return;
      const code = payload?.error ?? payload?.code;
      if (code !== 'ACCESS_TOKEN_INVALID' && code !== 'SESSION_REVOKED') return;
      setIsConnected(false);
      setCustomerTyping(false);
      socket.disconnect();
      if (attemptedAuthRefresh) return;
      attemptedAuthRefresh = true;
      // The shared auth provider publishes the trusted refreshed session/token.
      // Its rerender owns the next socket; a disposed hook must never reconnect it.
      void refreshAdminAccessToken(token).catch(() => {
        // Remain disconnected on refresh failure, without a retry loop.
      });
    });

    socket.on('support.connected', () => {
      if (!isCurrentSocket()) return;
      setIsConnected(true);
      setConnectionRevision((value) => value + 1);
      // Inbox REST may finish before the first authenticated socket connection.
      // Resync then too, including conversations created during that gap.
      onReconnectedRef.current?.();
    });

    socket.on('disconnect', () => {
      if (!isCurrentSocket()) return;
      setIsConnected(false);
    });

    socket.on('support.conversation.new', (conv: AdminSupportConversation) => {
      onNewConversationRef.current?.(conv);
    });

    socket.on('support.message.new', (msg: AdminSupportMessage) => {
      onNewMessageRef.current?.(msg);
    });

    socket.on(
      'support.typing',
      (data: { cuocTroChuyenId: number; isTyping: boolean }) => {
        if (
          activeConversationIdRef.current &&
          data.cuocTroChuyenId === activeConversationIdRef.current
        ) {
          setCustomerTyping(data.isTyping);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              setCustomerTyping(false);
            }, 3000);
          }
        }
      },
    );

    socket.on(
      'support.conversation.claimed',
      (conv: AdminSupportConversation) => {
        onConversationClaimedRef.current?.(conv);
      },
    );

    socket.on(
      'support.conversation.closed',
      (conv: AdminSupportConversation) => {
        onConversationClosedRef.current?.(conv);
      },
    );

    socket.on(
      'support.message.read_receipt',
      (payload: {
        cuocTroChuyenId: number;
        readByTaiKhoanId: number;
        tinNhanIds?: number[];
        updatedCount: number;
      }) => {
        onMessagesReadReceiptRef.current?.(payload);
      },
    );

    return () => {
      disposed = true;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Join room conversation khi activeConversationId thay đổi
  useEffect(() => {
    if (!socketRef.current || !isConnected || !activeConversationId) return;

    socketRef.current.emit('support.conversation.join', {
      cuocTroChuyenId: activeConversationId,
    });

    return () => {
      if (socketRef.current && activeConversationId) {
        socketRef.current.emit('support.conversation.leave', {
          cuocTroChuyenId: activeConversationId,
        });
      }
    };
  }, [isConnected, activeConversationId, connectionRevision]);

  const SOCKET_TIMEOUT_MS = 5000;

  const sendMessage = useCallback(
    (cuocTroChuyenId: number, noiDung: string, clientMessageId?: string) => {
      return new Promise<{
        success: boolean;
        data?: AdminSupportMessage;
        error?: string;
      }>((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            socket.off('disconnect', onDisconnect);
            resolve({ success: false, error: 'SOCKET_TIMEOUT' });
          }
        }, SOCKET_TIMEOUT_MS);

        const onDisconnect = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.off('disconnect', onDisconnect);
            resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
          }
        };
        socket.once('disconnect', onDisconnect);

        socket.emit(
          'support.message.send',
          {
            cuocTroChuyenId,
            noiDung,
            loaiTinNhan: 'VAN_BAN',
            clientMessageId,
          },
          (response: {
            success: boolean;
            data?: AdminSupportMessage;
            error?: string;
            message?: string;
          }) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.off('disconnect', onDisconnect);
              if (response?.success && response.data) {
                resolve({ success: true, data: response.data });
              } else {
                resolve({
                  success: false,
                  error:
                    response?.error ||
                    response?.message ||
                    'Gửi tin nhắn thất bại.',
                });
              }
            }
          },
        );
      });
    },
    [],
  );

  const claimConversation = useCallback((cuocTroChuyenId: number) => {
    return new Promise<{
      success: boolean;
      data?: AdminSupportConversation;
      error?: string;
    }>((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
        return;
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.off('disconnect', onDisconnect);
          resolve({ success: false, error: 'SOCKET_TIMEOUT' });
        }
      }, SOCKET_TIMEOUT_MS);

      const onDisconnect = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          socket.off('disconnect', onDisconnect);
          resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
        }
      };
      socket.once('disconnect', onDisconnect);

      socket.emit(
        'support.conversation.claim',
        { cuocTroChuyenId },
        (response: {
          success: boolean;
          data?: AdminSupportConversation;
          error?: string;
          message?: string;
        }) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.off('disconnect', onDisconnect);
            if (response?.success && response.data) {
              resolve({ success: true, data: response.data });
            } else {
              resolve({
                success: false,
                error:
                  response?.error ||
                  response?.message ||
                  'Tiếp nhận cuộc trò chuyện thất bại.',
              });
            }
          }
        },
      );
    });
  }, []);

  const closeConversation = useCallback(
    (cuocTroChuyenId: number, lyDo?: string) => {
      return new Promise<{
        success: boolean;
        data?: AdminSupportConversation;
        error?: string;
      }>((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            socket.off('disconnect', onDisconnect);
            resolve({ success: false, error: 'SOCKET_TIMEOUT' });
          }
        }, SOCKET_TIMEOUT_MS);

        const onDisconnect = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.off('disconnect', onDisconnect);
            resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
          }
        };
        socket.once('disconnect', onDisconnect);

        socket.emit(
          'support.conversation.close',
          { cuocTroChuyenId, lyDo },
          (response: {
            success: boolean;
            data?: AdminSupportConversation;
            error?: string;
            message?: string;
          }) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.off('disconnect', onDisconnect);
              if (response?.success && response.data) {
                resolve({ success: true, data: response.data });
              } else {
                resolve({
                  success: false,
                  error:
                    response?.error ||
                    response?.message ||
                    'Kết thúc cuộc trò chuyện thất bại.',
                });
              }
            }
          },
        );
      });
    },
    [],
  );

  const emitTyping = useCallback((cuocTroChuyenId: number, typing: boolean) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('support.typing', {
      cuocTroChuyenId,
      isTyping: typing,
    });
  }, []);

  const markMessagesAsRead = useCallback(
    (cuocTroChuyenId: number, tinNhanIds?: number[]) => {
      if (!socketRef.current || !socketRef.current.connected) return;
      socketRef.current.emit('support.message.read', {
        cuocTroChuyenId,
        tinNhanIds,
      });
    },
    [],
  );

  return {
    isConnected,
    customerTyping,
    sendMessage,
    claimConversation,
    closeConversation,
    emitTyping,
    markMessagesAsRead,
  };
}
