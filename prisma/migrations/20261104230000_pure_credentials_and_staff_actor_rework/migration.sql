-- 1. AlterTable KhachHang: add cccd
ALTER TABLE `KhachHang` ADD COLUMN `cccd` CHAR(12) NULL;

-- 2. Backfill cccd, hoTen, ngaySinh from TaiKhoan to KhachHang
UPDATE `KhachHang` k
JOIN `TaiKhoan` t ON k.`taiKhoanId` = t.`taiKhoanId`
SET 
  k.`cccd` = t.`cccd`,
  k.`hoTen` = COALESCE(k.`hoTen`, t.`hoTen`),
  k.`ngaySinh` = COALESCE(k.`ngaySinh`, t.`ngaySinh`);

-- 3. Backfill hoTen, cccd, ngaySinh from TaiKhoan to NhanVien
UPDATE `NhanVien` n
JOIN `TaiKhoan` t ON n.`taiKhoanId` = t.`taiKhoanId`
SET 
  n.`hoTen` = COALESCE(n.`hoTen`, t.`hoTen`),
  n.`cccd` = COALESCE(n.`cccd`, t.`cccd`),
  n.`ngaySinh` = COALESCE(n.`ngaySinh`, t.`ngaySinh`);

-- 4. AlterTable NhanVien: modify nhaXeId to NULL
ALTER TABLE `NhanVien` MODIFY `nhaXeId` INT NULL;

-- 5. Create Staff Profile for SUPER_ADMIN if not already exists
INSERT INTO `NhanVien` (`maNhanVien`, `hoTen`, `cccd`, `ngaySinh`, `chucVu`, `ngayVaoLam`, `trangThaiLamViec`, `nhaXeId`, `taiKhoanId`, `createdAt`, `updatedAt`)
SELECT 
  'e4b3f81d4fae4d60a16b9b218b056501',
  t.`hoTen`,
  t.`cccd`,
  t.`ngaySinh`,
  'Quản trị hệ thống',
  DATE('2025-01-01'),
  'DANG_LAM_VIEC',
  NULL,
  t.`taiKhoanId`,
  NOW(),
  NOW()
FROM `TaiKhoan` t
JOIN `TaiKhoanVaiTro` tv ON tv.`taiKhoanId` = t.`taiKhoanId`
JOIN `VaiTro` v ON v.`vaiTroId` = tv.`vaiTroId` AND v.`tenVaiTro` = 'SUPER_ADMIN'
LEFT JOIN `NhanVien` n ON n.`taiKhoanId` = t.`taiKhoanId`
WHERE n.`nhanVienId` IS NULL;

-- 6. AlterTable PhieuGuiHang: replace taiKhoanXacNhanCuocId with nhanVienXacNhanCuocId
ALTER TABLE `PhieuGuiHang` DROP FOREIGN KEY `PhieuGuiHang_taiKhoanXacNhanCuocId_fkey`;
ALTER TABLE `PhieuGuiHang` DROP COLUMN `taiKhoanXacNhanCuocId`;
ALTER TABLE `PhieuGuiHang` ADD COLUMN `nhanVienXacNhanCuocId` INT NULL;
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_nhanVienXacNhanCuocId_fkey` FOREIGN KEY (`nhanVienXacNhanCuocId`) REFERENCES `NhanVien`(`nhanVienId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 7. AlterTable ThanhToan: replace taiKhoanXacNhanId with nhanVienXacNhanId
ALTER TABLE `ThanhToan` DROP FOREIGN KEY `ThanhToan_taiKhoanXacNhanId_fkey`;
ALTER TABLE `ThanhToan` DROP COLUMN `taiKhoanXacNhanId`;
ALTER TABLE `ThanhToan` ADD COLUMN `nhanVienXacNhanId` INT NULL;
ALTER TABLE `ThanhToan` ADD CONSTRAINT `ThanhToan_nhanVienXacNhanId_fkey` FOREIGN KEY (`nhanVienXacNhanId`) REFERENCES `NhanVien`(`nhanVienId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 8. AlterTable TaiKhoan: drop profile columns
ALTER TABLE `TaiKhoan`
  DROP COLUMN `hoTen`,
  DROP COLUMN `ngaySinh`,
  DROP COLUMN `cccd`;
