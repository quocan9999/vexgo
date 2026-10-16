'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AdminSupportConversation, AdminSupportMessage } from '../types';

const SOCKET_SERVER_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface UseAdminChatSocketProps {
  token: string | null;
  activeConversationId: number | null;
  onNewConversation?: (conversation: AdminSupportConversation) => void;
  onNewMessage?: (message: AdminSupportMessage) => void;
  onConversationClaimed?: (conversation: AdminSupportConversation) => void;
  onConversationClosed?: (conversation: AdminSupportConversation) => void;
  onReconnected?: () => void;
}

export function useAdminChatSocket({
  token,
  activeConversationId,
  onNewConversation,
  onNewMessage,
  onConversationClaimed,
  onConversationClosed,
  onReconnected,
}: UseAdminChatSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const wasConnectedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);
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
      if (wasConnectedRef.current) {
        onReconnected?.();
      }
      wasConnectedRef.current = true;
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.io.on('reconnect', () => {
      setIsConnected(true);
      onReconnected?.();
    });

    socket.on('support.conversation.new', (conv: AdminSupportConversation) => {
      if (onNewConversation) {
        onNewConversation(conv);
      }
    });

    socket.on('support.message.new', (msg: AdminSupportMessage) => {
      if (onNewMessage) {
        onNewMessage(msg);
      }
    });

    socket.on('support.typing', (data: { cuocTroChuyenId: number; isTyping: boolean }) => {
      if (activeConversationId && data.cuocTroChuyenId === activeConversationId) {
        setCustomerTyping(data.isTyping);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setCustomerTyping(false);
          }, 3000);
        }
      }
    });

    socket.on('support.conversation.claimed', (conv: AdminSupportConversation) => {
      if (onConversationClaimed) {
        onConversationClaimed(conv);
      }
    });

    socket.on('support.conversation.closed', (conv: AdminSupportConversation) => {
      if (onConversationClosed) {
        onConversationClosed(conv);
      }
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, activeConversationId, onNewConversation, onNewMessage, onConversationClaimed, onConversationClosed, onReconnected]);

  // Join room conversation khi activeConversationId thay đổi
  useEffect(() => {
    if (!socketRef.current || !isConnected || !activeConversationId) return;

    socketRef.current.emit(
      'support.conversation.join',
      { cuocTroChuyenId: activeConversationId },
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
      return new Promise<{ success: boolean; data?: AdminSupportMessage; error?: string }>(
        (resolve) => {
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
            (response: { success: boolean; data?: AdminSupportMessage; error?: string; message?: string }) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                socket.off('disconnect', onDisconnect);
                if (response?.success && response.data) {
                  resolve({ success: true, data: response.data });
                } else {
                  resolve({
                    success: false,
                    error: response?.error || response?.message || 'Gửi tin nhắn thất bại.',
                  });
                }
              }
            },
          );
        },
      );
    },
    [],
  );

  const claimConversation = useCallback((cuocTroChuyenId: number) => {
    return new Promise<{ success: boolean; data?: AdminSupportConversation; error?: string }>(
      (resolve) => {
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
          (response: { success: boolean; data?: AdminSupportConversation; error?: string; message?: string }) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.off('disconnect', onDisconnect);
              if (response?.success && response.data) {
                resolve({ success: true, data: response.data });
              } else {
                resolve({
                  success: false,
                  error: response?.error || response?.message || 'Tiếp nhận cuộc trò chuyện thất bại.',
                });
              }
            }
          },
        );
      },
    );
  }, []);

  const closeConversation = useCallback((cuocTroChuyenId: number, lyDo?: string) => {
    return new Promise<{ success: boolean; data?: AdminSupportConversation; error?: string }>(
      (resolve) => {
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
          (response: { success: boolean; data?: AdminSupportConversation; error?: string; message?: string }) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              socket.off('disconnect', onDisconnect);
              if (response?.success && response.data) {
                resolve({ success: true, data: response.data });
              } else {
                resolve({
                  success: false,
                  error: response?.error || response?.message || 'Kết thúc cuộc trò chuyện thất bại.',
                });
              }
            }
          },
        );
      },
    );
  }, []);

  const emitTyping = useCallback((cuocTroChuyenId: number, typing: boolean) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('support.typing', {
      cuocTroChuyenId,
      isTyping: typing,
    });
  }, []);

  return {
    isConnected,
    customerTyping,
    sendMessage,
    claimConversation,
    closeConversation,
    emitTyping,
  };
}
