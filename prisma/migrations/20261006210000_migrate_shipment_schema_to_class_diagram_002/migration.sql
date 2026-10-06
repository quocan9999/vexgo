-- Chuyen schema gui hang sang class diagram 002.
--
-- Luot chay dau tao cac bang luu tru va bang staging mapping. Neu chua du mapping,
-- preflight se loi CHECK truoc khi sua cac bang nghiep vu. Sau khi dien mapping:
--   1. prisma migrate resolve --rolled-back 20261006210000_migrate_shipment_schema_to_class_diagram_002
--   2. prisma migrate deploy
-- Khong danh dau migration nay la applied khi phan chuyen doi chua hoan tat.

CREATE TABLE IF NOT EXISTS `LuuTruPhieuGuiHangCu` (
    `phieuGuiHangId` INTEGER NOT NULL,
    `tenNguoiNhan` VARCHAR(100) NOT NULL,
    `soDienThoaiNguoiNhan` VARCHAR(16) NOT NULL,
    `diaChiNguoiNhan` VARCHAR(255) NULL,
    `hinhThucLayHang` VARCHAR(30) NOT NULL,
    `hinhThucGiaoHang` VARCHAR(30) NOT NULL,
    `diaChiLayHang` VARCHAR(255) NULL,
    `chuyenXeIdCu` INTEGER NULL,
    `buuCucGuiIdCu` INTEGER NULL,
    `buuCucPhatIdCu` INTEGER NULL,
    `bangCuocApDungIdCu` INTEGER NULL,
    `trangThaiCu` VARCHAR(30) NOT NULL,
    `archivedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`phieuGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LuuTruBangCuocGuiHangCu` (
    `bangCuocGuiHangId` INTEGER NOT NULL,
    `buuCucGuiIdCu` INTEGER NOT NULL,
    `buuCucPhatIdCu` INTEGER NOT NULL,
    `hinhThucLayHang` VARCHAR(30) NOT NULL,
    `hinhThucGiaoHang` VARCHAR(30) NOT NULL,
    `trangThaiCu` VARCHAR(30) NOT NULL,
    `archivedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    PRIMARY KEY (`bangCuocGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO `LuuTruPhieuGuiHangCu` (
    `phieuGuiHangId`, `tenNguoiNhan`, `soDienThoaiNguoiNhan`, `diaChiNguoiNhan`,
    `hinhThucLayHang`, `hinhThucGiaoHang`, `diaChiLayHang`, `chuyenXeIdCu`,
    `buuCucGuiIdCu`, `buuCucPhatIdCu`, `bangCuocApDungIdCu`, `trangThaiCu`
)
SELECT `phieuGuiHangId`, `tenNguoiNhan`, `soDienThoaiNguoiNhan`, `diaChiNguoiNhan`,
       `hinhThucLayHang`, `hinhThucGiaoHang`, `diaChiLayHang`, `chuyenXeId`,
       `buuCucGuiId`, `buuCucPhatId`, `bangCuocApDungId`, `trangThai`
FROM `PhieuGuiHang`;

INSERT IGNORE INTO `LuuTruBangCuocGuiHangCu` (
    `bangCuocGuiHangId`, `buuCucGuiIdCu`, `buuCucPhatIdCu`,
    `hinhThucLayHang`, `hinhThucGiaoHang`, `trangThaiCu`
)
SELECT `bangCuocGuiHangId`, `buuCucGuiId`, `buuCucPhatId`,
       `hinhThucLayHang`, `hinhThucGiaoHang`, `trangThai`
FROM `BangCuocGuiHang`;

-- Cac bang staging chi ton tai trong luc cho mapping. Neu migration dung o preflight,
-- dien cac dong con thieu roi resolve --rolled-back va chay lai migration.
CREATE TABLE IF NOT EXISTS `_MigrationShipmentTripMapping` (
    `phieuGuiHangId` INTEGER NOT NULL,
    `chuyenXeId` INTEGER NOT NULL,
    PRIMARY KEY (`phieuGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `_MigrationShipmentFareMapping` (
    `bangCuocGuiHangId` INTEGER NOT NULL,
    `loaiHangHoaId` INTEGER NOT NULL,
    PRIMARY KEY (`bangCuocGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `_MigrationShipmentCategoryGroupMapping` (
    `loaiHangHoaId` INTEGER NOT NULL,
    `nhomSucChua` ENUM('XE_MAY', 'HANG_CONG_KENH', 'HANG_NHE') NOT NULL,
    PRIMARY KEY (`loaiHangHoaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tu dong nap mapping chuyen duy nhat suy ra duoc tu ve trong cung don giao dich.
INSERT IGNORE INTO `_MigrationShipmentTripMapping` (`phieuGuiHangId`, `chuyenXeId`)
SELECT `shipment`.`phieuGuiHangId`, MIN(`seatTrip`.`chuyenXeId`)
FROM `PhieuGuiHang` AS `shipment`
INNER JOIN `DonGiaoDich` AS `transaction` ON `transaction`.`donGiaoDichId` = `shipment`.`donGiaoDichId`
INNER JOIN `PhieuDatVe` AS `booking` ON `booking`.`donGiaoDichId` = `transaction`.`donGiaoDichId`
INNER JOIN `Ve` AS `ticket` ON `ticket`.`phieuDatVeId` = `booking`.`phieuDatVeId`
INNER JOIN `GheChuyenXe` AS `seatTrip` ON `seatTrip`.`gheChuyenXeId` = `ticket`.`gheChuyenXeId`
WHERE `shipment`.`chuyenXeId` IS NULL
GROUP BY `shipment`.`phieuGuiHangId`
HAVING COUNT(DISTINCT `seatTrip`.`chuyenXeId`) = 1;

-- Preflight co check constraint de migration dung truoc moi thay doi schema nghiep vu.
-- Bang archive va staging da duoc ghi, co the tiep tuc bo sung mapping sau khi dung.
CREATE TEMPORARY TABLE `_ShipmentMigrationPreflight` (
    `ready` TINYINT NOT NULL,
    CONSTRAINT `_ShipmentMigrationPreflight_ready_check` CHECK (`ready` = 1)
);

INSERT INTO `_ShipmentMigrationPreflight` (`ready`)
SELECT CASE WHEN
    NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        LEFT JOIN `_MigrationShipmentTripMapping` AS `tripMap`
          ON `tripMap`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
        LEFT JOIN `ChuyenXe` AS `mappedTrip`
          ON `mappedTrip`.`chuyenXeId` = `tripMap`.`chuyenXeId`
        WHERE (`shipment`.`chuyenXeId` IS NULL AND `mappedTrip`.`chuyenXeId` IS NULL)
           OR (`shipment`.`chuyenXeId` IS NOT NULL AND `tripMap`.`chuyenXeId` IS NOT NULL
               AND `shipment`.`chuyenXeId` <> `tripMap`.`chuyenXeId`)
    )
    AND NOT EXISTS (
        SELECT 1 FROM `_MigrationShipmentTripMapping` AS `map`
        LEFT JOIN `PhieuGuiHang` AS `shipment` ON `shipment`.`phieuGuiHangId` = `map`.`phieuGuiHangId`
        LEFT JOIN `ChuyenXe` AS `trip` ON `trip`.`chuyenXeId` = `map`.`chuyenXeId`
        WHERE `shipment`.`phieuGuiHangId` IS NULL OR `trip`.`chuyenXeId` IS NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM `BangCuocGuiHang` AS `fare`
        LEFT JOIN `_MigrationShipmentFareMapping` AS `fareMap`
          ON `fareMap`.`bangCuocGuiHangId` = `fare`.`bangCuocGuiHangId`
        LEFT JOIN `LoaiHangHoa` AS `cargoType` ON `cargoType`.`loaiHangHoaId` = `fareMap`.`loaiHangHoaId`
        WHERE `cargoType`.`loaiHangHoaId` IS NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM `_MigrationShipmentFareMapping` AS `fareMap`
        LEFT JOIN `BangCuocGuiHang` AS `fare` ON `fare`.`bangCuocGuiHangId` = `fareMap`.`bangCuocGuiHangId`
        LEFT JOIN `LoaiHangHoa` AS `cargoType` ON `cargoType`.`loaiHangHoaId` = `fareMap`.`loaiHangHoaId`
        WHERE `fare`.`bangCuocGuiHangId` IS NULL OR `cargoType`.`loaiHangHoaId` IS NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM `LoaiHangHoa` AS `cargoType`
        LEFT JOIN `_MigrationShipmentCategoryGroupMapping` AS `groupMap`
          ON `groupMap`.`loaiHangHoaId` = `cargoType`.`loaiHangHoaId`
        WHERE `groupMap`.`loaiHangHoaId` IS NULL
    )
    AND NOT EXISTS (
        SELECT 1 FROM `_MigrationShipmentCategoryGroupMapping` AS `groupMap`
        LEFT JOIN `LoaiHangHoa` AS `cargoType` ON `cargoType`.`loaiHangHoaId` = `groupMap`.`loaiHangHoaId`
        WHERE `cargoType`.`loaiHangHoaId` IS NULL
    )
    AND NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        LEFT JOIN `BangCuocGuiHang` AS `fare` ON `fare`.`bangCuocGuiHangId` = `shipment`.`bangCuocApDungId`
        LEFT JOIN `_MigrationShipmentFareMapping` AS `fareMap`
          ON `fareMap`.`bangCuocGuiHangId` = `fare`.`bangCuocGuiHangId`
        LEFT JOIN `_MigrationShipmentTripMapping` AS `tripMap`
          ON `tripMap`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
        LEFT JOIN `ChuyenXe` AS `trip`
          ON `trip`.`chuyenXeId` = COALESCE(`shipment`.`chuyenXeId`, `tripMap`.`chuyenXeId`)
        LEFT JOIN `BuuCuc` AS `sendPoint`
          ON `sendPoint`.`buuCucId` = COALESCE(`shipment`.`buuCucGuiId`, `fare`.`buuCucGuiId`)
        LEFT JOIN `BuuCuc` AS `receivePoint`
          ON `receivePoint`.`buuCucId` = COALESCE(`shipment`.`buuCucPhatId`, `fare`.`buuCucPhatId`)
        WHERE `fare`.`bangCuocGuiHangId` IS NULL
           OR `fareMap`.`loaiHangHoaId` IS NULL
           OR `trip`.`chuyenXeId` IS NULL
           OR `sendPoint`.`buuCucId` IS NULL
           OR `receivePoint`.`buuCucId` IS NULL
           OR `sendPoint`.`buuCucId` = `receivePoint`.`buuCucId`
           OR `sendPoint`.`nhaXeId` <> `trip`.`nhaXeId`
           OR `receivePoint`.`nhaXeId` <> `trip`.`nhaXeId`
    )
    AND NOT EXISTS (
        SELECT 1 FROM `BuuCuc` WHERE `trangThai` NOT IN ('HOAT_DONG', 'TAM_NGUNG')
    )
    AND NOT EXISTS (
        SELECT 1 FROM `BangCuocGuiHang`
        WHERE `trangThai` NOT IN ('DANG_AP_DUNG', 'HOAT_DONG', 'TAM_NGUNG', 'HET_HIEU_LUC')
           OR `buuCucGuiId` = `buuCucPhatId`
    )
    AND NOT EXISTS (
        SELECT 1
        FROM `BangCuocGuiHang` AS `fare`
        INNER JOIN `BuuCuc` AS `sendPoint` ON `sendPoint`.`buuCucId` = `fare`.`buuCucGuiId`
        INNER JOIN `BuuCuc` AS `receivePoint` ON `receivePoint`.`buuCucId` = `fare`.`buuCucPhatId`
        WHERE `sendPoint`.`nhaXeId` <> `receivePoint`.`nhaXeId`
    )
    AND NOT EXISTS (
        SELECT 1 FROM `PhieuGuiHang`
        WHERE `trangThai` NOT IN ('MOI_TAO', 'CHO_DIEU_PHOI', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN', 'DA_GIAO', 'DA_HUY')
           OR `nguoiTraCuoc` NOT IN ('NGUOI_GUI', 'NGUOI_NHAN')
           OR `bangCuocApDungId` IS NULL
    )
THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_ShipmentMigrationPreflight`;

-- Luu cac gia tri cu truoc khi thay doi nullability va bo truong legacy.
UPDATE `PhieuGuiHang` AS `shipment`
INNER JOIN `_MigrationShipmentTripMapping` AS `tripMap`
  ON `tripMap`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
SET `shipment`.`chuyenXeId` = `tripMap`.`chuyenXeId`
WHERE `shipment`.`chuyenXeId` IS NULL;

UPDATE `PhieuGuiHang` AS `shipment`
INNER JOIN `BangCuocGuiHang` AS `fare` ON `fare`.`bangCuocGuiHangId` = `shipment`.`bangCuocApDungId`
SET `shipment`.`buuCucGuiId` = COALESCE(`shipment`.`buuCucGuiId`, `fare`.`buuCucGuiId`),
    `shipment`.`buuCucPhatId` = COALESCE(`shipment`.`buuCucPhatId`, `fare`.`buuCucPhatId`);

UPDATE `BangCuocGuiHang` AS `fare`
INNER JOIN `_MigrationShipmentFareMapping` AS `fareMap`
  ON `fareMap`.`bangCuocGuiHangId` = `fare`.`bangCuocGuiHangId`
SET `fare`.`trangThai` = CASE WHEN `fare`.`trangThai` = 'DANG_AP_DUNG' THEN 'HOAT_DONG' ELSE `fare`.`trangThai` END;

UPDATE `PhieuGuiHang`
SET `trangThai` = 'MOI_TAO'
WHERE `trangThai` = 'CHO_DIEU_PHOI';

-- Chuyen ten bang va cot, giu nguyen ID diem giao nhan hien co.
ALTER TABLE `BangCuocGuiHang`
    DROP FOREIGN KEY `BangCuocGuiHang_buuCucGuiId_fkey`,
    DROP FOREIGN KEY `BangCuocGuiHang_buuCucPhatId_fkey`;

ALTER TABLE `BuuCuc` DROP FOREIGN KEY `BuuCuc_nhaXeId_fkey`;

ALTER TABLE `PhieuGuiHang`
    DROP FOREIGN KEY `PhieuGuiHang_chuyenXeId_fkey`,
    DROP FOREIGN KEY `PhieuGuiHang_buuCucGuiId_fkey`,
    DROP FOREIGN KEY `PhieuGuiHang_buuCucPhatId_fkey`,
    DROP FOREIGN KEY `PhieuGuiHang_bangCuocApDungId_fkey`;

ALTER TABLE `BangCuocGuiHang`
    DROP INDEX `BangCuocGuiHang_buuCucGuiId_fkey`,
    DROP INDEX `BangCuocGuiHang_buuCucPhatId_fkey`;

ALTER TABLE `PhieuGuiHang`
    DROP INDEX `PhieuGuiHang_buuCucGuiId_fkey`,
    DROP INDEX `PhieuGuiHang_buuCucPhatId_fkey`,
    DROP INDEX `PhieuGuiHang_chuyenXeId_fkey`;

ALTER TABLE `BuuCuc`
    DROP INDEX `BuuCuc_index_7`;

RENAME TABLE `BuuCuc` TO `DiemGiaoNhanHang`;

ALTER TABLE `DiemGiaoNhanHang`
    CHANGE COLUMN `buuCucId` `diemGiaoNhanHangId` INTEGER NOT NULL AUTO_INCREMENT,
    CHANGE COLUMN `maBuuCuc` `maDiem` VARCHAR(50) NOT NULL,
    CHANGE COLUMN `tenBuuCuc` `tenDiem` VARCHAR(150) NOT NULL,
    ADD COLUMN `maTinhThanh` VARCHAR(20) NULL,
    ADD COLUMN `maPhuongXa` VARCHAR(20) NULL,
    ADD COLUMN `viDo` DECIMAL(10, 7) NULL,
    ADD COLUMN `kinhDo` DECIMAL(10, 7) NULL,
    MODIFY COLUMN `trangThai` ENUM('HOAT_DONG', 'TAM_NGUNG') NOT NULL;

CREATE UNIQUE INDEX `DiemGiaoNhanHang_nhaXeId_maDiem_key`
    ON `DiemGiaoNhanHang`(`nhaXeId`, `maDiem`);

-- Them va backfill nhom hang/cau hinh cuoc theo mapping da duyet.
ALTER TABLE `LoaiHangHoa`
    ADD COLUMN `nhomSucChua` ENUM('XE_MAY', 'HANG_CONG_KENH', 'HANG_NHE') NULL;

UPDATE `LoaiHangHoa` AS `cargoType`
INNER JOIN `_MigrationShipmentCategoryGroupMapping` AS `groupMap`
  ON `groupMap`.`loaiHangHoaId` = `cargoType`.`loaiHangHoaId`
SET `cargoType`.`nhomSucChua` = `groupMap`.`nhomSucChua`;

ALTER TABLE `LoaiHangHoa` MODIFY COLUMN `nhomSucChua` ENUM('XE_MAY', 'HANG_CONG_KENH', 'HANG_NHE') NOT NULL;

ALTER TABLE `BangCuocGuiHang`
    CHANGE COLUMN `buuCucGuiId` `diemGuiId` INTEGER NOT NULL,
    CHANGE COLUMN `buuCucPhatId` `diemNhanId` INTEGER NOT NULL,
    DROP COLUMN `hinhThucLayHang`,
    DROP COLUMN `hinhThucGiaoHang`,
    ADD COLUMN `loaiHangHoaId` INTEGER NULL;

UPDATE `BangCuocGuiHang` AS `fare`
INNER JOIN `_MigrationShipmentFareMapping` AS `fareMap`
  ON `fareMap`.`bangCuocGuiHangId` = `fare`.`bangCuocGuiHangId`
SET `fare`.`loaiHangHoaId` = `fareMap`.`loaiHangHoaId`;

ALTER TABLE `BangCuocGuiHang`
    MODIFY COLUMN `trangThai` ENUM('HOAT_DONG', 'TAM_NGUNG', 'HET_HIEU_LUC') NOT NULL,
    MODIFY COLUMN `loaiHangHoaId` INTEGER NOT NULL;

-- Backfill snapshot suc chua tu loai xe cua xe dang gan cho tung chuyen.
ALTER TABLE `LoaiXe`
    ADD COLUMN `sucChuaXeMayMacDinh` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sucChuaHangCongKenhMacDinh` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `sucChuaHangNheMacDinh` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `ChuyenXe`
    ADD COLUMN `nhanGuiHang` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sucChuaXeMay` INTEGER NULL,
    ADD COLUMN `sucChuaHangCongKenh` INTEGER NULL,
    ADD COLUMN `sucChuaHangNhe` INTEGER NULL;

UPDATE `ChuyenXe` AS `trip`
INNER JOIN `Xe` AS `vehicle` ON `vehicle`.`xeId` = `trip`.`xeId` AND `vehicle`.`nhaXeId` = `trip`.`nhaXeId`
INNER JOIN `LoaiXe` AS `vehicleType`
  ON `vehicleType`.`loaiXeId` = `vehicle`.`loaiXeId` AND `vehicleType`.`nhaXeId` = `vehicle`.`nhaXeId`
SET `trip`.`sucChuaXeMay` = `vehicleType`.`sucChuaXeMayMacDinh`,
    `trip`.`sucChuaHangCongKenh` = `vehicleType`.`sucChuaHangCongKenhMacDinh`,
    `trip`.`sucChuaHangNhe` = `vehicleType`.`sucChuaHangNheMacDinh`;

ALTER TABLE `ChuyenXe`
    MODIFY COLUMN `sucChuaXeMay` INTEGER NOT NULL,
    MODIFY COLUMN `sucChuaHangCongKenh` INTEGER NOT NULL,
    MODIFY COLUMN `sucChuaHangNhe` INTEGER NOT NULL,
    ADD CONSTRAINT `ChuyenXe_sucChua_nonnegative_check`
      CHECK (`sucChuaXeMay` >= 0 AND `sucChuaHangCongKenh` >= 0 AND `sucChuaHangNhe` >= 0);

ALTER TABLE `LoaiXe`
    ADD CONSTRAINT `LoaiXe_sucChuaMacDinh_nonnegative_check`
      CHECK (`sucChuaXeMayMacDinh` >= 0 AND `sucChuaHangCongKenhMacDinh` >= 0 AND `sucChuaHangNheMacDinh` >= 0);

-- Chuyen PhieuGuiHang sang diem giao nhan; endpoint cu bi null se lay tu bang cuoc cu.
ALTER TABLE `PhieuGuiHang`
    CHANGE COLUMN `buuCucGuiId` `diemGuiId` INTEGER NULL,
    CHANGE COLUMN `buuCucPhatId` `diemNhanId` INTEGER NULL,
    DROP COLUMN `diaChiNguoiNhan`,
    DROP COLUMN `diaChiLayHang`,
    DROP COLUMN `hinhThucLayHang`,
    DROP COLUMN `hinhThucGiaoHang`;

UPDATE `PhieuGuiHang` AS `shipment`
INNER JOIN `BangCuocGuiHang` AS `fare` ON `fare`.`bangCuocGuiHangId` = `shipment`.`bangCuocApDungId`
SET `shipment`.`diemGuiId` = COALESCE(`shipment`.`diemGuiId`, `fare`.`diemGuiId`),
    `shipment`.`diemNhanId` = COALESCE(`shipment`.`diemNhanId`, `fare`.`diemNhanId`);

ALTER TABLE `PhieuGuiHang`
    MODIFY COLUMN `nguoiTraCuoc` ENUM('NGUOI_GUI', 'NGUOI_NHAN') NOT NULL,
    MODIFY COLUMN `trangThai` ENUM('MOI_TAO', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN', 'DA_GIAO', 'DA_HUY') NOT NULL,
    MODIFY COLUMN `chuyenXeId` INTEGER NOT NULL,
    MODIFY COLUMN `diemGuiId` INTEGER NOT NULL,
    MODIFY COLUMN `diemNhanId` INTEGER NOT NULL,
    MODIFY COLUMN `bangCuocApDungId` INTEGER NOT NULL;

UPDATE `ChuyenXe` AS `trip`
INNER JOIN `PhieuGuiHang` AS `shipment` ON `shipment`.`chuyenXeId` = `trip`.`chuyenXeId`
SET `trip`.`nhanGuiHang` = true;

-- Tao hai bang quan he moi. Lich su cu khong ton tai trong schema cu nen khong tu tao su kien gia.
CREATE TABLE `DiemGiaoNhanTuyenXe` (
    `diemGiaoNhanTuyenXeId` INTEGER NOT NULL AUTO_INCREMENT,
    `vaiTro` ENUM('GUI_HANG', 'NHAN_HANG', 'CA_HAI') NOT NULL,
    `tuyenXeId` INTEGER NOT NULL,
    `diemGiaoNhanHangId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `DiemGiaoNhanTuyenXe_diemGiaoNhanHangId_idx`(`diemGiaoNhanHangId`),
    UNIQUE INDEX `DiemGiaoNhanTuyenXe_tuyenXeId_diemGiaoNhanHangId_key`(`tuyenXeId`, `diemGiaoNhanHangId`),
    PRIMARY KEY (`diemGiaoNhanTuyenXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LichSuTrangThaiPhieuGuiHang` (
    `lichSuTrangThaiId` INTEGER NOT NULL AUTO_INCREMENT,
    `trangThai` ENUM('MOI_TAO', 'DA_TIEP_NHAN', 'DANG_VAN_CHUYEN', 'DA_GIAO', 'DA_HUY') NOT NULL,
    `thoiGian` DATETIME(0) NOT NULL,
    `ghiChu` VARCHAR(500) NULL,
    `phieuGuiHangId` INTEGER NOT NULL,
    `taiKhoanId` INTEGER NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    INDEX `LichSuTrangThaiPhieuGuiHang_phieu_thoiGian_idx`(`phieuGuiHangId`, `thoiGian`),
    INDEX `LichSuTrangThaiPhieuGuiHang_taiKhoan_thoiGian_idx`(`taiKhoanId`, `thoiGian`),
    PRIMARY KEY (`lichSuTrangThaiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Lich su gui/nhan theo tuyen duoc suy ra tu cac phieu gui hang da ton tai.
INSERT INTO `DiemGiaoNhanTuyenXe` (`vaiTro`, `tuyenXeId`, `diemGiaoNhanHangId`)
SELECT CASE
         WHEN MAX(`routePoint`.`isGui`) = 1 AND MAX(`routePoint`.`isNhan`) = 1 THEN 'CA_HAI'
         WHEN MAX(`routePoint`.`isGui`) = 1 THEN 'GUI_HANG'
         ELSE 'NHAN_HANG'
       END,
       `routePoint`.`tuyenXeId`, `routePoint`.`diemGiaoNhanHangId`
FROM (
    SELECT `trip`.`tuyenXeId`, `shipment`.`diemGuiId` AS `diemGiaoNhanHangId`, 1 AS `isGui`, 0 AS `isNhan`
    FROM `PhieuGuiHang` AS `shipment`
    INNER JOIN `ChuyenXe` AS `trip` ON `trip`.`chuyenXeId` = `shipment`.`chuyenXeId`
    UNION ALL
    SELECT `trip`.`tuyenXeId`, `shipment`.`diemNhanId` AS `diemGiaoNhanHangId`, 0 AS `isGui`, 1 AS `isNhan`
    FROM `PhieuGuiHang` AS `shipment`
    INNER JOIN `ChuyenXe` AS `trip` ON `trip`.`chuyenXeId` = `shipment`.`chuyenXeId`
) AS `routePoint`
GROUP BY `routePoint`.`tuyenXeId`, `routePoint`.`diemGiaoNhanHangId`;

CREATE INDEX `BangCuocGuiHang_diemGuiId_idx` ON `BangCuocGuiHang`(`diemGuiId`);
CREATE INDEX `BangCuocGuiHang_diemNhanId_idx` ON `BangCuocGuiHang`(`diemNhanId`);
CREATE INDEX `BangCuocGuiHang_loaiHangHoaId_idx` ON `BangCuocGuiHang`(`loaiHangHoaId`);
CREATE INDEX `PhieuGuiHang_diemGuiId_idx` ON `PhieuGuiHang`(`diemGuiId`);
CREATE INDEX `PhieuGuiHang_diemNhanId_idx` ON `PhieuGuiHang`(`diemNhanId`);

ALTER TABLE `DiemGiaoNhanHang`
    ADD CONSTRAINT `DiemGiaoNhanHang_nhaXeId_fkey`
      FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `DiemGiaoNhanTuyenXe`
    ADD CONSTRAINT `DiemGiaoNhanTuyenXe_tuyenXeId_fkey`
      FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `DiemGiaoNhanTuyenXe_diemGiaoNhanHangId_fkey`
      FOREIGN KEY (`diemGiaoNhanHangId`) REFERENCES `DiemGiaoNhanHang`(`diemGiaoNhanHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `BangCuocGuiHang`
    ADD CONSTRAINT `BangCuocGuiHang_diemGuiId_fkey`
      FOREIGN KEY (`diemGuiId`) REFERENCES `DiemGiaoNhanHang`(`diemGiaoNhanHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `BangCuocGuiHang_diemNhanId_fkey`
      FOREIGN KEY (`diemNhanId`) REFERENCES `DiemGiaoNhanHang`(`diemGiaoNhanHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `BangCuocGuiHang_loaiHangHoaId_fkey`
      FOREIGN KEY (`loaiHangHoaId`) REFERENCES `LoaiHangHoa`(`loaiHangHoaId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `PhieuGuiHang`
    ADD CONSTRAINT `PhieuGuiHang_chuyenXeId_fkey`
      FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `PhieuGuiHang_diemGuiId_fkey`
      FOREIGN KEY (`diemGuiId`) REFERENCES `DiemGiaoNhanHang`(`diemGiaoNhanHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `PhieuGuiHang_diemNhanId_fkey`
      FOREIGN KEY (`diemNhanId`) REFERENCES `DiemGiaoNhanHang`(`diemGiaoNhanHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `PhieuGuiHang_bangCuocApDungId_fkey`
      FOREIGN KEY (`bangCuocApDungId`) REFERENCES `BangCuocGuiHang`(`bangCuocGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `LichSuTrangThaiPhieuGuiHang`
    ADD CONSTRAINT `LichSuTrangThaiPhieuGuiHang_phieuGuiHangId_fkey`
      FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT `LichSuTrangThaiPhieuGuiHang_taiKhoanId_fkey`
      FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `PhieuGuiHang`
    RENAME INDEX `PhieuGuiHang_bangCuocApDungId_fkey` TO `PhieuGuiHang_bangCuocApDungId_idx`;

DROP TABLE `_MigrationShipmentTripMapping`;
DROP TABLE `_MigrationShipmentFareMapping`;
DROP TABLE `_MigrationShipmentCategoryGroupMapping`;
