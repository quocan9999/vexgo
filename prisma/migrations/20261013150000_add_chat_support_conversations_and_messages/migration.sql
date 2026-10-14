-- 1. Preflight Archive: Lưu trữ toàn bộ dữ liệu lịch sử trước khi thay đổi cấu trúc bảng
CREATE TABLE IF NOT EXISTS `LuuTruTinNhanHoTroCu` (
    `tinNhanId` INTEGER NOT NULL,
    `noiDung` TEXT NOT NULL,
    `thoiGianCu` DATETIME(0) NOT NULL,
    `trangThaiCu` VARCHAR(30) NOT NULL,
    `khachHangIdCu` INTEGER NOT NULL,
    `createdAtCu` DATETIME(0) NOT NULL,
    `updatedAtCu` DATETIME(0) NOT NULL,
    `archivedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`tinNhanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `LuuTruTinNhanHoTroCu` (
    `tinNhanId`, `noiDung`, `thoiGianCu`, `trangThaiCu`, `khachHangIdCu`, `createdAtCu`, `updatedAtCu`
)
SELECT `tinNhanId`, `noiDung`, `thoiGian`, `trangThai`, `khachHangId`, `createdAt`, `updatedAt`
FROM `TinNhanHoTro`;

-- 2. Tạo bảng CuocTroChuyen
CREATE TABLE IF NOT EXISTS `CuocTroChuyen` (
    `cuocTroChuyenId` INTEGER NOT NULL AUTO_INCREMENT,
    `maCuocTroChuyen` VARCHAR(50) NOT NULL,
    `tieuDe` VARCHAR(255) NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'CHO_TIEP_NHAN',
    `kenhHoTro` VARCHAR(20) NOT NULL DEFAULT 'WEB',
    `cheDoChat` VARCHAR(30) NOT NULL DEFAULT 'NGUOI_THAT',
    `khachHangId` INTEGER NOT NULL,
    `nhanVienId` INTEGER NULL,
    `nhaXeId` INTEGER NOT NULL,
    `dongLuc` DATETIME(0) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `CuocTroChuyen_maCuocTroChuyen_key`(`maCuocTroChuyen`),
    INDEX `CuocTroChuyen_nhaXe_trangThai_idx`(`nhaXeId`, `trangThai`),
    INDEX `CuocTroChuyen_khachHang_trangThai_idx`(`khachHangId`, `trangThai`),
    INDEX `CuocTroChuyen_nhanVien_trangThai_idx`(`nhanVienId`, `trangThai`),
    PRIMARY KEY (`cuocTroChuyenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Expand: Bổ sung các cột mới dạng NULL để an toàn với dữ liệu cũ
ALTER TABLE `TinNhanHoTro`
    ADD COLUMN `cuocTroChuyenId` INTEGER NULL,
    ADD COLUMN `taiKhoanGuiId` INTEGER NULL,
    ADD COLUMN `loaiNguoiGui` VARCHAR(30) NULL,
    ADD COLUMN `loaiTinNhan` VARCHAR(30) NOT NULL DEFAULT 'VAN_BAN',
    ADD COLUMN `clientMessageId` VARCHAR(64) NULL,
    ADD COLUMN `tepDinhKemUrl` VARCHAR(500) NULL,
    ADD COLUMN `daDocLuc` DATETIME(0) NULL;

-- 4. Backfill: Tạo CuocTroChuyen đại diện cho dữ liệu cũ và liên kết vào TinNhanHoTro
INSERT INTO `CuocTroChuyen` (
    `maCuocTroChuyen`,
    `tieuDe`,
    `trangThai`,
    `kenhHoTro`,
    `cheDoChat`,
    `khachHangId`,
    `nhaXeId`,
    `createdAt`,
    `updatedAt`
)
SELECT
    CONCAT('LEGACY-KH-', kh.`khachHangId`) AS `maCuocTroChuyen`,
    'Hỗ trợ khách hàng (Lịch sử)' AS `tieuDe`,
    'DONG' AS `trangThai`,
    'WEB' AS `kenhHoTro`,
    'NGUOI_THAT' AS `cheDoChat`,
    kh.`khachHangId`,
    COALESCE(
        (SELECT `nhaXeId` FROM `NhaXe` ORDER BY `nhaXeId` ASC LIMIT 1),
        1
    ) AS `nhaXeId`,
    MIN(msg.`createdAt`) AS `createdAt`,
    MAX(msg.`updatedAt`) AS `updatedAt`
FROM `TinNhanHoTro` msg
JOIN `KhachHang` kh ON kh.`khachHangId` = msg.`khachHangId`
WHERE msg.`cuocTroChuyenId` IS NULL
GROUP BY kh.`khachHangId`
ON DUPLICATE KEY UPDATE `updatedAt` = VALUES(`updatedAt`);

UPDATE `TinNhanHoTro` msg
JOIN `KhachHang` kh ON kh.`khachHangId` = msg.`khachHangId`
JOIN `CuocTroChuyen` ctc ON ctc.`khachHangId` = kh.`khachHangId`
SET msg.`cuocTroChuyenId` = ctc.`cuocTroChuyenId`,
    msg.`taiKhoanGuiId` = kh.`taiKhoanId`,
    msg.`loaiNguoiGui` = 'KHACH_HANG'
WHERE msg.`cuocTroChuyenId` IS NULL;

-- 5. Contract: Drop ràng buộc cũ, drop cột cũ, chuẩn hóa NOT NULL, indexes và foreign keys mới
ALTER TABLE `TinNhanHoTro` DROP FOREIGN KEY `TinNhanHoTro_khachHangId_fkey`;
DROP INDEX `TinNhanHoTro_khachHangId_fkey` ON `TinNhanHoTro`;

ALTER TABLE `TinNhanHoTro`
    DROP COLUMN `khachHangId`,
    DROP COLUMN `thoiGian`,
    MODIFY `cuocTroChuyenId` INTEGER NOT NULL,
    MODIFY `taiKhoanGuiId` INTEGER NOT NULL,
    MODIFY `loaiNguoiGui` VARCHAR(30) NOT NULL,
    MODIFY `trangThai` VARCHAR(30) NOT NULL DEFAULT 'DA_GUI';

CREATE UNIQUE INDEX `TinNhanHoTro_clientMessageId_key` ON `TinNhanHoTro`(`clientMessageId`);
CREATE INDEX `TinNhanHoTro_cuocTroChuyenId_createdAt_idx` ON `TinNhanHoTro`(`cuocTroChuyenId`, `createdAt`);

ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhanVienId_fkey` FOREIGN KEY (`nhanVienId`) REFERENCES `NhanVien`(`nhanVienId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_cuocTroChuyenId_fkey` FOREIGN KEY (`cuocTroChuyenId`) REFERENCES `CuocTroChuyen`(`cuocTroChuyenId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_taiKhoanGuiId_fkey` FOREIGN KEY (`taiKhoanGuiId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 6. Canonical Permissions cho Chat Realtime
INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('chat:read', 'Xem danh sách và lịch sử cuộc trò chuyện trong phạm vi nhà xe.'),
  ('chat:manage', 'Tiếp nhận, phản hồi và quản lý cuộc trò chuyện trong phạm vi nhà xe.');

-- 7. Gán quyền mặc định cho NHA_XE_ADMIN
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('chat:read', 'chat:manage')
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

-- 8. Gán quyền mặc định cho NHAN_VIEN_CSKH (chat:read, chat:manage, customer:read)
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('chat:read', 'chat:manage', 'customer:read')
WHERE `role`.`tenVaiTro` = 'NHAN_VIEN_CSKH';
