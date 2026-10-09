export type ShipmentStatus =
  | 'MOI_TAO'
  | 'DA_TIEP_NHAN'
  | 'DANG_VAN_CHUYEN'
  | 'DA_GIAO'
  | 'DA_HUY';

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
  trip: ShipmentTripSummary;
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
  note: string | null;
  sender: ShipmentContact;
  receiver: ShipmentContact;
  trip: ShipmentTripSummary;
  originPoint: ShipmentPointSummary;
  destinationPoint: ShipmentPointSummary;
  cargoItems: CargoItemDetail[];
  cargoFeeDetails: CargoFeeDetail[];
  feeSummary: ShipmentFeeSummary;
  history: ShipmentHistoryItem[];
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

export interface ShipmentQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ShipmentStatus | '';
  sortDirection?: 'asc' | 'desc';
}

export type ShipmentSortDirection = 'asc' | 'desc';
