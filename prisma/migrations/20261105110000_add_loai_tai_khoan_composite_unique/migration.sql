-- AlterTable TaiKhoan: add loaiTaiKhoan, backfill QUAN_TRI, replace single-column unique indexes with composite unique indexes

START TRANSACTION;

-- 1. Add column loaiTaiKhoan
ALTER TABLE `TaiKhoan`
  ADD COLUMN `loaiTaiKhoan` ENUM('KHACH_HANG', 'QUAN_TRI') NOT NULL DEFAULT 'KHACH_HANG' AFTER `email`;

-- 2. Backfill existing admin and staff accounts to QUAN_TRI
UPDATE `TaiKhoan`
SET `loaiTaiKhoan` = 'QUAN_TRI'
WHERE `taiKhoanId` IN (SELECT `taiKhoanId` FROM `NhanVien`)
   OR `taiKhoanId` IN (
     SELECT tkvt.`taiKhoanId`
     FROM `TaiKhoanVaiTro` tkvt
     INNER JOIN `VaiTro` vt ON vt.`vaiTroId` = tkvt.`vaiTroId`
     WHERE vt.`tenVaiTro` IN (
       'SUPER_ADMIN',
       'NHA_XE_ADMIN',
       'NHAN_VIEN_DIEU_HANH',
       'NHAN_VIEN_BAN_VE',
       'NHAN_VIEN_CSKH',
       'NHAN_VIEN_PHU_XE',
       'NHAN_VIEN_KINH_DOANH'
     )
   );

-- 3. Drop single-column unique indexes
DROP INDEX `TaiKhoan_soDienThoai_key` ON `TaiKhoan`;
DROP INDEX `TaiKhoan_email_key` ON `TaiKhoan`;

-- 4. Create composite unique indexes per loaiTaiKhoan
CREATE UNIQUE INDEX `TaiKhoan_soDienThoai_loaiTaiKhoan_key` ON `TaiKhoan`(`soDienThoai`, `loaiTaiKhoan`);
CREATE UNIQUE INDEX `TaiKhoan_email_loaiTaiKhoan_key` ON `TaiKhoan`(`email`, `loaiTaiKhoan`);

COMMIT;
