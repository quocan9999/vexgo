-- AlterTable TaiKhoan: make hoTen nullable
ALTER TABLE `TaiKhoan` MODIFY `hoTen` VARCHAR(100) NULL;

-- AlterTable KhachHang: add profile fields
ALTER TABLE `KhachHang` 
  ADD COLUMN `hoTen` VARCHAR(100) NULL,
  ADD COLUMN `ngaySinh` DATE NULL,
  ADD COLUMN `gioiTinh` VARCHAR(10) NULL,
  ADD COLUMN `diaChi` VARCHAR(255) NULL;

-- AlterTable NhanVien: add staff profile fields, chucVu, ngayVaoLam, ngayNghiViec
ALTER TABLE `NhanVien` 
  ADD COLUMN `hoTen` VARCHAR(100) NULL,
  ADD COLUMN `cccd` CHAR(12) NULL,
  ADD COLUMN `ngaySinh` DATE NULL,
  ADD COLUMN `gioiTinh` VARCHAR(10) NULL,
  ADD COLUMN `chucVu` VARCHAR(50) NULL,
  ADD COLUMN `ngayVaoLam` DATE NULL,
  ADD COLUMN `ngayNghiViec` DATE NULL;

-- Backfill data from TaiKhoan to KhachHang
UPDATE `KhachHang` k
JOIN `TaiKhoan` t ON k.`taiKhoanId` = t.`taiKhoanId`
SET 
  k.`hoTen` = t.`hoTen`,
  k.`ngaySinh` = t.`ngaySinh`;

-- Backfill data from TaiKhoan to NhanVien
UPDATE `NhanVien` n
JOIN `TaiKhoan` t ON n.`taiKhoanId` = t.`taiKhoanId`
SET 
  n.`hoTen` = t.`hoTen`,
  n.`cccd` = t.`cccd`,
  n.`ngaySinh` = t.`ngaySinh`;
