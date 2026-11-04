-- DropForeignKey
ALTER TABLE `LichSuDieuChinhCuocGuiHang` DROP FOREIGN KEY `LichSuDieuChinhCuocGuiHang_phieuGuiHangId_fkey`;

-- DropForeignKey
ALTER TABLE `LichSuDieuChinhCuocGuiHang` DROP FOREIGN KEY `LichSuDieuChinhCuocGuiHang_taiKhoanId_fkey`;

-- DropForeignKey
ALTER TABLE `XuLyTienGuiHang` DROP FOREIGN KEY `XuLyTienGuiHang_phieuGuiHangId_fkey`;

-- DropForeignKey
ALTER TABLE `XuLyTienGuiHang` DROP FOREIGN KEY `XuLyTienGuiHang_taiKhoanXuLyId_fkey`;

-- DropForeignKey
ALTER TABLE `XuLyTienGuiHang` DROP FOREIGN KEY `XuLyTienGuiHang_thanhToanId_fkey`;

-- DropTable
DROP TABLE `LichSuDieuChinhCuocGuiHang`;

-- DropTable
DROP TABLE `XuLyTienGuiHang`;
