import type {
  NguoiTraCuoc,
  TrangThaiPhieuGuiHang,
} from '../../generated/prisma/client.js';

export interface ShipmentSender {
  fullName: string;
  phoneNumber: string;
}

export interface ShipmentReceiver {
  fullName: string;
  phoneNumber: string;
}

export interface ShipmentTripInfo {
  tripId: number;
  code: string;
  departureDate: string;
  departureTime: string;
}

export interface ShipmentPointInfo {
  pointId: number;
  name: string;
  code: string;
  address: string;
}

export interface ShipmentSummary {
  shipmentId: number;
  waybillCode: string;
  sentAt: string;
  status: TrangThaiPhieuGuiHang;
  sender: ShipmentSender;
  receiver: ShipmentReceiver;
  trip: ShipmentTripInfo;
  originPoint: ShipmentPointInfo;
  destinationPoint: ShipmentPointInfo;
  totalFee: number;
}

export interface CargoDimensions {
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
  dimensions: CargoDimensions | null;
  declaredValue: number | null;
  description: string | null;
}

export interface CargoFeeDetail {
  feeDetailId: number;
  cargoTypeName: string;
  chargeableWeightKg: number;
  fee: number;
}

export interface ShipmentFeeSummary {
  mainFee: number;
  serviceFee: number;
  discountAmount: number;
  totalFee: number;
  freightPayer: NguoiTraCuoc;
}

export interface ShipmentHistoryItem {
  historyId: number;
  status: TrangThaiPhieuGuiHang;
  time: string;
  note: string | null;
  actor: {
    accountId: number;
    fullName: string;
  } | null;
}

export interface ShipmentDetail extends ShipmentSummary {
  note: string | null;
  cargoItems: CargoItemDetail[];
  cargoFeeDetails: CargoFeeDetail[];
  feeSummary: ShipmentFeeSummary;
  history: ShipmentHistoryItem[];
}
