/**
 * Socket.IO event names for Customer Support Chat.
 * Follows rule-api.md 31.2: Namespaced event names.
 */
export const CHAT_EVENTS = {
  // Connection & Handshake
  SUPPORT_CONNECTED: 'support.connected',
  SUPPORT_ERROR: 'support.error',

  // Room Subscription
  CONVERSATION_JOIN: 'support.conversation.join',
  CONVERSATION_LEAVE: 'support.conversation.leave',

  // Messaging
  MESSAGE_SEND: 'support.message.send',
  MESSAGE_NEW: 'support.message.new',
  MESSAGE_READ: 'support.message.read',
  MESSAGES_READ_RECEIPT: 'support.message.read_receipt',

  // Presence & Typing
  TYPING_STATUS: 'support.typing',

  // Conversation Lifecycle
  CONVERSATION_CLAIM: 'support.conversation.claim',
  CONVERSATION_CLAIMED: 'support.conversation.claimed',
  CONVERSATION_CLOSE: 'support.conversation.close',
  CONVERSATION_CLOSED: 'support.conversation.closed',
} as const;

export type ChatEventType = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];
