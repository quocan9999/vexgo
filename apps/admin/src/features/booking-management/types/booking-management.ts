import type {
  BookingManagementListState,
  BookingSortKey,
  TicketSortKey,
} from '../services/booking-management-query';

export type AdminListMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AdminPage<T> = { data: T[]; meta: AdminListMeta };

export type AdminTripSummary = {
  tripId: number;
  tripCode: string;
  origin: string;
  destination: string;
  departureAt: string;
};

export type AdminCustomerSummary = {
  name: string;
  phoneNumber: string;
};

export type AdminBookingListItem = {
  bookingId: number;
  bookingCode: string;
  bookedAt: string;
  customer: AdminCustomerSummary;
  trip: AdminTripSummary | null;
  tripIntegrity: string;
  initialTicketCount: number;
  ticketCount: number;
  cancelledTicketCount: number;
  activeTicketCount: number;
  initialTicketAmount: string;
  status: string;
  isPartiallyCancelled: boolean;
};

export type AdminTicketListItem = {
  ticketId: number;
  ticketCode: string;
  bookingId: number;
  bookingCode: string;
  customer: AdminCustomerSummary;
  trip: AdminTripSummary | null;
  tripIntegrity: string;
  seatNumber: string | null;
  actualPrice: string;
  status: string;
  bookedAt: string;
};

export type AdminPaymentSummary = {
  paymentId: number;
  amountVnd: string;
  method: string | null;
  status: string;
  occurredAt: string;
  ticketId: number | null;
  allocation: 'TICKET' | 'UNALLOCATED';
};

export type AdminShipmentSummary = {
  shipmentId: number;
  trackingCode: string;
  status: string;
  tripId: number | null;
  tripIntegrity: string;
  items: Array<{ name: string; quantity: number; itemType: string }>;
};

export type AdminBookingDetail = AdminBookingListItem & {
  transactionStatus: string;
  transactionTotalAmount: string;
  paymentSummary: {
    originalPayments: AdminPaymentSummary[];
    refunds: {
      pending: AdminPaymentSummary[];
      succeeded: AdminPaymentSummary[];
      other: AdminPaymentSummary[];
    };
  };
  shipment: AdminShipmentSummary | null;
  tickets: Array<{
    ticketId: number;
    ticketCode: string;
    seatNumber: string | null;
    status: string;
    listedPrice: string;
    actualPrice: string;
    pickup: string | null;
  }>;
};

export type AdminTicketDetail = {
  ticketId: number;
  ticketCode: string;
  booking: {
    bookingId: number;
    bookingCode: string;
    bookedAt: string;
    status: string;
    initialTicketCount: number;
    initialTicketAmount: string;
    transactionStatus: string;
  };
  customer: AdminCustomerSummary;
  trip: AdminTripSummary | null;
  tripIntegrity: string;
  seatNumber: string | null;
  listedPrice: string;
  actualPrice: string;
  pickup: string | null;
  status: string;
  refunds: Array<{
    refundId: number;
    amountVnd: string;
    method: string | null;
    status: string;
    occurredAt: string;
    ticketId: number;
  }>;
};

export type AdminHistoryEntry = {
  historyId: number;
  oldStatus: string | null;
  newStatus: string;
  occurredAt: string;
  source: string;
  reason: string | null;
  isOverride: boolean;
  operationId: string | null;
  actorName: string | null;
};

export type AdminBookingQuery = BookingManagementListState & {
  sortBy: BookingSortKey;
};

export type AdminTicketQuery = BookingManagementListState & {
  sortBy: TicketSortKey;
};
