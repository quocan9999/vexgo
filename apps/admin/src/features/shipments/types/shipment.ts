export type ShipmentStatus =
  'MOI_TAO' | 'DA_TIEP_NHAN' | 'DANG_VAN_CHUYEN' | 'DA_GIAO' | 'DA_HUY';

export type FreightPayer = 'NGUOI_GUI' | 'NGUOI_NHAN';

export interface ShipmentContact {
  fullName: string;
  phoneNumber: string;
}

export interface ShipmentTripSummary {
  tripId: number;
  code: string;
  departureDate: string;
  departureTime: string;
}

export interface ShipmentPointSummary {
  pointId: number;
  name: string;
  code: string;
  address: string;
}

export interface ShipmentSummary {
  shipmentId: number;
  waybillCode: string;
  sentAt: string;
  status: ShipmentStatus;
  sender: ShipmentContact;
  receiver: ShipmentContact;
  trip: ShipmentTripSummary | null;
  route?: { routeId: number; origin: string; destination: string };
  carrier?: { id: number; name: string };
  dropoffDeadline?: string | null;
  expectedSendDate?: string | null;
  originPoint: ShipmentPointSummary;
  destinationPoint: ShipmentPointSummary;
  totalFee: number;
}

export interface CargoItemDimensions {
  length: number;
  width: number;
  height: number;
}

export interface CargoItemDetail {
  cargoId: number;
  name: string;
  typeName: string;
  weightKg: number;
  declaredWeightKg?: number;
  actualWeightKg?: number | null;
  quantity: number;
  dimensions: CargoItemDimensions | null;
  declaredValue: number | null;
  description: string | null;
}

export interface CargoFeeDetail {
  feeDetailId: number;
  cargoTypeName: string;
  chargeableWeightKg: number;
  fee: number;
}

export interface ShipmentHistoryActor {
  accountId: number;
  fullName: string;
}

export interface ShipmentHistoryItem {
  historyId: number;
  status: ShipmentStatus;
  time: string;
  note: string | null;
  actor: ShipmentHistoryActor | null;
}

export interface ShipmentFeeSummary {
  estimatedFee?: number | null;
  confirmedAt?: string | null;
  paidAmount?: number;
  outstandingAmount?: number;
  mainFee: number;
  serviceFee: number;
  discountAmount: number;
  totalFee: number;
  freightPayer: FreightPayer;
}

export interface ShipmentDetail {
  shipmentId: number;
  waybillCode: string;
  sentAt: string;
  status: ShipmentStatus;
  paymentStatus: string;
  note: string | null;
  sender: ShipmentContact;
  receiver: ShipmentContact;
  trip: ShipmentTripSummary | null;
  route?: { routeId: number; origin: string; destination: string };
  carrier?: { id: number; name: string };
  dropoffDeadline?: string | null;
  expectedSendDate?: string | null;
  originPoint: ShipmentPointSummary;
  destinationPoint: ShipmentPointSummary;
  cargoItems: CargoItemDetail[];
  cargoFeeDetails: CargoFeeDetail[];
  feeSummary: ShipmentFeeSummary;
  history: ShipmentHistoryItem[];
  pricingHistory?: Array<{
    id: number;
    action: string;
    beforeFee: number;
    afterFee: number;
    note: string | null;
    time: string;
    actor: ShipmentHistoryActor | null;
  }>;
  assignmentHistory?: Array<{
    id: number;
    previousTripId: number | null;
    tripId: number | null;
    note: string | null;
    time: string;
    actor: ShipmentHistoryActor | null;
  }>;
  moneyCases?: Array<{
    id: number;
    reason: string;
    amount: number;
    status: string;
    outcome: string | null;
    note: string | null;
    reference: string | null;
    resolvedAt: string | null;
  }>;
  totalFee: number;
}

export interface ShipmentPaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ShipmentsResponse {
  data: ShipmentSummary[];
  meta: ShipmentPaginationMeta;
}

export interface ShipmentDetailResponse {
  data: ShipmentDetail;
}

export type ShipmentOperationalStatus = Exclude<ShipmentStatus, 'DA_HUY'>;

export interface ShipmentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ShipmentStatus | '';
  sortDirection?: 'asc' | 'desc';
}

export type ShipmentSortDirection = 'asc' | 'desc';
