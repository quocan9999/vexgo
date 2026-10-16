export type PaymentDraftLeg = {
  tripId: number | string;
  route: string;
  departureTime: string;
  seats: string[];
  pickup: string;
  dropoff: string;
  unitFare: number;
  subtotal: number;
  busCompanyName?: string;
  vehicleType?: string;
};

type PaymentDraftBase = {
  id: string;
  totalFare: number;
  orderId?: number;
  orderCode?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt?: string;
  paymentExpiresAt?: string;
};

export type BookingPaymentDraft = PaymentDraftBase & {
  kind?: 'booking';
  tripType: 'one-way' | 'round-trip';
  legs: PaymentDraftLeg[];
  passenger: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
  luggage?: {
    fee: number;
    weight: number;
    items?: Array<{
      id?: string;
      type?: string;
      quantity?: number;
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
      category?: string;
      note?: string;
      motorbikeType?: string;
      licensePlate?: string;
      bicycleType?: string;
    }>;
    info?: unknown;
  };
  bookingId?: number;
  bookingCode?: string;
};

export type ShipmentPaymentDraft = PaymentDraftBase & {
  kind: 'shipment';
  shipmentId: number;
  paymentId: number;
  waybillCode: string;
  orderCode: string;
  sender: {
    fullName: string;
    phoneNumber: string;
    email?: string | null;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
  };
  route: {
    origin: string;
    destination: string;
    departureTime: string;
  };
  pickupPoint: {
    name: string;
    address: string;
  };
  dropoffPoint: {
    name: string;
    address: string;
  };
};

export type PaymentDraft = BookingPaymentDraft | ShipmentPaymentDraft;
type NewPaymentDraft =
  | Omit<BookingPaymentDraft, 'id'>
  | Omit<ShipmentPaymentDraft, 'id'>;

export const PAYMENT_DRAFT_STORAGE_PREFIX = 'vexgo:payment-draft:';

function isValidString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isValidNonNegativeNumber(val: unknown): val is number {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val) && val >= 0;
}

function isValidPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val > 0;
}

function isValidShipmentContact(
  value: unknown,
  emailRequired: boolean,
): value is { fullName: string; phoneNumber: string; email?: string | null } {
  if (!value || typeof value !== 'object') return false;
  const contact = value as Record<string, unknown>;
  return isValidString(contact.fullName) &&
    isValidString(contact.phoneNumber) &&
    (!emailRequired || isValidString(contact.email)) &&
    (contact.email === undefined || contact.email === null || typeof contact.email === 'string');
}

function isValidShipmentPoint(value: unknown): value is { name: string; address: string } {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return isValidString(point.name) && isValidString(point.address);
}

function isValidLeg(leg: unknown): leg is PaymentDraftLeg {
  if (!leg || typeof leg !== 'object') return false;
  const l = leg as Record<string, unknown>;

  const hasTripId =
    (typeof l.tripId === 'number' && !Number.isNaN(l.tripId)) ||
    (typeof l.tripId === 'string' && l.tripId.trim().length > 0);

  const hasRoute = isValidString(l.route);
  const hasDepartureTime = isValidString(l.departureTime);
  const hasSeats =
    Array.isArray(l.seats) &&
    l.seats.length > 0 &&
    l.seats.every((s) => typeof s === 'string' && s.trim().length > 0);
  const hasPickup = isValidString(l.pickup);
  const hasDropoff = isValidString(l.dropoff);
  const hasUnitFare = isValidNonNegativeNumber(l.unitFare);
  const hasSubtotal = isValidNonNegativeNumber(l.subtotal);

  return Boolean(
    hasTripId &&
      hasRoute &&
      hasDepartureTime &&
      hasSeats &&
      hasPickup &&
      hasDropoff &&
      hasUnitFare &&
      hasSubtotal,
  );
}

export function validatePaymentDraft(data: unknown): PaymentDraft | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  if (!isValidString(d.id)) return null;
  if (!isValidNonNegativeNumber(d.totalFare)) return null;

  if (d.kind === 'shipment') {
    const sender = isValidShipmentContact(d.sender, false);
    const receiver = isValidShipmentContact(d.receiver, false);
    const route = d.route && typeof d.route === 'object'
      ? d.route as Record<string, unknown>
      : null;
    if (
      !isValidPositiveInteger(d.shipmentId) ||
      !isValidPositiveInteger(d.paymentId) ||
      !isValidString(d.waybillCode) ||
      !isValidString(d.orderCode) ||
      !sender ||
      !receiver ||
      !route ||
      !isValidString(route.origin) ||
      !isValidString(route.destination) ||
      !isValidString(route.departureTime) ||
      !isValidShipmentPoint(d.pickupPoint) ||
      !isValidShipmentPoint(d.dropoffPoint)
    ) {
      return null;
    }
    return d as unknown as ShipmentPaymentDraft;
  }

  if (d.kind !== undefined && d.kind !== 'booking') return null;
  if (d.tripType !== 'one-way' && d.tripType !== 'round-trip') return null;

  if (!d.passenger || typeof d.passenger !== 'object') return null;
  const p = d.passenger as Record<string, unknown>;
  if (
    !isValidString(p.fullName) ||
    !isValidString(p.phoneNumber) ||
    !isValidString(p.email)
  ) {
    return null;
  }

  if (!Array.isArray(d.legs)) return null;
  const expectedLegCount = d.tripType === 'one-way' ? 1 : 2;
  if (d.legs.length !== expectedLegCount) return null;
  if (!d.legs.every(isValidLeg)) return null;

  if (d.luggage !== undefined && d.luggage !== null) {
    if (typeof d.luggage !== 'object') return null;
    const lug = d.luggage as Record<string, unknown>;
    if (!isValidNonNegativeNumber(lug.fee) || !isValidNonNegativeNumber(lug.weight)) {
      return null;
    }
  }

  return d as unknown as BookingPaymentDraft;
}

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
    return validatePaymentDraft(parsed);
  } catch {
    return null;
  }
}

export function createPaymentDraft(draftData: NewPaymentDraft): PaymentDraft {
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
