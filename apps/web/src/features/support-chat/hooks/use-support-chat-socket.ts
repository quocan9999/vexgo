'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { SupportMessage, SupportConversation } from '../types';

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseSupportChatSocketProps {
  token: string | null;
  activeConversationId: number | null;
  onNewMessage?: (message: SupportMessage) => void;
  onConversationClaimed?: (conversation: SupportConversation) => void;
  onConversationClosed?: (conversation: SupportConversation) => void;
}

export function useSupportChatSocket({
  token,
  activeConversationId,
  onNewMessage,
  onConversationClaimed,
  onConversationClosed,
}: UseSupportChatSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(`${SOCKET_SERVER_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('support.connected', () => {
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('support.error', (err: { error: string; message: string }) => {
      setConnectionError(err.message || err.error);
    });

    socket.on('support.message.new', (message: SupportMessage) => {
      if (onNewMessage) {
        onNewMessage(message);
      }
    });

    socket.on('support.typing', (data: { cuocTroChuyenId: number; isTyping: boolean }) => {
      if (activeConversationId && data.cuocTroChuyenId === activeConversationId) {
        setIsTyping(data.isTyping);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
          }, 3000);
        }
      }
    });

    socket.on('support.conversation.claimed', (conv: SupportConversation) => {
      if (onConversationClaimed) {
        onConversationClaimed(conv);
      }
    });

    socket.on('support.conversation.closed', (conv: SupportConversation) => {
      if (onConversationClosed) {
        onConversationClosed(conv);
      }
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activeConversationId, onNewMessage, onConversationClaimed, onConversationClosed]);

  // Join room conversation khi activeConversationId thay đổi
  useEffect(() => {
    if (!socketRef.current || !isConnected || !activeConversationId) return;

    socketRef.current.emit(
      'support.conversation.join',
      { cuocTroChuyenId: activeConversationId },
      (ack: { success: boolean }) => {
        if (!ack?.success) {
          console.warn('[SupportChatSocket] Failed to join conversation room:', activeConversationId);
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

  const sendMessage = useCallback(
    (cuocTroChuyenId: number, noiDung: string, clientMessageId?: string) => {
      return new Promise<{ success: boolean; data?: SupportMessage; error?: string }>(
        (resolve) => {
          if (!socketRef.current || !socketRef.current.connected) {
            resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
            return;
          }

          socketRef.current.emit(
            'support.message.send',
            {
              cuocTroChuyenId,
              noiDung,
              loaiTinNhan: 'VAN_BAN',
              clientMessageId,
            },
            (response: { success: boolean; data?: SupportMessage; error?: string; message?: string }) => {
              if (response?.success && response.data) {
                resolve({ success: true, data: response.data });
              } else {
                resolve({
                  success: false,
                  error: response?.error || response?.message || 'Gửi tin nhắn thất bại.',
                });
              }
            },
          );
        },
      );
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

  const closeConversation = useCallback((cuocTroChuyenId: number, lyDo?: string) => {
    return new Promise<{ success: boolean; data?: SupportConversation; error?: string }>(
      (resolve) => {
        if (!socketRef.current || !socketRef.current.connected) {
          resolve({ success: false, error: 'SOCKET_DISCONNECTED' });
          return;
        }

        socketRef.current.emit(
          'support.conversation.close',
          { cuocTroChuyenId, lyDo },
          (response: { success: boolean; data?: SupportConversation; error?: string; message?: string }) => {
            if (response?.success && response.data) {
              resolve({ success: true, data: response.data });
            } else {
              resolve({
                success: false,
                error: response?.error || response?.message || 'Kết thúc cuộc trò chuyện thất bại.',
              });
            }
          },
        );
      },
    );
  }, []);

  return {
    isConnected,
    isTyping,
    connectionError,
    sendMessage,
    emitTyping,
    closeConversation,
  };
}
