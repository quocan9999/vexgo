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
  bookingId?: number;
  bookingCode?: string;
  orderId?: number;
  orderCode?: string;
  status?: string;
  paymentStatus?: string;
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
  dropoffDeadline?: string | null;
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
    cccd?: string | null;
  };
  route: {
    origin: string;
    destination: string;
    departureTime: string | null;
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
      (route.departureTime !== null &&
        route.departureTime !== undefined &&
        !isValidString(route.departureTime)) ||
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

export const PAYMENT_DRAFT_TERMINAL_PREFIX = 'vexgo:payment-draft-terminal:';

export function markPaymentDraftTerminal(
  draftId: string | null | undefined,
  terminalStatus: string,
): void {
  if (typeof window === 'undefined' || !draftId) return;
  try {
    sessionStorage.setItem(
      `${PAYMENT_DRAFT_TERMINAL_PREFIX}${draftId}`,
      terminalStatus,
    );
  } catch {
    // Ignore storage write errors
  }
}

export function markPaymentDraftsTerminalByOrder(
  criteria: {
    bookingId?: number | null;
    shipmentId?: number | null;
    orderId?: number | null;
    orderCode?: string | null;
  },
  terminalStatus: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const draft = validatePaymentDraft(parsed);
      if (!draft) continue;

      let matched = false;
      if (draft.kind === 'shipment') {
        if (
          (criteria.shipmentId && draft.shipmentId === criteria.shipmentId) ||
          (criteria.orderId && draft.orderId === criteria.orderId) ||
          (criteria.orderCode && draft.orderCode === criteria.orderCode)
        ) {
          matched = true;
        }
      } else {
        if (
          (criteria.bookingId &&
            (draft.bookingId === criteria.bookingId ||
              draft.legs.some((leg) => leg.bookingId === criteria.bookingId))) ||
          (criteria.orderId &&
            (draft.orderId === criteria.orderId ||
              draft.legs.some((leg) => leg.orderId === criteria.orderId))) ||
          (criteria.orderCode &&
            (draft.orderCode === criteria.orderCode ||
              draft.legs.some((leg) => leg.orderCode === criteria.orderCode)))
        ) {
          matched = true;
        }
      }

      if (matched) {
        markPaymentDraftTerminal(draft.id, terminalStatus);
      }
    }
  } catch {
    // Ignore storage read/write errors
  }
}

export function findActivePaymentDraftByOrder(
  criteria: {
    bookingId?: number | null;
    shipmentId?: number | null;
    orderId?: number | null;
  },
  nowMs: number = Date.now(),
): PaymentDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    let best: { draft: PaymentDraft; legCount: number; expiresAtMs: number } | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const draft = validatePaymentDraft(parsed);
      if (!draft) continue;
      if (sessionStorage.getItem(`${PAYMENT_DRAFT_TERMINAL_PREFIX}${draft.id}`)) {
        continue;
      }
      if (
        ['DA_THANH_TOAN', 'HOAN_TAT', 'DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(
          draft.status ?? '',
        ) ||
        ['DA_THANH_TOAN', 'THANH_CONG', 'DA_HUY', 'HUY', 'HET_HAN'].includes(
          draft.paymentStatus ?? '',
        )
      ) {
        continue;
      }
      if (!draft.paymentExpiresAt) continue;
      const expiresAtMs = Date.parse(draft.paymentExpiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) continue;

      let matched = false;
      let legCount = 1;
      if (draft.kind === 'shipment') {
        if (
          (criteria.shipmentId && draft.shipmentId === criteria.shipmentId) ||
          (criteria.orderId && draft.orderId === criteria.orderId)
        ) {
          matched = true;
        }
      } else {
        legCount = draft.legs.length;
        if (
          (criteria.bookingId &&
            (draft.bookingId === criteria.bookingId ||
              draft.legs.some((leg) => leg.bookingId === criteria.bookingId))) ||
          (criteria.orderId &&
            (draft.orderId === criteria.orderId ||
              draft.legs.some((leg) => leg.orderId === criteria.orderId)))
        ) {
          matched = true;
        }
      }

      if (!matched) continue;
      if (
        !best ||
        legCount > best.legCount ||
        (legCount === best.legCount && expiresAtMs > best.expiresAtMs)
      ) {
        best = { draft, legCount, expiresAtMs };
      }
    }
    return best?.draft ?? null;
  } catch {
    return null;
  }
}

export function getLatestActivePaymentDraft(
  nowMs: number = Date.now(),
): { draft: PaymentDraft; expiresAtMs: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    let best: { draft: PaymentDraft; expiresAtMs: number } | null = null;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(PAYMENT_DRAFT_STORAGE_PREFIX)) continue;
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const draft = validatePaymentDraft(parsed);
      if (!draft) continue;
      if (sessionStorage.getItem(`${PAYMENT_DRAFT_TERMINAL_PREFIX}${draft.id}`)) {
        continue;
      }
      if (
        ['DA_THANH_TOAN', 'HOAN_TAT', 'DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(
          draft.status ?? '',
        ) ||
        ['DA_THANH_TOAN', 'THANH_CONG', 'DA_HUY', 'HUY', 'HET_HAN'].includes(
          draft.paymentStatus ?? '',
        )
      ) {
        continue;
      }
      if (!draft.paymentExpiresAt) continue;
      const expiresAtMs = Date.parse(draft.paymentExpiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) continue;
      if (!best || expiresAtMs > best.expiresAtMs) {
        best = { draft, expiresAtMs };
      }
    }
    return best;
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

function formatDraftDepartureTime(isoOrText: string | null | undefined): string {
  if (!isoOrText || !isoOrText.trim()) return 'Đang cập nhật';
  const parsed = new Date(isoOrText);
  if (Number.isNaN(parsed.getTime())) return isoOrText;
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  const mo = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = parsed.getFullYear();
  return `${hh}:${mm} ${dd}-${mo}-${yyyy}`;
}

export function createPaymentDraftFromBooking(booking: {
  bookingId?: number;
  bookingCode?: string;
  orderId?: number;
  orderCode?: string | null;
  tripId?: number | null;
  route?: string | null;
  origin?: string | null;
  destination?: string | null;
  departureTime?: string | null;
  busCompanyName?: string | null;
  vehicleType?: string | null;
  seatNumbers?: string[];
  activeSeatNumbers?: string[];
  seats?: string[];
  pickup?: string | null;
  dropoff?: string | null;
  totalAmount?: number | string;
  ticketSubtotal?: number | string;
  cargoFee?: number | string;
  cargoItems?: Array<{
    name?: string;
    quantity?: number;
    weight?: number;
    category?: string;
    categoryName?: string;
  }>;
  passenger?: {
    fullName?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  } | null;
  tickets?: Array<{
    price?: number;
  }>;
  status?: string;
  paymentStatus?: string | null;
  paymentExpiresAt?: string;
  createdAt?: string;
}): PaymentDraft | null {
  if (
    !booking ||
    typeof booking.bookingId !== 'number' ||
    !booking.bookingCode?.trim() ||
    !booking.orderCode?.trim()
  ) {
    return null;
  }

  const existingDraft = findActivePaymentDraftByOrder({
    bookingId: booking.bookingId,
    orderId: booking.orderId,
  });
  if (existingDraft) {
    return existingDraft;
  }

  const seats = (
    booking.activeSeatNumbers && booking.activeSeatNumbers.length > 0
      ? booking.activeSeatNumbers
      : booking.seatNumbers || booking.seats || []
  ).filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  const effectiveSeats = seats.length > 0 ? seats : ['Tiêu chuẩn'];

  const totalFare = Number(booking.totalAmount ?? 0);
  if (!Number.isFinite(totalFare) || totalFare < 0) return null;

  const ticketSubtotal = Number(booking.ticketSubtotal ?? totalFare);
  const firstTicketPrice = booking.tickets?.[0]?.price;
  const unitFare =
    typeof firstTicketPrice === 'number' && Number.isFinite(firstTicketPrice) && firstTicketPrice >= 0
      ? firstTicketPrice
      : Math.max(
          0,
          Math.round(
            (Number.isFinite(ticketSubtotal) ? ticketSubtotal : totalFare) /
              Math.max(1, effectiveSeats.length),
          ),
        );

  const route =
    booking.route?.trim() ||
    [booking.origin, booking.destination].filter(Boolean).join(' - ') ||
    'Tuyến xe';
  const pickup = booking.pickup?.trim() || booking.origin?.trim() || 'Điểm đón';
  const dropoff = booking.dropoff?.trim() || booking.destination?.trim() || 'Điểm trả';

  const fullName = booking.passenger?.fullName?.trim() || 'Khách hàng';
  const phoneNumber = booking.passenger?.phoneNumber?.trim() || '';
  const email = booking.passenger?.email?.trim() || 'khachhang@vexgo.vn';
  if (!phoneNumber) return null;

  const cargoFee = Math.max(0, Number(booking.cargoFee ?? 0) || 0);
  const cargoItems = booking.cargoItems || [];
  const luggageWeight = cargoItems.reduce(
    (sum, item) => sum + (Number(item.weight) || 0) * (Number(item.quantity) || 1),
    0,
  );

  return createPaymentDraft({
    kind: 'booking',
    tripType: 'one-way',
    bookingId: booking.bookingId,
    bookingCode: booking.bookingCode.trim(),
    orderId: booking.orderId,
    orderCode: booking.orderCode.trim(),
    status: booking.status,
    paymentStatus: booking.paymentStatus ?? undefined,
    paymentExpiresAt: booking.paymentExpiresAt,
    createdAt: booking.createdAt,
    totalFare,
    passenger: {
      fullName,
      phoneNumber,
      email,
    },
    legs: [
      {
        tripId: booking.tripId ?? booking.bookingId,
        route,
        departureTime: formatDraftDepartureTime(booking.departureTime),
        seats: effectiveSeats,
        pickup,
        dropoff,
        unitFare,
        subtotal: Number.isFinite(ticketSubtotal) && ticketSubtotal >= 0 ? ticketSubtotal : totalFare,
        busCompanyName: booking.busCompanyName ?? undefined,
        vehicleType: booking.vehicleType ?? undefined,
        bookingId: booking.bookingId,
        bookingCode: booking.bookingCode.trim(),
        orderId: booking.orderId,
        orderCode: booking.orderCode.trim(),
        status: booking.status,
        paymentStatus: booking.paymentStatus ?? undefined,
      },
    ],
    ...(cargoItems.length > 0 || cargoFee > 0
      ? {
          luggage: {
            fee: cargoFee,
            weight: luggageWeight,
            items: cargoItems.map((item, idx) => ({
              id: String(idx + 1),
              type: item.name || 'Hàng gửi kèm',
              quantity: item.quantity ?? 1,
              weight: item.weight ?? 0,
              category: item.categoryName || item.category || 'Hàng gửi kèm',
            })),
          },
        }
      : {}),
  });
}

export function createPaymentDraftFromShipment(shipment: {
  dropoffDeadline?: string | null;
  shipmentId: number;
  orderId: number;
  paymentId: number;
  paymentExpiresAt?: string;
  waybillCode: string;
  orderCode: string;
  pricing: {
    totalFee: number;
  };
  sender: {
    fullName: string;
    phoneNumber: string;
    email?: string | null;
  };
  receiver: {
    fullName: string;
    phoneNumber: string;
    cccd?: string | null;
  };
  trip: {
    departureTime: string | null;
    route: {
      origin: string;
      destination: string;
    };
  };
  pickupPoint: {
    name: string;
    address: string;
  };
  dropoffPoint: {
    name: string;
    address: string;
  };
}): PaymentDraft | null {
  if (
    !shipment ||
    !isValidPositiveInteger(shipment.shipmentId) ||
    !isValidPositiveInteger(shipment.paymentId) ||
    !isValidString(shipment.waybillCode) ||
    !isValidString(shipment.orderCode)
  ) {
    return null;
  }

  const existingDraft = findActivePaymentDraftByOrder({
    shipmentId: shipment.shipmentId,
    orderId: shipment.orderId,
  });
  if (existingDraft) {
    return existingDraft;
  }

  const totalFare = Number(shipment.pricing?.totalFee ?? 0);
  if (!Number.isFinite(totalFare) || totalFare < 0) return null;

  return createPaymentDraft({
    kind: 'shipment',
    dropoffDeadline: shipment.dropoffDeadline,
    shipmentId: shipment.shipmentId,
    paymentId: shipment.paymentId,
    orderId: shipment.orderId,
    waybillCode: shipment.waybillCode,
    orderCode: shipment.orderCode,
    totalFare,
    paymentExpiresAt: shipment.paymentExpiresAt,
    sender: {
      fullName: shipment.sender.fullName,
      phoneNumber: shipment.sender.phoneNumber,
      email: shipment.sender.email ?? null,
    },
    receiver: {
      fullName: shipment.receiver.fullName,
      phoneNumber: shipment.receiver.phoneNumber,
      cccd: shipment.receiver.cccd ?? null,
    },
    route: {
      origin: shipment.trip.route.origin,
      destination: shipment.trip.route.destination,
      departureTime: shipment.trip.departureTime,
    },
    pickupPoint: {
      name: shipment.pickupPoint.name,
      address: shipment.pickupPoint.address,
    },
    dropoffPoint: {
      name: shipment.dropoffPoint.name,
      address: shipment.dropoffPoint.address,
    },
  });
}
