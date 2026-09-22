/*
  Warnings:

  - The primary key for the `BangCuocGuiHang` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `bangCuocGuiHangId` on the `BangCuocGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `buuCucGuiId` on the `BangCuocGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `buuCucPhatId` on the `BangCuocGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `BangGia` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `bangGiaId` on the `BangGia` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `tuyenXeId` on the `BangGia` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `loaiXeId` on the `BangGia` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `BuuCuc` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `buuCucId` on the `BuuCuc` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `BuuCuc` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `ChuyenXe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `chuyenXeId` on the `ChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `tuyenXeId` on the `ChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `xeId` on the `ChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `DonGiaoDich` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `donGiaoDichId` on the `DonGiaoDich` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khachHangId` on the `DonGiaoDich` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `DonGiaoDich` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `Ghe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `gheId` on the `Ghe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `xeId` on the `Ghe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `GheChuyenXe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `gheChuyenXeId` on the `GheChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `chuyenXeId` on the `GheChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `gheId` on the `GheChuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `HangHoa` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `hangHoaId` on the `HangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `phieuGuiHangId` on the `HangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `loaiHangHoaId` on the `HangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `HinhAnhHangHoa` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `hinhAnhId` on the `HinhAnhHangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `hangHoaId` on the `HinhAnhHangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `HoaDon` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `hoaDonId` on the `HoaDon` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `donGiaoDichId` on the `HoaDon` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `KhachHang` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `khachHangId` on the `KhachHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `taiKhoanId` on the `KhachHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `KhuyenMai` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `khuyenMaiId` on the `KhuyenMai` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `KhuyenMai` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `LoaiHangHoa` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `loaiHangHoaId` on the `LoaiHangHoa` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `LoaiXe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `loaiXeId` on the `LoaiXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `NhaXe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `nhaXeId` on the `NhaXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `NhanVien` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `nhanVienId` on the `NhanVien` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `NhanVien` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `taiKhoanId` on the `NhanVien` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `PhanHoi` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `phanHoiId` on the `PhanHoi` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khachHangId` on the `PhanHoi` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `chuyenXeId` on the `PhanHoi` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `phieuGuiHangId` on the `PhanHoi` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `PhieuDatVe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `phieuDatVeId` on the `PhieuDatVe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khuyenMaiId` on the `PhieuDatVe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `donGiaoDichId` on the `PhieuDatVe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `PhieuGuiHang` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `phieuGuiHangId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `chuyenXeId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `buuCucGuiId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `buuCucPhatId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `bangCuocApDungId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khuyenMaiId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `donGiaoDichId` on the `PhieuGuiHang` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `Quyen` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `quyenId` on the `Quyen` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TaiKhoan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `taiKhoanId` on the `TaiKhoan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TaiKhoanVaiTro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `taiKhoanId` on the `TaiKhoanVaiTro` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `vaiTroId` on the `TaiKhoanVaiTro` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `ThanhToan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `thanhToanId` on the `ThanhToan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `donGiaoDichId` on the `ThanhToan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `veId` on the `ThanhToan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `ThongBao` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `thongBaoId` on the `ThongBao` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `ThongBaoNguoiNhan` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `thongBaoNguoiNhanId` on the `ThongBaoNguoiNhan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `thongBaoId` on the `ThongBaoNguoiNhan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khachHangId` on the `ThongBaoNguoiNhan` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TinNhanHoTro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `tinNhanId` on the `TinNhanHoTro` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `khachHangId` on the `TinNhanHoTro` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `TuyenXe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `tuyenXeId` on the `TuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `TuyenXe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `VaiTro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `vaiTroId` on the `VaiTro` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `VaiTroQuyen` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `vaiTroId` on the `VaiTroQuyen` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `quyenId` on the `VaiTroQuyen` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `Ve` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `veId` on the `Ve` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `phieuDatVeId` on the `Ve` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `gheChuyenXeId` on the `Ve` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `bangGiaApDungId` on the `Ve` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `Xe` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `xeId` on the `Xe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `nhaXeId` on the `Xe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `loaiXeId` on the `Xe` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `BangCuocGuiHang` DROP FOREIGN KEY `BangCuocGuiHang_buuCucGuiId_fkey`;

-- DropForeignKey
ALTER TABLE `BangCuocGuiHang` DROP FOREIGN KEY `BangCuocGuiHang_buuCucPhatId_fkey`;

-- DropForeignKey
ALTER TABLE `BangGia` DROP FOREIGN KEY `BangGia_loaiXeId_fkey`;

-- DropForeignKey
ALTER TABLE `BangGia` DROP FOREIGN KEY `BangGia_tuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `BuuCuc` DROP FOREIGN KEY `BuuCuc_nhaXeId_fkey`;

-- DropForeignKey
ALTER TABLE `ChuyenXe` DROP FOREIGN KEY `ChuyenXe_tuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `ChuyenXe` DROP FOREIGN KEY `ChuyenXe_xeId_fkey`;

-- DropForeignKey
ALTER TABLE `DonGiaoDich` DROP FOREIGN KEY `DonGiaoDich_khachHangId_fkey`;

-- DropForeignKey
ALTER TABLE `DonGiaoDich` DROP FOREIGN KEY `DonGiaoDich_nhaXeId_fkey`;

-- DropForeignKey
ALTER TABLE `Ghe` DROP FOREIGN KEY `Ghe_xeId_fkey`;

-- DropForeignKey
ALTER TABLE `GheChuyenXe` DROP FOREIGN KEY `GheChuyenXe_chuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `GheChuyenXe` DROP FOREIGN KEY `GheChuyenXe_gheId_fkey`;

-- DropForeignKey
ALTER TABLE `HangHoa` DROP FOREIGN KEY `HangHoa_loaiHangHoaId_fkey`;

-- DropForeignKey
ALTER TABLE `HangHoa` DROP FOREIGN KEY `HangHoa_phieuGuiHangId_fkey`;

-- DropForeignKey
ALTER TABLE `HinhAnhHangHoa` DROP FOREIGN KEY `HinhAnhHangHoa_hangHoaId_fkey`;

-- DropForeignKey
ALTER TABLE `HoaDon` DROP FOREIGN KEY `HoaDon_donGiaoDichId_fkey`;

-- DropForeignKey
ALTER TABLE `KhachHang` DROP FOREIGN KEY `KhachHang_taiKhoanId_fkey`;

-- DropForeignKey
ALTER TABLE `KhuyenMai` DROP FOREIGN KEY `KhuyenMai_nhaXeId_fkey`;

-- DropForeignKey
ALTER TABLE `NhanVien` DROP FOREIGN KEY `NhanVien_nhaXeId_fkey`;

-- DropForeignKey
ALTER TABLE `NhanVien` DROP FOREIGN KEY `NhanVien_taiKhoanId_fkey`;

-- DropForeignKey
ALTER TABLE `PhanHoi` DROP FOREIGN KEY `PhanHoi_chuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `PhanHoi` DROP FOREIGN KEY `PhanHoi_khachHangId_fkey`;

-- DropForeignKey
ALTER TABLE `PhanHoi` DROP FOREIGN KEY `PhanHoi_phieuGuiHangId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuDatVe` DROP FOREIGN KEY `PhieuDatVe_donGiaoDichId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuDatVe` DROP FOREIGN KEY `PhieuDatVe_khuyenMaiId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_bangCuocApDungId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_buuCucGuiId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_buuCucPhatId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_chuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_donGiaoDichId_fkey`;

-- DropForeignKey
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_khuyenMaiId_fkey`;

-- DropForeignKey
ALTER TABLE `TaiKhoanVaiTro` DROP FOREIGN KEY `TaiKhoanVaiTro_taiKhoanId_fkey`;

-- DropForeignKey
ALTER TABLE `TaiKhoanVaiTro` DROP FOREIGN KEY `TaiKhoanVaiTro_vaiTroId_fkey`;

-- DropForeignKey
ALTER TABLE `ThanhToan` DROP FOREIGN KEY `ThanhToan_donGiaoDichId_fkey`;

-- DropForeignKey
ALTER TABLE `ThanhToan` DROP FOREIGN KEY `ThanhToan_veId_fkey`;

-- DropForeignKey
ALTER TABLE `ThongBaoNguoiNhan` DROP FOREIGN KEY `ThongBaoNguoiNhan_khachHangId_fkey`;

-- DropForeignKey
ALTER TABLE `ThongBaoNguoiNhan` DROP FOREIGN KEY `ThongBaoNguoiNhan_thongBaoId_fkey`;

-- DropForeignKey
ALTER TABLE `TinNhanHoTro` DROP FOREIGN KEY `TinNhanHoTro_khachHangId_fkey`;

-- DropForeignKey
ALTER TABLE `TuyenXe` DROP FOREIGN KEY `TuyenXe_nhaXeId_fkey`;

-- DropForeignKey
ALTER TABLE `VaiTroQuyen` DROP FOREIGN KEY `VaiTroQuyen_quyenId_fkey`;

-- DropForeignKey
ALTER TABLE `VaiTroQuyen` DROP FOREIGN KEY `VaiTroQuyen_vaiTroId_fkey`;

-- DropForeignKey
ALTER TABLE `Ve` DROP FOREIGN KEY `Ve_bangGiaApDungId_fkey`;

-- DropForeignKey
ALTER TABLE `Ve` DROP FOREIGN KEY `Ve_gheChuyenXeId_fkey`;

-- DropForeignKey
ALTER TABLE `Ve` DROP FOREIGN KEY `Ve_phieuDatVeId_fkey`;

-- DropForeignKey
ALTER TABLE `Xe` DROP FOREIGN KEY `Xe_loaiXeId_fkey`;

-- DropForeignKey
ALTER TABLE `Xe` DROP FOREIGN KEY `Xe_nhaXeId_fkey`;

-- DropIndex
DROP INDEX `BangCuocGuiHang_buuCucGuiId_fkey` ON `BangCuocGuiHang`;

-- DropIndex
DROP INDEX `BangCuocGuiHang_buuCucPhatId_fkey` ON `BangCuocGuiHang`;

-- DropIndex
DROP INDEX `BangGia_loaiXeId_fkey` ON `BangGia`;

-- DropIndex
DROP INDEX `ChuyenXe_tuyenXeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `ChuyenXe_xeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `DonGiaoDich_khachHangId_fkey` ON `DonGiaoDich`;

-- DropIndex
DROP INDEX `DonGiaoDich_nhaXeId_fkey` ON `DonGiaoDich`;

-- DropIndex
DROP INDEX `GheChuyenXe_gheId_fkey` ON `GheChuyenXe`;

-- DropIndex
DROP INDEX `HangHoa_loaiHangHoaId_fkey` ON `HangHoa`;

-- DropIndex
DROP INDEX `HangHoa_phieuGuiHangId_fkey` ON `HangHoa`;

-- DropIndex
DROP INDEX `HinhAnhHangHoa_hangHoaId_fkey` ON `HinhAnhHangHoa`;

-- DropIndex
DROP INDEX `PhanHoi_chuyenXeId_fkey` ON `PhanHoi`;

-- DropIndex
DROP INDEX `PhanHoi_khachHangId_fkey` ON `PhanHoi`;

-- DropIndex
DROP INDEX `PhanHoi_phieuGuiHangId_fkey` ON `PhanHoi`;

-- DropIndex
DROP INDEX `PhieuDatVe_khuyenMaiId_fkey` ON `PhieuDatVe`;

-- DropIndex
DROP INDEX `PhieuGuiHang_bangCuocApDungId_fkey` ON `PhieuGuiHang`;

-- DropIndex
DROP INDEX `PhieuGuiHang_buuCucGuiId_fkey` ON `PhieuGuiHang`;

-- DropIndex
DROP INDEX `PhieuGuiHang_buuCucPhatId_fkey` ON `PhieuGuiHang`;

-- DropIndex
DROP INDEX `PhieuGuiHang_chuyenXeId_fkey` ON `PhieuGuiHang`;

-- DropIndex
DROP INDEX `PhieuGuiHang_khuyenMaiId_fkey` ON `PhieuGuiHang`;

-- DropIndex
DROP INDEX `TaiKhoanVaiTro_vaiTroId_fkey` ON `TaiKhoanVaiTro`;

-- DropIndex
DROP INDEX `ThanhToan_donGiaoDichId_fkey` ON `ThanhToan`;

-- DropIndex
DROP INDEX `ThanhToan_veId_fkey` ON `ThanhToan`;

-- DropIndex
DROP INDEX `ThongBaoNguoiNhan_khachHangId_fkey` ON `ThongBaoNguoiNhan`;

-- DropIndex
DROP INDEX `TinNhanHoTro_khachHangId_fkey` ON `TinNhanHoTro`;

-- DropIndex
DROP INDEX `VaiTroQuyen_quyenId_fkey` ON `VaiTroQuyen`;

-- DropIndex
DROP INDEX `Ve_bangGiaApDungId_fkey` ON `Ve`;

-- DropIndex
DROP INDEX `Ve_gheChuyenXeId_fkey` ON `Ve`;

-- DropIndex
DROP INDEX `Ve_phieuDatVeId_fkey` ON `Ve`;

-- DropIndex
DROP INDEX `Xe_loaiXeId_fkey` ON `Xe`;

-- DropIndex
DROP INDEX `Xe_nhaXeId_fkey` ON `Xe`;

-- AlterTable
ALTER TABLE `BangCuocGuiHang` DROP PRIMARY KEY,
    MODIFY `bangCuocGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `buuCucGuiId` INTEGER NOT NULL,
    MODIFY `buuCucPhatId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`bangCuocGuiHangId`);

-- AlterTable
ALTER TABLE `BangGia` DROP PRIMARY KEY,
    MODIFY `bangGiaId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `tuyenXeId` INTEGER NOT NULL,
    MODIFY `loaiXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`bangGiaId`);

-- AlterTable
ALTER TABLE `BuuCuc` DROP PRIMARY KEY,
    MODIFY `buuCucId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`buuCucId`);

-- AlterTable
ALTER TABLE `ChuyenXe` DROP PRIMARY KEY,
    MODIFY `chuyenXeId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `tuyenXeId` INTEGER NOT NULL,
    MODIFY `xeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`chuyenXeId`);

-- AlterTable
ALTER TABLE `DonGiaoDich` DROP PRIMARY KEY,
    MODIFY `donGiaoDichId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `khachHangId` INTEGER NOT NULL,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`donGiaoDichId`);

-- AlterTable
ALTER TABLE `Ghe` DROP PRIMARY KEY,
    MODIFY `gheId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `xeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`gheId`);

-- AlterTable
ALTER TABLE `GheChuyenXe` DROP PRIMARY KEY,
    MODIFY `gheChuyenXeId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `chuyenXeId` INTEGER NOT NULL,
    MODIFY `gheId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`gheChuyenXeId`);

-- AlterTable
ALTER TABLE `HangHoa` DROP PRIMARY KEY,
    MODIFY `hangHoaId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `phieuGuiHangId` INTEGER NOT NULL,
    MODIFY `loaiHangHoaId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`hangHoaId`);

-- AlterTable
ALTER TABLE `HinhAnhHangHoa` DROP PRIMARY KEY,
    MODIFY `hinhAnhId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `hangHoaId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`hinhAnhId`);

-- AlterTable
ALTER TABLE `HoaDon` DROP PRIMARY KEY,
    MODIFY `hoaDonId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `donGiaoDichId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`hoaDonId`);

-- AlterTable
ALTER TABLE `KhachHang` DROP PRIMARY KEY,
    MODIFY `khachHangId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `taiKhoanId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`khachHangId`);

-- AlterTable
ALTER TABLE `KhuyenMai` DROP PRIMARY KEY,
    MODIFY `khuyenMaiId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`khuyenMaiId`);

-- AlterTable
ALTER TABLE `LoaiHangHoa` DROP PRIMARY KEY,
    MODIFY `loaiHangHoaId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`loaiHangHoaId`);

-- AlterTable
ALTER TABLE `LoaiXe` DROP PRIMARY KEY,
    MODIFY `loaiXeId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`loaiXeId`);

-- AlterTable
ALTER TABLE `NhaXe` DROP PRIMARY KEY,
    MODIFY `nhaXeId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`nhaXeId`);

-- AlterTable
ALTER TABLE `NhanVien` DROP PRIMARY KEY,
    MODIFY `nhanVienId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    MODIFY `taiKhoanId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`nhanVienId`);

-- AlterTable
ALTER TABLE `PhanHoi` DROP PRIMARY KEY,
    MODIFY `phanHoiId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `khachHangId` INTEGER NOT NULL,
    MODIFY `chuyenXeId` INTEGER NULL,
    MODIFY `phieuGuiHangId` INTEGER NULL,
    ADD PRIMARY KEY (`phanHoiId`);

-- AlterTable
ALTER TABLE `PhieuDatVe` DROP PRIMARY KEY,
    MODIFY `phieuDatVeId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `khuyenMaiId` INTEGER NULL,
    MODIFY `donGiaoDichId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`phieuDatVeId`);

-- AlterTable
ALTER TABLE `PhieuGuiHang` DROP PRIMARY KEY,
    MODIFY `phieuGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `chuyenXeId` INTEGER NULL,
    MODIFY `buuCucGuiId` INTEGER NULL,
    MODIFY `buuCucPhatId` INTEGER NULL,
    MODIFY `bangCuocApDungId` INTEGER NULL,
    MODIFY `khuyenMaiId` INTEGER NULL,
    MODIFY `donGiaoDichId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`phieuGuiHangId`);

-- AlterTable
ALTER TABLE `Quyen` DROP PRIMARY KEY,
    MODIFY `quyenId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`quyenId`);

-- AlterTable
ALTER TABLE `TaiKhoan` DROP PRIMARY KEY,
    MODIFY `taiKhoanId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`taiKhoanId`);

-- AlterTable
ALTER TABLE `TaiKhoanVaiTro` DROP PRIMARY KEY,
    MODIFY `taiKhoanId` INTEGER NOT NULL,
    MODIFY `vaiTroId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`taiKhoanId`, `vaiTroId`);

-- AlterTable
ALTER TABLE `ThanhToan` DROP PRIMARY KEY,
    MODIFY `thanhToanId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `donGiaoDichId` INTEGER NOT NULL,
    MODIFY `veId` INTEGER NULL,
    ADD PRIMARY KEY (`thanhToanId`);

-- AlterTable
ALTER TABLE `ThongBao` DROP PRIMARY KEY,
    MODIFY `thongBaoId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`thongBaoId`);

-- AlterTable
ALTER TABLE `ThongBaoNguoiNhan` DROP PRIMARY KEY,
    MODIFY `thongBaoNguoiNhanId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `thongBaoId` INTEGER NOT NULL,
    MODIFY `khachHangId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`thongBaoNguoiNhanId`);

-- AlterTable
ALTER TABLE `TinNhanHoTro` DROP PRIMARY KEY,
    MODIFY `tinNhanId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `khachHangId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`tinNhanId`);

-- AlterTable
ALTER TABLE `TuyenXe` DROP PRIMARY KEY,
    MODIFY `tuyenXeId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`tuyenXeId`);

-- AlterTable
ALTER TABLE `VaiTro` DROP PRIMARY KEY,
    MODIFY `vaiTroId` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`vaiTroId`);

-- AlterTable
ALTER TABLE `VaiTroQuyen` DROP PRIMARY KEY,
    MODIFY `vaiTroId` INTEGER NOT NULL,
    MODIFY `quyenId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`vaiTroId`, `quyenId`);

-- AlterTable
ALTER TABLE `Ve` DROP PRIMARY KEY,
    MODIFY `veId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `phieuDatVeId` INTEGER NOT NULL,
    MODIFY `gheChuyenXeId` INTEGER NOT NULL,
    MODIFY `bangGiaApDungId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`veId`);

-- AlterTable
ALTER TABLE `Xe` DROP PRIMARY KEY,
    MODIFY `xeId` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `nhaXeId` INTEGER NOT NULL,
    MODIFY `loaiXeId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`xeId`);

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
