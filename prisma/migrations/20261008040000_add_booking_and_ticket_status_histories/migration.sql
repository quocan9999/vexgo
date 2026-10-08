-- CreateTable
CREATE TABLE `LichSuTrangThaiPhieuDatVe` (
    `lichSuTrangThaiPhieuDatVeId` INTEGER NOT NULL AUTO_INCREMENT,
    `phieuDatVeId` INTEGER NOT NULL,
    `trangThaiCu` VARCHAR(30) NULL,
    `trangThaiMoi` VARCHAR(30) NOT NULL,
    `thoiDiem` DATETIME(0) NOT NULL,
    `nguonThayDoi` VARCHAR(20) NOT NULL,
    `taiKhoanId` INTEGER NULL,
    `lyDo` VARCHAR(255) NOT NULL,
    `laOverride` BOOLEAN NOT NULL DEFAULT false,
    `maThaoTac` CHAR(36) NOT NULL,

    UNIQUE INDEX `LichSuTrangThaiPhieuDatVe_maThaoTac_phieuDatVeId_key`(`maThaoTac`, `phieuDatVeId`),
    PRIMARY KEY (`lichSuTrangThaiPhieuDatVeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `LichSuTrangThaiVe` (
    `lichSuTrangThaiVeId` INTEGER NOT NULL AUTO_INCREMENT,
    `veId` INTEGER NOT NULL,
    `trangThaiCu` VARCHAR(30) NULL,
    `trangThaiMoi` VARCHAR(30) NOT NULL,
    `thoiDiem` DATETIME(0) NOT NULL,
    `nguonThayDoi` VARCHAR(20) NOT NULL,
    `taiKhoanId` INTEGER NULL,
    `lyDo` VARCHAR(255) NOT NULL,
    `laOverride` BOOLEAN NOT NULL DEFAULT false,
    `maThaoTac` CHAR(36) NOT NULL,

    UNIQUE INDEX `LichSuTrangThaiVe_maThaoTac_veId_key`(`maThaoTac`, `veId`),
    PRIMARY KEY (`lichSuTrangThaiVeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `LichSuTrangThaiPhieuDatVe`
    ADD CONSTRAINT `LichSuTrangThaiPhieuDatVe_phieuDatVeId_fkey`
    FOREIGN KEY (`phieuDatVeId`) REFERENCES `PhieuDatVe`(`phieuDatVeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `LichSuTrangThaiPhieuDatVe`
    ADD CONSTRAINT `LichSuTrangThaiPhieuDatVe_taiKhoanId_fkey`
    FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `LichSuTrangThaiVe`
    ADD CONSTRAINT `LichSuTrangThaiVe_veId_fkey`
    FOREIGN KEY (`veId`) REFERENCES `Ve`(`veId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `LichSuTrangThaiVe`
    ADD CONSTRAINT `LichSuTrangThaiVe_taiKhoanId_fkey`
    FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddCheckConstraints
ALTER TABLE `LichSuTrangThaiPhieuDatVe`
    ADD CONSTRAINT `chk_LSTTPDV_nguonThayDoi`
      CHECK (`nguonThayDoi` IN ('CUSTOMER', 'STAFF', 'SYSTEM')),
    ADD CONSTRAINT `chk_LSTTPDV_taiKhoan_theo_nguon`
      CHECK (
        (`nguonThayDoi` IN ('CUSTOMER', 'STAFF') AND `taiKhoanId` IS NOT NULL)
        OR
        (`nguonThayDoi` = 'SYSTEM' AND `taiKhoanId` IS NULL)
      ),
    ADD CONSTRAINT `chk_LSTTPDV_laOverride_staff_only`
      CHECK (`laOverride` = FALSE OR `nguonThayDoi` = 'STAFF'),
    ADD CONSTRAINT `chk_LSTTPDV_trangThai_hopLe`
      CHECK (`trangThaiCu` IS NULL OR `trangThaiCu` <> `trangThaiMoi`);

ALTER TABLE `LichSuTrangThaiVe`
    ADD CONSTRAINT `chk_LSTTV_nguonThayDoi`
      CHECK (`nguonThayDoi` IN ('CUSTOMER', 'STAFF', 'SYSTEM')),
    ADD CONSTRAINT `chk_LSTTV_taiKhoan_theo_nguon`
      CHECK (
        (`nguonThayDoi` IN ('CUSTOMER', 'STAFF') AND `taiKhoanId` IS NOT NULL)
        OR
        (`nguonThayDoi` = 'SYSTEM' AND `taiKhoanId` IS NULL)
      ),
    ADD CONSTRAINT `chk_LSTTV_laOverride_staff_only`
      CHECK (`laOverride` = FALSE OR `nguonThayDoi` = 'STAFF'),
    ADD CONSTRAINT `chk_LSTTV_trangThai_hopLe`
      CHECK (`trangThaiCu` IS NULL OR `trangThaiCu` <> `trangThaiMoi`);

-- Backfill baseline history for existing PhieuDatVe and Ve
SET @migrationTimestamp = CURRENT_TIMESTAMP(0);

INSERT INTO `LichSuTrangThaiPhieuDatVe` (
    `phieuDatVeId`,
    `trangThaiCu`,
    `trangThaiMoi`,
    `thoiDiem`,
    `nguonThayDoi`,
    `taiKhoanId`,
    `lyDo`,
    `laOverride`,
    `maThaoTac`
)
SELECT
    `pdv`.`phieuDatVeId`,
    NULL,
    `pdv`.`trangThai`,
    @migrationTimestamp,
    'SYSTEM',
    NULL,
    'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có',
    FALSE,
    UUID()
FROM `PhieuDatVe` AS `pdv`;

INSERT INTO `LichSuTrangThaiVe` (
    `veId`,
    `trangThaiCu`,
    `trangThaiMoi`,
    `thoiDiem`,
    `nguonThayDoi`,
    `taiKhoanId`,
    `lyDo`,
    `laOverride`,
    `maThaoTac`
)
SELECT
    `v`.`veId`,
    NULL,
    `v`.`trangThai`,
    @migrationTimestamp,
    'SYSTEM',
    NULL,
    'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có',
    FALSE,
    UUID()
FROM `Ve` AS `v`;

-- Invariant check to guarantee backfill integrity
CREATE TEMPORARY TABLE `_BookingTicketStatusHistoryBackfillCheck` (
    `bookingCountMatches` TINYINT NOT NULL,
    `ticketCountMatches` TINYINT NOT NULL,
    `bookingBaselineValid` TINYINT NOT NULL,
    `ticketBaselineValid` TINYINT NOT NULL,
    CONSTRAINT `_chk_booking_backfill_count` CHECK (`bookingCountMatches` = 1),
    CONSTRAINT `_chk_ticket_backfill_count` CHECK (`ticketCountMatches` = 1),
    CONSTRAINT `_chk_booking_baseline_valid` CHECK (`bookingBaselineValid` = 1),
    CONSTRAINT `_chk_ticket_baseline_valid` CHECK (`ticketBaselineValid` = 1)
);

INSERT INTO `_BookingTicketStatusHistoryBackfillCheck` (
    `bookingCountMatches`,
    `ticketCountMatches`,
    `bookingBaselineValid`,
    `ticketBaselineValid`
)
SELECT
    CASE WHEN (SELECT COUNT(*) FROM `PhieuDatVe`) = (SELECT COUNT(*) FROM `LichSuTrangThaiPhieuDatVe`) THEN 1 ELSE 0 END,
    CASE WHEN (SELECT COUNT(*) FROM `Ve`) = (SELECT COUNT(*) FROM `LichSuTrangThaiVe`) THEN 1 ELSE 0 END,
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `PhieuDatVe` AS `pdv`
        LEFT JOIN `LichSuTrangThaiPhieuDatVe` AS `h`
          ON `h`.`phieuDatVeId` = `pdv`.`phieuDatVeId`
        WHERE `h`.`lichSuTrangThaiPhieuDatVeId` IS NULL
           OR `h`.`trangThaiCu` IS NOT NULL
           OR `h`.`trangThaiMoi` <> `pdv`.`trangThai`
           OR `h`.`nguonThayDoi` <> 'SYSTEM'
           OR `h`.`taiKhoanId` IS NOT NULL
           OR `h`.`laOverride` <> FALSE
           OR `h`.`maThaoTac` IS NULL
           OR LENGTH(`h`.`maThaoTac`) <> 36
    ) THEN 1 ELSE 0 END,
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `Ve` AS `v`
        LEFT JOIN `LichSuTrangThaiVe` AS `h`
          ON `h`.`veId` = `v`.`veId`
        WHERE `h`.`lichSuTrangThaiVeId` IS NULL
           OR `h`.`trangThaiCu` IS NOT NULL
           OR `h`.`trangThaiMoi` <> `v`.`trangThai`
           OR `h`.`nguonThayDoi` <> 'SYSTEM'
           OR `h`.`taiKhoanId` IS NOT NULL
           OR `h`.`laOverride` <> FALSE
           OR `h`.`maThaoTac` IS NULL
           OR LENGTH(`h`.`maThaoTac`) <> 36
    ) THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_BookingTicketStatusHistoryBackfillCheck`;
