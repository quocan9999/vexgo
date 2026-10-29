export type StationType = 'BEN_XE' | 'VAN_PHONG' | 'DIEM_DON_TRA';

export interface Station {
  diemDonTraId: number;
  maDiem: string;
  tenDiem: string;
  loaiDiem: StationType;
  diaChi: string;
  diaDiemCuId: number;
  diaDiemMoiId: number;
  viDo: number | null;
  kinhDo: number | null;
  soDienThoai: string | null;
  trangThai: string;
  nhaXeId: number;
  createdAt: string;
  updatedAt: string;
  diaDiemCu?: {
    diaDiemId: number;
    tenDiaDiem: string;
    code: number;
  };
  diaDiemMoi?: {
    diaDiemId: number;
    tenDiaDiem: string;
    code: number;
    chuThichSapNhap?: string;
  };
  nhaXe?: {
    nhaXeId: number;
    tenNhaXe: string;
    maNhaXe: string;
  };
}

export interface CreateStationInput {
  maDiem: string;
  tenDiem: string;
  loaiDiem: StationType;
  diaChi: string;
  diaDiemCuId: number;
  soDienThoai?: string;
  viDo?: number;
  kinhDo?: number;
}

export interface UpdateStationInput {
  tenDiem?: string;
  loaiDiem?: StationType;
  diaChi?: string;
  diaDiemCuId?: number;
  soDienThoai?: string;
  viDo?: number;
  kinhDo?: number;
  trangThai?: string;
}

export interface StationQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  loaiDiem?: string;
  diaDiemCuId?: number;
  diaDiemMoiId?: number;
  nhaXeId?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}
