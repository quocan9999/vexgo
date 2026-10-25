'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SupportMessage, SupportConversation } from '../types';

interface UseSupportChatSocketProps {
  token: string | null;
  activeConversationId: number | null;
  onNewMessage?: (message: SupportMessage) => void;
  onConversationClaimed?: (conversation: SupportConversation) => void;
  onConversationClosed?: (conversation: SupportConversation) => void;
  onMessagesReadReceipt?: (payload: {
    cuocTroChuyenId: number;
    readByTaiKhoanId: number;
    tinNhanIds?: number[];
    updatedCount: number;
  }) => void;
  onReconnected?: () => void;
  onAuthenticationError?: () => void;
}

export function useSupportChatSocket({
  token,
  activeConversationId,
  onNewMessage,
  onConversationClaimed,
  onConversationClosed,
  onMessagesReadReceipt,
  onReconnected,
  onAuthenticationError,
}: UseSupportChatSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const wasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onNewMessageRef = useRef(onNewMessage);
  const onConversationClaimedRef = useRef(onConversationClaimed);
  const onConversationClosedRef = useRef(onConversationClosed);
  const onMessagesReadReceiptRef = useRef(onMessagesReadReceipt);
  const onReconnectedRef = useRef(onReconnected);
  const onAuthenticationErrorRef = useRef(onAuthenticationError);
  const activeConversationIdRef = useRef(activeConversationId);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onConversationClaimedRef.current = onConversationClaimed;
    onConversationClosedRef.current = onConversationClosed;
    onMessagesReadReceiptRef.current = onMessagesReadReceipt;
    onReconnectedRef.current = onReconnected;
    onAuthenticationErrorRef.current = onAuthenticationError;
    activeConversationIdRef.current = activeConversationId;
  });

  useEffect(() => {
    if (!token) {
      wasConnectedRef.current = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // The Web REST URL includes /api/v1; Socket.IO uses the backend origin.
    const socketOrigin = new URL(
      process.env.NEXT_PUBLIC_SOCKET_URL?.trim() ||
        process.env.NEXT_PUBLIC_API_URL ||
        'http://localhost:4000/api/v1',
    ).origin;
    const socket = io(`${socketOrigin}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (socketRef.current !== socket) return;
      setConnectionError(null);
    });

    socket.on('disconnect', () => {
      if (socketRef.current !== socket) return;
      setIsConnected(false);
    });

    socket.on('support.connected', () => {
      if (socketRef.current !== socket) return;
      setIsConnected(true);
      setConnectionError(null);
      wasConnectedRef.current = true;
      onReconnectedRef.current?.();
    });

    socket.on('support.error', (err: { error: string; message: string }) => {
      if (socketRef.current !== socket) return;
      setIsConnected(false);
      setConnectionError(err.message || err.error);
      if (
        ['ACCESS_TOKEN_INVALID', 'AUTH_REQUIRED', 'SESSION_REVOKED'].includes(
          err.error,
        )
      ) {
        onAuthenticationErrorRef.current?.();
      }
    });

    socket.on('support.message.new', (message: SupportMessage) => {
      if (socketRef.current !== socket) return;
      onNewMessageRef.current?.(message);
    });

    socket.on(
      'support.typing',
      (data: { cuocTroChuyenId: number; isTyping: boolean }) => {
        if (socketRef.current !== socket) return;
        if (
          activeConversationIdRef.current &&
          data.cuocTroChuyenId === activeConversationIdRef.current
        ) {
          setIsTyping(data.isTyping);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);
            }, 3000);
          }
        }
      },
    );

    socket.on('support.conversation.claimed', (conv: SupportConversation) => {
      if (socketRef.current !== socket) return;
      onConversationClaimedRef.current?.(conv);
    });

    socket.on('support.conversation.closed', (conv: SupportConversation) => {
      if (socketRef.current !== socket) return;
      onConversationClosedRef.current?.(conv);
    });

    socket.on(
      'support.message.read_receipt',
      (payload: {
        cuocTroChuyenId: number;
        readByTaiKhoanId: number;
        tinNhanIds?: number[];
        updatedCount: number;
      }) => {
        if (socketRef.current !== socket) return;
        onMessagesReadReceiptRef.current?.(payload);
      },
    );

    return () => {
      wasConnectedRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // Join room conversation khi activeConversationId thay đổi
  useEffect(() => {
    if (!socketRef.current || !isConnected || !activeConversationId) return;

    socketRef.current.emit(
      'support.conversation.join',
      { cuocTroChuyenId: activeConversationId },
      (ack: { success: boolean }) => {
        if (!ack?.success) {
          console.warn(
            '[SupportChatSocket] Failed to join conversation room:',
            activeConversationId,
          );
        }
      },
    );

    return () => {
      if (socketRef.current && activeConversationId) {
        socketRef.current.emit('support.conversation.leave', {
          cuocTroChuyenId: activeConversationId,
        });
      }
    };
  }, [isConnected, activeConversationId]);

  const SOCKET_TIMEOUT_MS = 5000;

  const sendMessage = useCallback(
    (cuocTroChuyenId: number, noiDung: string, clientMessageId?: string) => {
      return new Promise<{
        success: boolean;
        data?: SupportMessage;
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
            data?: SupportMessage;
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

  const emitTyping = useCallback((cuocTroChuyenId: number, typing: boolean) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('support.typing', {
      cuocTroChuyenId,
      isTyping: typing,
    });
  }, []);

  const closeConversation = useCallback(
    (cuocTroChuyenId: number, lyDo?: string) => {
      return new Promise<{
        success: boolean;
        data?: SupportConversation;
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
            data?: SupportConversation;
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
    isTyping,
    connectionError,
    sendMessage,
    emitTyping,
    closeConversation,
    markMessagesAsRead,
  };
}
