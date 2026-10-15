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

-- 1.1. Phát hiện xung đột dữ liệu: Nếu bản ghi đã tồn tại trong archive nhưng dữ liệu nguồn khác biệt, abort ngay lập tức (Fail-Closed, zero-mutation)
SET @archive_conflict_guard = (
    SELECT 1
    FROM (
        SELECT 1 UNION ALL SELECT 2
    ) `_archive_conflict_guard_fail_closed`
    WHERE EXISTS (
        SELECT 1
        FROM `TinNhanHoTro` src
        JOIN `LuuTruTinNhanHoTroCu` arc ON arc.`tinNhanId` = src.`tinNhanId`
        WHERE BINARY(src.`noiDung`) <> BINARY(arc.`noiDung`)
           OR src.`thoiGian` <> arc.`thoiGianCu`
           OR BINARY(src.`trangThai`) <> BINARY(arc.`trangThaiCu`)
           OR src.`khachHangId` <> arc.`khachHangIdCu`
           OR src.`updatedAt` <> arc.`updatedAtCu`
           OR (
              src.`createdAt` <> arc.`createdAtCu`
              AND NOT (
                  -- Chỉ cho phép khác biệt createdAt nếu schema đã ở trạng thái chạy dở sau bước 4
                  -- (đã có cột cuocTroChuyenId và src.createdAt đã được đồng bộ bằng src.thoiGian)
                  EXISTS (
                      SELECT 1 FROM information_schema.COLUMNS
                      WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'TinNhanHoTro'
                        AND COLUMN_NAME = 'cuocTroChuyenId'
                  )
                  AND src.`createdAt` = src.`thoiGian`
                  AND arc.`thoiGianCu` = src.`thoiGian`
              )
           )
    )
);

-- 1.2. Lưu trữ toàn bộ dữ liệu lịch sử chưa có trong archive
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

-- 4. Đồng bộ thời điểm gửi tin nhắn ban đầu sang createdAt trước khi xóa thoiGian
UPDATE `TinNhanHoTro`
SET `createdAt` = `thoiGian`
WHERE `thoiGian` IS NOT NULL;

-- 5. Chuẩn hóa trạng thái các cuộc trò chuyện đóng (nếu có) sang DA_DONG và gán dongLuc hợp lệ
UPDATE `CuocTroChuyen`
SET `trangThai` = 'DA_DONG',
    `dongLuc` = COALESCE(`dongLuc`, `updatedAt`, `createdAt`, CURRENT_TIMESTAMP(0))
WHERE `trangThai` = 'DONG';

UPDATE `CuocTroChuyen`
SET `dongLuc` = COALESCE(`updatedAt`, `createdAt`, CURRENT_TIMESTAMP(0))
WHERE `trangThai` = 'DA_DONG' AND `dongLuc` IS NULL;

-- 6. Điền thông tin người gửi cho tin nhắn đã được liên kết với cuộc trò chuyện hợp lệ (nếu có)
UPDATE `TinNhanHoTro` msg
JOIN `CuocTroChuyen` ctc ON ctc.`cuocTroChuyenId` = msg.`cuocTroChuyenId`
JOIN `KhachHang` kh ON kh.`khachHangId` = ctc.`khachHangId`
SET msg.`taiKhoanGuiId` = COALESCE(msg.`taiKhoanGuiId`, kh.`taiKhoanId`),
    msg.`loaiNguoiGui` = COALESCE(msg.`loaiNguoiGui`, 'KHACH_HANG')
WHERE msg.`cuocTroChuyenId` IS NOT NULL
  AND (msg.`taiKhoanGuiId` IS NULL OR msg.`loaiNguoiGui` IS NULL);

-- 7.1. Double-check Verification: Đảm bảo 100% bản ghi legacy sắp xóa đã nằm an toàn trong LuuTruTinNhanHoTroCu (Fail-Closed, zero-mutation)
SET @unarchived_legacy_guard = (
    SELECT 1
    FROM (
        SELECT 1 UNION ALL SELECT 2
    ) `_unarchived_legacy_guard_fail_closed`
    WHERE EXISTS (
        SELECT 1
        FROM `TinNhanHoTro` src
        LEFT JOIN `LuuTruTinNhanHoTroCu` arc ON arc.`tinNhanId` = src.`tinNhanId`
        WHERE src.`cuocTroChuyenId` IS NULL
          AND arc.`tinNhanId` IS NULL
    )
);

-- 7.2. Bảo toàn Tenant Isolation & Dọn dẹp bản ghi không thể ánh xạ:
-- Toàn bộ dữ liệu cũ không có căn cứ xác định nhà xe sở hữu đã được lưu trữ an toàn 100% trong LuuTruTinNhanHoTroCu.
-- Tuyệt đối không tự ý gán nhà xe theo MIN(nhaXeId) hoặc suy đoán theo lịch sử giao dịch.
-- Loại bỏ các bản ghi chưa có cuocTroChuyenId khỏi bảng hoạt động trước khi siết ràng buộc NOT NULL.
DELETE FROM `TinNhanHoTro` WHERE `cuocTroChuyenId` IS NULL;

-- 8. Contract: Drop ràng buộc cũ, drop cột cũ, chuẩn hóa NOT NULL, indexes và foreign keys mới
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
CREATE INDEX `TinNhanHoTro_cuocTroChuyen_createdAt_idx` ON `TinNhanHoTro`(`cuocTroChuyenId`, `createdAt`);

ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhanVienId_fkey` FOREIGN KEY (`nhanVienId`) REFERENCES `NhanVien`(`nhanVienId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_cuocTroChuyenId_fkey` FOREIGN KEY (`cuocTroChuyenId`) REFERENCES `CuocTroChuyen`(`cuocTroChuyenId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_taiKhoanGuiId_fkey` FOREIGN KEY (`taiKhoanGuiId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- 9. Canonical Permissions cho Chat Realtime
INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('chat:read', 'Xem danh sách và lịch sử cuộc trò chuyện trong phạm vi nhà xe.'),
  ('chat:manage', 'Tiếp nhận, phản hồi và quản lý cuộc trò chuyện trong phạm vi nhà xe.');

-- 10. Gán quyền mặc định cho NHA_XE_ADMIN
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('chat:read', 'chat:manage')
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

-- 11. Gán quyền mặc định cho NHAN_VIEN_CSKH (chat:read, chat:manage, customer:read)
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('chat:read', 'chat:manage', 'customer:read')
WHERE `role`.`tenVaiTro` = 'NHAN_VIEN_CSKH';
