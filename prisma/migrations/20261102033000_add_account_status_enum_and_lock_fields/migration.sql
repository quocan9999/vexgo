-- Convert trangThai column to ENUM and add lock management fields to TaiKhoan

START TRANSACTION;

-- Ensure all existing rows have valid enum values before altering column type
UPDATE `TaiKhoan`
SET `trangThai` = 'HOAT_DONG'
WHERE `trangThai` NOT IN ('HOAT_DONG', 'TAM_KHOA', 'BI_KHOA') OR `trangThai` IS NULL;

-- Alter column trangThai to ENUM
ALTER TABLE `TaiKhoan`
  MODIFY COLUMN `trangThai` ENUM('HOAT_DONG', 'TAM_KHOA', 'BI_KHOA') NOT NULL DEFAULT 'HOAT_DONG',
  ADD COLUMN `khoaDenNgay` DATE NULL AFTER `trangThai`,
  ADD COLUMN `lyDoKhoa` VARCHAR(255) NULL AFTER `khoaDenNgay`;

COMMIT;
