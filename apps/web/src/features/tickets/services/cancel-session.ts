import type { TicketItem } from '@/features/account/services/tickets.api';

const CANCEL_SESSION_KEY = 'vexgo_cancel_ticket_session';

export interface CancelSessionData {
  ticketCode: string;
  phoneNumber: string;
  ticket?: TicketItem;
  createdAt: number;
}

export function saveCancelSession(data: {
  ticketCode: string;
  phoneNumber: string;
  ticket?: TicketItem;
}): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      CANCEL_SESSION_KEY,
      JSON.stringify({
        ...data,
        createdAt: Date.now(),
      }),
    );
  } catch {
    // Ignore storage errors (quota, disabled, etc.)
  }
}

export function getCancelSession(
  maxAgeMs = 15 * 60 * 1000,
): CancelSessionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CANCEL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CancelSessionData;
    if (Date.now() - parsed.createdAt > maxAgeMs) {
      sessionStorage.removeItem(CANCEL_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCancelSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CANCEL_SESSION_KEY);
  } catch {
    // Ignore storage errors
  }
}
