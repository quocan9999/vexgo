-- CreateTable
CREATE TABLE `NhaXe` (
    `nhaXeId` BIGINT NOT NULL AUTO_INCREMENT,
    `maNhaXe` VARCHAR(50) NOT NULL,
    `tenNhaXe` VARCHAR(150) NOT NULL,
    `thongTinLienHe` TEXT NULL,
    `chinhSachDoiHuy` TEXT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `NhaXe_maNhaXe_key`(`maNhaXe`),
    PRIMARY KEY (`nhaXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LoaiXe` (
    `loaiXeId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenLoai` VARCHAR(100) NOT NULL,
    `moTa` VARCHAR(500) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `LoaiXe_index_0`(`tenLoai`),
    PRIMARY KEY (`loaiXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Xe` (
    `xeId` BIGINT NOT NULL AUTO_INCREMENT,
    `bienSoXe` VARCHAR(15) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `loaiXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Xe_bienSoXe_key`(`bienSoXe`),
    PRIMARY KEY (`xeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Ghe` (
    `gheId` BIGINT NOT NULL AUTO_INCREMENT,
    `soGhe` VARCHAR(10) NOT NULL,
    `viTri` VARCHAR(50) NULL,
    `xeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Ghe_index_1`(`xeId`, `soGhe`),
    PRIMARY KEY (`gheId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TuyenXe` (
    `tuyenXeId` BIGINT NOT NULL AUTO_INCREMENT,
    `maTuyenXe` VARCHAR(50) NOT NULL,
    `diemDi` VARCHAR(100) NOT NULL,
    `diemDen` VARCHAR(100) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `TuyenXe_index_2`(`nhaXeId`, `maTuyenXe`),
    PRIMARY KEY (`tuyenXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ChuyenXe` (
    `chuyenXeId` BIGINT NOT NULL AUTO_INCREMENT,
    `maChuyenXe` VARCHAR(50) NOT NULL,
    `ngayKhoiHanh` DATE NOT NULL,
    `gioKhoiHanh` TIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `tuyenXeId` BIGINT NOT NULL,
    `xeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ChuyenXe_maChuyenXe_key`(`maChuyenXe`),
    PRIMARY KEY (`chuyenXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `GheChuyenXe` (
    `gheChuyenXeId` BIGINT NOT NULL AUTO_INCREMENT,
    `trangThai` VARCHAR(30) NOT NULL,
    `chuyenXeId` BIGINT NOT NULL,
    `gheId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `GheChuyenXe_index_3`(`chuyenXeId`, `gheId`),
    PRIMARY KEY (`gheChuyenXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `BangGia` (
    `bangGiaId` BIGINT NOT NULL AUTO_INCREMENT,
    `giaNiemYet` DECIMAL(18, 2) NOT NULL,
    `tuNgay` DATE NOT NULL,
    `denNgay` DATE NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `tuyenXeId` BIGINT NOT NULL,
    `loaiXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `BangGia_index_4`(`tuyenXeId`, `loaiXeId`),
    PRIMARY KEY (`bangGiaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TaiKhoan` (
    `taiKhoanId` BIGINT NOT NULL AUTO_INCREMENT,
    `hoTen` VARCHAR(100) NOT NULL,
    `soDienThoai` VARCHAR(16) NOT NULL,
    `matKhau` VARCHAR(255) NOT NULL,
    `ngaySinh` DATE NULL,
    `cccd` CHAR(12) NULL,
    `email` VARCHAR(150) NULL,
    `daXacThucSoDienThoai` BOOLEAN NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `TaiKhoan_soDienThoai_key`(`soDienThoai`),
    PRIMARY KEY (`taiKhoanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KhachHang` (
    `khachHangId` BIGINT NOT NULL AUTO_INCREMENT,
    `maKhachHang` VARCHAR(50) NOT NULL,
    `diemTichLuy` INTEGER NOT NULL DEFAULT 0,
    `taiKhoanId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `KhachHang_maKhachHang_key`(`maKhachHang`),
    UNIQUE INDEX `KhachHang_taiKhoanId_key`(`taiKhoanId`),
    PRIMARY KEY (`khachHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `NhanVien` (
    `nhanVienId` BIGINT NOT NULL AUTO_INCREMENT,
    `maNhanVien` VARCHAR(50) NOT NULL,
    `trangThaiLamViec` VARCHAR(30) NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `taiKhoanId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `NhanVien_taiKhoanId_key`(`taiKhoanId`),
    UNIQUE INDEX `NhanVien_index_5`(`nhaXeId`, `maNhanVien`),
    PRIMARY KEY (`nhanVienId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `VaiTro` (
    `vaiTroId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenVaiTro` VARCHAR(50) NOT NULL,
    `moTa` VARCHAR(255) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `VaiTro_tenVaiTro_key`(`tenVaiTro`),
    PRIMARY KEY (`vaiTroId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Quyen` (
    `quyenId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenQuyen` VARCHAR(100) NOT NULL,
    `moTa` VARCHAR(255) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Quyen_tenQuyen_key`(`tenQuyen`),
    PRIMARY KEY (`quyenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TaiKhoanVaiTro` (
    `taiKhoanId` BIGINT NOT NULL,
    `vaiTroId` BIGINT NOT NULL,

    PRIMARY KEY (`taiKhoanId`, `vaiTroId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `VaiTroQuyen` (
    `vaiTroId` BIGINT NOT NULL,
    `quyenId` BIGINT NOT NULL,

    PRIMARY KEY (`vaiTroId`, `quyenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `KhuyenMai` (
    `khuyenMaiId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenChuongTrinh` VARCHAR(150) NOT NULL,
    `maKhuyenMai` VARCHAR(50) NULL,
    `phamViApDung` VARCHAR(30) NOT NULL,
    `hinhThucApDung` VARCHAR(30) NOT NULL,
    `loaiGiamGia` VARCHAR(30) NOT NULL,
    `giaTriGiam` DECIMAL(18, 2) NOT NULL,
    `giamToiDa` DECIMAL(18, 2) NULL,
    `giaTriDonToiThieu` DECIMAL(18, 2) NULL,
    `dieuKienApDung` VARCHAR(500) NULL,
    `tuNgay` DATE NOT NULL,
    `denNgay` DATE NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `KhuyenMai_index_6`(`nhaXeId`, `maKhuyenMai`),
    PRIMARY KEY (`khuyenMaiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `DonGiaoDich` (
    `donGiaoDichId` BIGINT NOT NULL AUTO_INCREMENT,
    `maDonGiaoDich` VARCHAR(50) NOT NULL,
    `ngayTao` DATETIME(0) NOT NULL,
    `tongTien` DECIMAL(18, 2) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `tenKhachHang` VARCHAR(100) NOT NULL,
    `soDienThoaiKhachHang` VARCHAR(16) NOT NULL,
    `emailKhachHang` VARCHAR(150) NULL,
    `khachHangId` BIGINT NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `DonGiaoDich_maDonGiaoDich_key`(`maDonGiaoDich`),
    PRIMARY KEY (`donGiaoDichId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PhieuDatVe` (
    `phieuDatVeId` BIGINT NOT NULL AUTO_INCREMENT,
    `maPhieuDatVe` VARCHAR(50) NOT NULL,
    `ngayDat` DATETIME(0) NOT NULL,
    `soLuongVeBanDau` INTEGER NOT NULL,
    `tongTienBanDau` DECIMAL(18, 2) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `khuyenMaiId` BIGINT NULL,
    `donGiaoDichId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `PhieuDatVe_maPhieuDatVe_key`(`maPhieuDatVe`),
    UNIQUE INDEX `PhieuDatVe_donGiaoDichId_key`(`donGiaoDichId`),
    PRIMARY KEY (`phieuDatVeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `Ve` (
    `veId` BIGINT NOT NULL AUTO_INCREMENT,
    `maVe` VARCHAR(50) NOT NULL,
    `diemDon` VARCHAR(255) NULL,
    `giaNiemYet` DECIMAL(18, 2) NOT NULL,
    `giaThucTe` DECIMAL(18, 2) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `phieuDatVeId` BIGINT NOT NULL,
    `gheChuyenXeId` BIGINT NOT NULL,
    `bangGiaApDungId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Ve_maVe_key`(`maVe`),
    PRIMARY KEY (`veId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `BuuCuc` (
    `buuCucId` BIGINT NOT NULL AUTO_INCREMENT,
    `maBuuCuc` VARCHAR(50) NOT NULL,
    `tenBuuCuc` VARCHAR(150) NOT NULL,
    `diaChi` VARCHAR(255) NOT NULL,
    `tinhThanh` VARCHAR(100) NOT NULL,
    `quanHuyen` VARCHAR(100) NULL,
    `phuongXa` VARCHAR(100) NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `nhaXeId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `BuuCuc_index_7`(`nhaXeId`, `maBuuCuc`),
    PRIMARY KEY (`buuCucId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `BangCuocGuiHang` (
    `bangCuocGuiHangId` BIGINT NOT NULL AUTO_INCREMENT,
    `khoiLuongTu` DECIMAL(10, 2) NOT NULL,
    `khoiLuongDen` DECIMAL(10, 2) NULL,
    `hinhThucLayHang` VARCHAR(30) NOT NULL,
    `hinhThucGiaoHang` VARCHAR(30) NOT NULL,
    `mucCuoc` DECIMAL(18, 2) NOT NULL,
    `tuNgay` DATE NOT NULL,
    `denNgay` DATE NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `buuCucGuiId` BIGINT NOT NULL,
    `buuCucPhatId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`bangCuocGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PhieuGuiHang` (
    `phieuGuiHangId` BIGINT NOT NULL AUTO_INCREMENT,
    `maVanDon` VARCHAR(50) NOT NULL,
    `tenNguoiNhan` VARCHAR(100) NOT NULL,
    `soDienThoaiNguoiNhan` VARCHAR(16) NOT NULL,
    `diaChiNguoiNhan` VARCHAR(255) NULL,
    `hinhThucLayHang` VARCHAR(30) NOT NULL,
    `hinhThucGiaoHang` VARCHAR(30) NOT NULL,
    `diaChiLayHang` VARCHAR(255) NULL,
    `ngayGui` DATETIME(0) NOT NULL,
    `cuocChinh` DECIMAL(18, 2) NOT NULL,
    `phiDichVu` DECIMAL(18, 2) NOT NULL,
    `soTienGiam` DECIMAL(18, 2) NOT NULL,
    `tongPhi` DECIMAL(18, 2) NOT NULL,
    `nguoiTraCuoc` VARCHAR(30) NOT NULL,
    `ghiChu` VARCHAR(500) NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `chuyenXeId` BIGINT NULL,
    `buuCucGuiId` BIGINT NULL,
    `buuCucPhatId` BIGINT NULL,
    `bangCuocApDungId` BIGINT NULL,
    `khuyenMaiId` BIGINT NULL,
    `donGiaoDichId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `PhieuGuiHang_maVanDon_key`(`maVanDon`),
    UNIQUE INDEX `PhieuGuiHang_donGiaoDichId_key`(`donGiaoDichId`),
    PRIMARY KEY (`phieuGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LoaiHangHoa` (
    `loaiHangHoaId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenLoai` VARCHAR(100) NOT NULL,
    `moTa` VARCHAR(500) NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `LoaiHangHoa_index_8`(`tenLoai`),
    PRIMARY KEY (`loaiHangHoaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `HangHoa` (
    `hangHoaId` BIGINT NOT NULL AUTO_INCREMENT,
    `tenHang` VARCHAR(150) NOT NULL,
    `soLuong` INTEGER NOT NULL,
    `khoiLuong` DECIMAL(10, 2) NOT NULL,
    `chieuDai` DECIMAL(10, 2) NULL,
    `chieuRong` DECIMAL(10, 2) NULL,
    `chieuCao` DECIMAL(10, 2) NULL,
    `giaTriKhaiBao` DECIMAL(18, 2) NULL,
    `moTa` VARCHAR(500) NULL,
    `phieuGuiHangId` BIGINT NOT NULL,
    `loaiHangHoaId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`hangHoaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `HinhAnhHangHoa` (
    `hinhAnhId` BIGINT NOT NULL AUTO_INCREMENT,
    `duongDan` VARCHAR(500) NOT NULL,
    `thuTu` INTEGER NULL,
    `hangHoaId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`hinhAnhId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ThanhToan` (
    `thanhToanId` BIGINT NOT NULL AUTO_INCREMENT,
    `soTien` DECIMAL(18, 2) NOT NULL,
    `phuongThuc` VARCHAR(30) NOT NULL,
    `loaiGiaoDich` VARCHAR(30) NOT NULL,
    `thoiGian` DATETIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `donGiaoDichId` BIGINT NOT NULL,
    `veId` BIGINT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`thanhToanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `HoaDon` (
    `hoaDonId` BIGINT NOT NULL AUTO_INCREMENT,
    `maHoaDon` VARCHAR(50) NOT NULL,
    `ngayLap` DATETIME(0) NOT NULL,
    `tongTien` DECIMAL(18, 2) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `donGiaoDichId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `HoaDon_maHoaDon_key`(`maHoaDon`),
    UNIQUE INDEX `HoaDon_donGiaoDichId_key`(`donGiaoDichId`),
    PRIMARY KEY (`hoaDonId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ThongBao` (
    `thongBaoId` BIGINT NOT NULL AUTO_INCREMENT,
    `tieuDe` VARCHAR(150) NOT NULL,
    `noiDung` TEXT NOT NULL,
    `thoiGian` DATETIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`thongBaoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `ThongBaoNguoiNhan` (
    `thongBaoNguoiNhanId` BIGINT NOT NULL AUTO_INCREMENT,
    `daDoc` BOOLEAN NOT NULL,
    `thoiGianDoc` DATETIME(0) NULL,
    `thongBaoId` BIGINT NOT NULL,
    `khachHangId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `ThongBaoNguoiNhan_index_9`(`thongBaoId`, `khachHangId`),
    PRIMARY KEY (`thongBaoNguoiNhanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `TinNhanHoTro` (
    `tinNhanId` BIGINT NOT NULL AUTO_INCREMENT,
    `noiDung` TEXT NOT NULL,
    `thoiGian` DATETIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `khachHangId` BIGINT NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`tinNhanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `PhanHoi` (
    `phanHoiId` BIGINT NOT NULL AUTO_INCREMENT,
    `mucDanhGia` INTEGER NOT NULL,
    `noiDung` VARCHAR(1000) NULL,
    `thoiGian` DATETIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `khachHangId` BIGINT NOT NULL,
    `chuyenXeId` BIGINT NULL,
    `phieuGuiHangId` BIGINT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`phanHoiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `Xe` ADD CONSTRAINT `Xe_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Xe` ADD CONSTRAINT `Xe_loaiXeId_fkey` FOREIGN KEY (`loaiXeId`) REFERENCES `LoaiXe`(`loaiXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Ghe` ADD CONSTRAINT `Ghe_xeId_fkey` FOREIGN KEY (`xeId`) REFERENCES `Xe`(`xeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TuyenXe` ADD CONSTRAINT `TuyenXe_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ChuyenXe` ADD CONSTRAINT `ChuyenXe_xeId_fkey` FOREIGN KEY (`xeId`) REFERENCES `Xe`(`xeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ChuyenXe` ADD CONSTRAINT `ChuyenXe_tuyenXeId_fkey` FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GheChuyenXe` ADD CONSTRAINT `GheChuyenXe_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GheChuyenXe` ADD CONSTRAINT `GheChuyenXe_gheId_fkey` FOREIGN KEY (`gheId`) REFERENCES `Ghe`(`gheId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BangGia` ADD CONSTRAINT `BangGia_tuyenXeId_fkey` FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BangGia` ADD CONSTRAINT `BangGia_loaiXeId_fkey` FOREIGN KEY (`loaiXeId`) REFERENCES `LoaiXe`(`loaiXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `KhachHang` ADD CONSTRAINT `KhachHang_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `NhanVien` ADD CONSTRAINT `NhanVien_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `NhanVien` ADD CONSTRAINT `NhanVien_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TaiKhoanVaiTro` ADD CONSTRAINT `TaiKhoanVaiTro_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TaiKhoanVaiTro` ADD CONSTRAINT `TaiKhoanVaiTro_vaiTroId_fkey` FOREIGN KEY (`vaiTroId`) REFERENCES `VaiTro`(`vaiTroId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `VaiTroQuyen` ADD CONSTRAINT `VaiTroQuyen_vaiTroId_fkey` FOREIGN KEY (`vaiTroId`) REFERENCES `VaiTro`(`vaiTroId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `VaiTroQuyen` ADD CONSTRAINT `VaiTroQuyen_quyenId_fkey` FOREIGN KEY (`quyenId`) REFERENCES `Quyen`(`quyenId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `KhuyenMai` ADD CONSTRAINT `KhuyenMai_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DonGiaoDich` ADD CONSTRAINT `DonGiaoDich_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DonGiaoDich` ADD CONSTRAINT `DonGiaoDich_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuDatVe` ADD CONSTRAINT `PhieuDatVe_donGiaoDichId_fkey` FOREIGN KEY (`donGiaoDichId`) REFERENCES `DonGiaoDich`(`donGiaoDichId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuDatVe` ADD CONSTRAINT `PhieuDatVe_khuyenMaiId_fkey` FOREIGN KEY (`khuyenMaiId`) REFERENCES `KhuyenMai`(`khuyenMaiId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Ve` ADD CONSTRAINT `Ve_phieuDatVeId_fkey` FOREIGN KEY (`phieuDatVeId`) REFERENCES `PhieuDatVe`(`phieuDatVeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Ve` ADD CONSTRAINT `Ve_gheChuyenXeId_fkey` FOREIGN KEY (`gheChuyenXeId`) REFERENCES `GheChuyenXe`(`gheChuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Ve` ADD CONSTRAINT `Ve_bangGiaApDungId_fkey` FOREIGN KEY (`bangGiaApDungId`) REFERENCES `BangGia`(`bangGiaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BuuCuc` ADD CONSTRAINT `BuuCuc_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BangCuocGuiHang` ADD CONSTRAINT `BangCuocGuiHang_buuCucGuiId_fkey` FOREIGN KEY (`buuCucGuiId`) REFERENCES `BuuCuc`(`buuCucId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BangCuocGuiHang` ADD CONSTRAINT `BangCuocGuiHang_buuCucPhatId_fkey` FOREIGN KEY (`buuCucPhatId`) REFERENCES `BuuCuc`(`buuCucId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_donGiaoDichId_fkey` FOREIGN KEY (`donGiaoDichId`) REFERENCES `DonGiaoDich`(`donGiaoDichId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_buuCucGuiId_fkey` FOREIGN KEY (`buuCucGuiId`) REFERENCES `BuuCuc`(`buuCucId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_buuCucPhatId_fkey` FOREIGN KEY (`buuCucPhatId`) REFERENCES `BuuCuc`(`buuCucId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_bangCuocApDungId_fkey` FOREIGN KEY (`bangCuocApDungId`) REFERENCES `BangCuocGuiHang`(`bangCuocGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_khuyenMaiId_fkey` FOREIGN KEY (`khuyenMaiId`) REFERENCES `KhuyenMai`(`khuyenMaiId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `HangHoa` ADD CONSTRAINT `HangHoa_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `HangHoa` ADD CONSTRAINT `HangHoa_loaiHangHoaId_fkey` FOREIGN KEY (`loaiHangHoaId`) REFERENCES `LoaiHangHoa`(`loaiHangHoaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `HinhAnhHangHoa` ADD CONSTRAINT `HinhAnhHangHoa_hangHoaId_fkey` FOREIGN KEY (`hangHoaId`) REFERENCES `HangHoa`(`hangHoaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ThanhToan` ADD CONSTRAINT `ThanhToan_donGiaoDichId_fkey` FOREIGN KEY (`donGiaoDichId`) REFERENCES `DonGiaoDich`(`donGiaoDichId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ThanhToan` ADD CONSTRAINT `ThanhToan_veId_fkey` FOREIGN KEY (`veId`) REFERENCES `Ve`(`veId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `HoaDon` ADD CONSTRAINT `HoaDon_donGiaoDichId_fkey` FOREIGN KEY (`donGiaoDichId`) REFERENCES `DonGiaoDich`(`donGiaoDichId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ThongBaoNguoiNhan` ADD CONSTRAINT `ThongBaoNguoiNhan_thongBaoId_fkey` FOREIGN KEY (`thongBaoId`) REFERENCES `ThongBao`(`thongBaoId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ThongBaoNguoiNhan` ADD CONSTRAINT `ThongBaoNguoiNhan_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhanHoi` ADD CONSTRAINT `PhanHoi_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhanHoi` ADD CONSTRAINT `PhanHoi_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhanHoi` ADD CONSTRAINT `PhanHoi_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Preserve the SQL CHECK constraints that Prisma schema cannot express.
ALTER TABLE `PhanHoi`
    ADD CONSTRAINT `chk_PhanHoi_DoiTuong`
    CHECK (
      (`chuyenXeId` IS NOT NULL AND `phieuGuiHangId` IS NULL)
      OR
      (`chuyenXeId` IS NULL AND `phieuGuiHangId` IS NOT NULL)
    );

ALTER TABLE `PhanHoi`
    ADD CONSTRAINT `chk_PhanHoi_MucDanhGia`
    CHECK (`mucDanhGia` BETWEEN 1 AND 5);
