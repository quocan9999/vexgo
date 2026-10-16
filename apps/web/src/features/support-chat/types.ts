export interface BusCompany {
  busCompanyId: number;
  code: string;
  name: string;
  contactInfo: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportMessage {
  tinNhanId: number;
  cuocTroChuyenId: number;
  taiKhoanGuiId: number;
  loaiNguoiGui: 'KHACH_HANG' | 'NHAN_VIEN' | 'HE_THONG';
  loaiTinNhan: 'VAN_BAN' | 'HINH_ANH';
  noiDung: string;
  tepDinhKemUrl?: string | null;
  clientMessageId?: string | null;
  trangThai: 'DA_GUI' | 'DA_NHAN' | 'DA_DOC';
  deliveryStatus?: 'DANG_GUI' | 'DA_GUI' | 'THAT_BAI';
  daDocLuc?: string | null;
  createdAt: string;
  taiKhoanGui?: {
    taiKhoanId: number;
    hoTen: string;
    avatarUrl?: string | null;
  };
}

export interface SupportConversation {
  cuocTroChuyenId: number;
  maCuocTroChuyen: string;
  tieuDe?: string | null;
  trangThai: 'CHO_TIEP_NHAN' | 'DANG_XU_LY' | 'DA_DONG';
  kenhHoTro: string;
  cheDoChat: string;
  khachHangId: number;
  nhanVienId?: number | null;
  nhaXeId: number;
  dongLuc?: string | null;
  createdAt: string;
  updatedAt: string;
  nhaXe: {
    nhaXeId: number;
    tenNhaXe: string;
    logo: string | null;
    hotline: string;
  };
  nhanVien?: {
    nhanVienId: number;
    maNhanVien: string;
    taiKhoan: {
      hoTen: string;
      avatarUrl: string | null;
    };
  } | null;
  tinNhanCuoi?: SupportMessage | null;
}
