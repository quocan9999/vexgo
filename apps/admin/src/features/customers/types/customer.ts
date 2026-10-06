export type CustomerAccountStatus = 'HOAT_DONG' | 'TAM_KHOA';

export interface CustomerAccount {
  accountId: number;
  status: CustomerAccountStatus;
  phoneVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerSummary {
  customerId: number;
  customerCode: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  loyaltyPoints: number;
  account: CustomerAccount;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  account: CustomerAccount & {
    createdAt: string;
    updatedAt: string;
  };
}

export type CustomerSortKey =
  | 'customerCode'
  | 'fullName'
  | 'loyaltyPoints'
  | 'createdAt'
  | 'updatedAt';

export interface CustomerQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  accountStatus?: CustomerAccountStatus;
  sortBy?: CustomerSortKey;
  sortDirection?: 'asc' | 'desc';
}

export interface CustomerPageResponse {
  data: CustomerSummary[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CustomerDetailResponse {
  data: CustomerDetail;
}

export type CustomerTransactionBookingSummary = {
  bookingId: number;
  code: string;
  status: string;
};

export type CustomerTransactionShipmentSummary = {
  shipmentId: number;
  code: string;
  status: string;
};

export interface CustomerTransaction {
  transactionId: number;
  code: string;
  createdDate: string;
  totalAmount: number;
  status: string;
  customerSnapshot: {
    fullName: string;
    phoneNumber: string;
    email: string | null;
  };
  booking: CustomerTransactionBookingSummary | null;
  shipment: CustomerTransactionShipmentSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTransactionsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: 'createdDate' | 'totalAmount';
  sortDirection?: 'asc' | 'desc';
}

export interface CustomerTransactionsResponse {
  data: CustomerTransaction[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CustomerTicket {
  ticketId: number;
  ticketCode: string;
  status: string;
  pickupPoint: string | null;
  listedPrice: number;
  actualPrice: number;
  booking: {
    bookingId: number;
    code: string;
    bookedAt: string;
    status: string;
  };
  trip: {
    tripId: number;
    code: string;
    departureDate: string;
    departureTime: string;
    status: string;
    route: {
      routeId: number;
      code: string;
      origin: string;
      destination: string;
    };
    vehicle: {
      vehicleId: number;
      licensePlate: string;
    };
  };
  seat: {
    seatId: number;
    code: string;
    position: string | null;
  };
}

export interface CustomerTicketsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface CustomerTicketsResponse {
  data: CustomerTicket[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CustomerShipmentReceiver {
  fullName: string;
  phoneNumber: string;
  address: string | null;
}

export interface CustomerShipmentTripSummary {
  tripId: number;
  code: string;
}

export interface CustomerShipmentBranchSummary {
  branchId: number;
  code: string;
  name: string;
}

export interface CustomerShipment {
  shipmentId: number;
  waybillCode: string;
  sentAt: string;
  status: string;
  receiver: CustomerShipmentReceiver;
  pickupMethod: string | null;
  deliveryMethod: string | null;
  pickupAddress: string | null;
  mainFee: number;
  serviceFee: number;
  discountAmount: number;
  totalFee: number;
  freightPayer: string;
  trip: CustomerShipmentTripSummary | null;
  originBranch: CustomerShipmentBranchSummary | null;
  destinationBranch: CustomerShipmentBranchSummary | null;
}

export interface CustomerShipmentsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface CustomerShipmentsResponse {
  data: CustomerShipment[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
