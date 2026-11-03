import type { Station } from '@/features/stations/types/station';

export type StopPointRole = 'DON' | 'TRA' | 'NGHI';

export interface RouteStopItem {
  tuyenXeDiemDungId?: number;
  diemDonTraId: number;
  loaiDiem: StopPointRole;
  phutLech: number;
  thuTu: number;
  phuPhi: number;
  phutCoMatTruoc: number;
  nhanKhach: boolean;
  ghiChu?: string | null;
  diemDonTra?: Station;
}

export interface TripPassengerPointItem {
  diemDonTraChuyenXeId?: number;
  chuyenXeId?: number;
  diemDonTraId: number;
  loaiDiem: StopPointRole;
  thoiGianDuKien?: string;
  gioThucTe?: string;
  phutLech: number;
  thuTu: number;
  phuPhi: number;
  phutCoMatTruoc: number;
  nhanKhach: boolean;
  ghiChu?: string | null;
  veCount?: number;
  diemDonTra?: Station;
}

export interface StopValidationError {
  index: number;
  code: string;
  message: string;
}
