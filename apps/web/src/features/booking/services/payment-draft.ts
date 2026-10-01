export type PaymentDraftLeg = {
  tripId: number | string;
  route: string;
  departureTime: string;
  seats: string[];
  pickup: string;
  dropoff: string;
  unitFare: number;
  subtotal: number;
};

export type PaymentDraft = {
  id: string;
  tripType: 'one-way' | 'round-trip';
  passenger: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  legs: PaymentDraftLeg[];
  luggage?: {
    fee: number;
    weight: number;
    info?: unknown;
  };
  totalFare: number;
};

export const PAYMENT_DRAFT_STORAGE_PREFIX = 'vexgo:payment-draft:';

export function savePaymentDraft(draft: PaymentDraft): void {
  if (typeof window === 'undefined' || !draft?.id) return;
  try {
    sessionStorage.setItem(
      `${PAYMENT_DRAFT_STORAGE_PREFIX}${draft.id}`,
      JSON.stringify(draft),
    );
  } catch (err) {
    console.error('Failed to save payment draft to sessionStorage', err);
  }
}

export function getPaymentDraft(draftId: string | null | undefined): PaymentDraft | null {
  if (typeof window === 'undefined' || !draftId) return null;
  try {
    const raw = sessionStorage.getItem(`${PAYMENT_DRAFT_STORAGE_PREFIX}${draftId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.id ||
      !parsed.tripType ||
      !parsed.passenger ||
      !Array.isArray(parsed.legs)
    ) {
      return null;
    }
    return parsed as PaymentDraft;
  } catch {
    return null;
  }
}

export function createPaymentDraft(draftData: Omit<PaymentDraft, 'id'>): PaymentDraft {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const draft: PaymentDraft = {
    ...draftData,
    id,
  };

  savePaymentDraft(draft);
  return draft;
}
