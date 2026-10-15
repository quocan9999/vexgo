export interface AdminSupportMessage {
  tinNhanId: number;
  cuocTroChuyenId: number;
  taiKhoanGuiId: number;
  loaiNguoiGui: 'KHACH_HANG' | 'NHAN_VIEN' | 'HE_THONG';
  loaiTinNhan: 'VAN_BAN' | 'HINH_ANH';
  noiDung: string;
  tepDinhKemUrl?: string | null;
  clientMessageId?: string | null;
  trangThai: 'DA_GUI' | 'DA_NHAN' | 'DA_DOC';
  daDocLuc?: string | null;
  createdAt: string;
  taiKhoanGui?: {
    taiKhoanId: number;
    hoTen: string;
    avatarUrl?: string | null;
  };
}

export interface AdminSupportConversation {
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
  khachHang: {
    khachHangId: number;
    maKhachHang: string;
    taiKhoan: {
      hoTen: string;
      soDienThoai: string;
      avatarUrl: string | null;
    };
  };
  nhanVien?: {
    nhanVienId: number;
    maNhanVien: string;
    taiKhoan: {
      hoTen: string;
      avatarUrl: string | null;
    };
  } | null;
  tinNhanCuoi?: AdminSupportMessage | null;
  soTinChuaDoc?: number;
}
