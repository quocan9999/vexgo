-- Resolve one historical fare per shipment and cargo type before changing persistent schema.
-- Historical rates may be currently active or expired, but must have been effective on ngayGui.
CREATE TEMPORARY TABLE `_ShipmentCargoFeeCandidates` (
    `phieuGuiHangId` INTEGER NOT NULL,
    `loaiHangHoaId` INTEGER NOT NULL,
    `khoiLuongTinhCuoc` DECIMAL(10, 2) NOT NULL,
    `rateCount` INTEGER NOT NULL,
    `bangCuocGuiHangId` INTEGER NULL,
    `soTienCuoc` DECIMAL(18, 2) NULL,
    PRIMARY KEY (`phieuGuiHangId`, `loaiHangHoaId`)
);

INSERT INTO `_ShipmentCargoFeeCandidates` (
    `phieuGuiHangId`,
    `loaiHangHoaId`,
    `khoiLuongTinhCuoc`,
    `rateCount`,
    `bangCuocGuiHangId`,
    `soTienCuoc`
)
SELECT
    `shipment`.`phieuGuiHangId`,
    `cargoWeight`.`loaiHangHoaId`,
    `cargoWeight`.`khoiLuongTinhCuoc`,
    COUNT(`rate`.`bangCuocGuiHangId`),
    CASE WHEN COUNT(`rate`.`bangCuocGuiHangId`) = 1 THEN MIN(`rate`.`bangCuocGuiHangId`) ELSE NULL END,
    CASE WHEN COUNT(`rate`.`bangCuocGuiHangId`) = 1 THEN MAX(`rate`.`mucCuoc`) ELSE NULL END
FROM `PhieuGuiHang` AS `shipment`
INNER JOIN (
    SELECT
        `phieuGuiHangId`,
        `loaiHangHoaId`,
        SUM(`khoiLuong` * `soLuong`) AS `khoiLuongTinhCuoc`
    FROM `HangHoa`
    GROUP BY `phieuGuiHangId`, `loaiHangHoaId`
) AS `cargoWeight`
  ON `cargoWeight`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
LEFT JOIN `BangCuocGuiHang` AS `rate`
  ON `rate`.`diemGuiId` = `shipment`.`diemGuiId`
 AND `rate`.`diemNhanId` = `shipment`.`diemNhanId`
 AND `rate`.`loaiHangHoaId` = `cargoWeight`.`loaiHangHoaId`
 AND `rate`.`trangThai` IN ('HOAT_DONG', 'HET_HIEU_LUC')
 AND DATE(`shipment`.`ngayGui`) BETWEEN `rate`.`tuNgay` AND COALESCE(`rate`.`denNgay`, DATE('9999-12-31'))
 AND `cargoWeight`.`khoiLuongTinhCuoc` BETWEEN `rate`.`khoiLuongTu` AND COALESCE(`rate`.`khoiLuongDen`, CAST(99999999.99 AS DECIMAL(10, 2)))
GROUP BY `shipment`.`phieuGuiHangId`, `cargoWeight`.`loaiHangHoaId`, `cargoWeight`.`khoiLuongTinhCuoc`;

CREATE TEMPORARY TABLE `_ShipmentCargoFeeRatePreflight` (
    `exactlyOneHistoricalRatePerType` TINYINT NOT NULL,
    CONSTRAINT `_ShipmentCargoFeeRatePreflight_check` CHECK (`exactlyOneHistoricalRatePerType` = 1)
);

INSERT INTO `_ShipmentCargoFeeRatePreflight` (`exactlyOneHistoricalRatePerType`)
SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `_ShipmentCargoFeeCandidates` WHERE `rateCount` <> 1
) THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_ShipmentCargoFeeRatePreflight`;

CREATE TEMPORARY TABLE `_ShipmentCargoFeePreflight` (
    `everyShipmentHasCargo` TINYINT NOT NULL,
    `historicalFeeSnapshotsMatch` TINYINT NOT NULL,
    CONSTRAINT `_ShipmentCargoFeePreflight_cargo_check` CHECK (`everyShipmentHasCargo` = 1),
    CONSTRAINT `_ShipmentCargoFeePreflight_financial_check` CHECK (`historicalFeeSnapshotsMatch` = 1)
);

INSERT INTO `_ShipmentCargoFeePreflight` (`everyShipmentHasCargo`, `historicalFeeSnapshotsMatch`)
SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        LEFT JOIN `HangHoa` AS `item`
          ON `item`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
        GROUP BY `shipment`.`phieuGuiHangId`
        HAVING COUNT(`item`.`hangHoaId`) = 0
    ) THEN 1 ELSE 0 END,
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        INNER JOIN `_ShipmentCargoFeeCandidates` AS `candidate`
          ON `candidate`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
        GROUP BY
            `shipment`.`phieuGuiHangId`,
            `shipment`.`cuocChinh`,
            `shipment`.`phiDichVu`,
            `shipment`.`soTienGiam`,
            `shipment`.`tongPhi`
        HAVING SUM(`candidate`.`soTienCuoc`) <> `shipment`.`cuocChinh`
            OR `shipment`.`tongPhi` <> SUM(`candidate`.`soTienCuoc`) + `shipment`.`phiDichVu` - `shipment`.`soTienGiam`
    ) THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_ShipmentCargoFeePreflight`;

ALTER TABLE `BangCuocGuiHang`
  ADD UNIQUE INDEX `BangCuocGuiHang_rate_type_key` (`bangCuocGuiHangId`, `loaiHangHoaId`);

CREATE TABLE `ChiTietCuocGuiHang` (
    `chiTietCuocGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    `phieuGuiHangId` INTEGER NOT NULL,
    `loaiHangHoaId` INTEGER NOT NULL,
    `bangCuocGuiHangId` INTEGER NOT NULL,
    `khoiLuongTinhCuoc` DECIMAL(10, 2) NOT NULL,
    `soTienCuoc` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`chiTietCuocGuiHangId`),
    UNIQUE INDEX `ChiTietCuocGuiHang_shipment_type_key` (`phieuGuiHangId`, `loaiHangHoaId`),
    INDEX `ChiTietCuocGuiHang_rate_type_idx` (`bangCuocGuiHangId`, `loaiHangHoaId`),
    CONSTRAINT `ChiTietCuocGuiHang_phieuGuiHangId_fkey`
      FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang` (`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `ChiTietCuocGuiHang_loaiHangHoaId_fkey`
      FOREIGN KEY (`loaiHangHoaId`) REFERENCES `LoaiHangHoa` (`loaiHangHoaId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `ChiTietCuocGuiHang_bangCuocGuiHangId_loaiHangHoaId_fkey`
      FOREIGN KEY (`bangCuocGuiHangId`, `loaiHangHoaId`)
      REFERENCES `BangCuocGuiHang` (`bangCuocGuiHangId`, `loaiHangHoaId`) ON DELETE RESTRICT ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ChiTietCuocGuiHang` (
    `phieuGuiHangId`,
    `loaiHangHoaId`,
    `bangCuocGuiHangId`,
    `khoiLuongTinhCuoc`,
    `soTienCuoc`
)
SELECT
    `phieuGuiHangId`,
    `loaiHangHoaId`,
    `bangCuocGuiHangId`,
    `khoiLuongTinhCuoc`,
    `soTienCuoc`
FROM `_ShipmentCargoFeeCandidates`;

CREATE TEMPORARY TABLE `_ShipmentCargoFeeSnapshotCheck` (
    `allFeeSnapshotsMatch` TINYINT NOT NULL,
    CONSTRAINT `_ShipmentCargoFeeSnapshotCheck_check` CHECK (`allFeeSnapshotsMatch` = 1)
);

INSERT INTO `_ShipmentCargoFeeSnapshotCheck` (`allFeeSnapshotsMatch`)
SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM `PhieuGuiHang` AS `shipment`
    INNER JOIN `ChiTietCuocGuiHang` AS `detail`
      ON `detail`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
    GROUP BY
        `shipment`.`phieuGuiHangId`,
        `shipment`.`cuocChinh`,
        `shipment`.`phiDichVu`,
        `shipment`.`soTienGiam`,
        `shipment`.`tongPhi`
    HAVING SUM(`detail`.`soTienCuoc`) <> `shipment`.`cuocChinh`
        OR `shipment`.`tongPhi` <> SUM(`detail`.`soTienCuoc`) + `shipment`.`phiDichVu` - `shipment`.`soTienGiam`
) THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_ShipmentCargoFeeSnapshotCheck`;
DROP TEMPORARY TABLE `_ShipmentCargoFeeCandidates`;

ALTER TABLE `PhieuGuiHang`
  DROP FOREIGN KEY `PhieuGuiHang_bangCuocApDungId_fkey`,
  DROP INDEX `PhieuGuiHang_bangCuocApDungId_idx`,
  DROP COLUMN `bangCuocApDungId`;
