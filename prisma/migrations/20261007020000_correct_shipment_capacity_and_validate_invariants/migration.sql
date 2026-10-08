-- Correct deployed databases without changing the already-applied migration 002 checksum.

-- A transaction that contains both a booking and a shipment must use the booking's trip.
-- Refuse ambiguous or inconsistent historical records instead of silently reassigning them.
CREATE TEMPORARY TABLE `_Shipment002ForwardPreflight` (
    `transactionTripConsistent` TINYINT NOT NULL,
    `everyShipmentHasCargo` TINYINT NOT NULL,
    CONSTRAINT `_Shipment002ForwardPreflight_transactionTrip_check`
      CHECK (`transactionTripConsistent` = 1),
    CONSTRAINT `_Shipment002ForwardPreflight_shipmentCargo_check`
      CHECK (`everyShipmentHasCargo` = 1)
);

INSERT INTO `_Shipment002ForwardPreflight` (`transactionTripConsistent`, `everyShipmentHasCargo`)
SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        INNER JOIN `PhieuDatVe` AS `booking`
          ON `booking`.`donGiaoDichId` = `shipment`.`donGiaoDichId`
        INNER JOIN `Ve` AS `ticket`
          ON `ticket`.`phieuDatVeId` = `booking`.`phieuDatVeId`
        INNER JOIN `GheChuyenXe` AS `tripSeat`
          ON `tripSeat`.`gheChuyenXeId` = `ticket`.`gheChuyenXeId`
        WHERE `tripSeat`.`chuyenXeId` <> `shipment`.`chuyenXeId`
    ) THEN 1 ELSE 0 END,
    CASE WHEN NOT EXISTS (
        SELECT 1
        FROM `PhieuGuiHang` AS `shipment`
        LEFT JOIN `HangHoa` AS `item`
          ON `item`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
        GROUP BY `shipment`.`phieuGuiHangId`
        HAVING COUNT(`item`.`hangHoaId`) = 0
    ) THEN 1 ELSE 0 END;

DROP TEMPORARY TABLE `_Shipment002ForwardPreflight`;

-- Preserve existing trip overrides, raising only snapshots that cannot cover active load.
UPDATE `ChuyenXe` AS `trip`
LEFT JOIN (
    SELECT `shipment`.`chuyenXeId`,
           SUM(CASE WHEN `cargoType`.`nhomSucChua` = 'XE_MAY' THEN `item`.`soLuong` ELSE 0 END) AS `xeMay`,
           SUM(CASE WHEN `cargoType`.`nhomSucChua` = 'HANG_CONG_KENH' THEN `item`.`soLuong` ELSE 0 END) AS `hangCongKenh`,
           SUM(CASE WHEN `cargoType`.`nhomSucChua` = 'HANG_NHE' THEN `item`.`soLuong` ELSE 0 END) AS `hangNhe`
    FROM `PhieuGuiHang` AS `shipment`
    INNER JOIN `HangHoa` AS `item`
      ON `item`.`phieuGuiHangId` = `shipment`.`phieuGuiHangId`
    INNER JOIN `LoaiHangHoa` AS `cargoType`
      ON `cargoType`.`loaiHangHoaId` = `item`.`loaiHangHoaId`
    WHERE `shipment`.`trangThai` NOT IN ('DA_GIAO', 'DA_HUY')
    GROUP BY `shipment`.`chuyenXeId`
) AS `activeShipmentLoad`
  ON `activeShipmentLoad`.`chuyenXeId` = `trip`.`chuyenXeId`
SET `trip`.`sucChuaXeMay` = GREATEST(`trip`.`sucChuaXeMay`, COALESCE(`activeShipmentLoad`.`xeMay`, 0)),
    `trip`.`sucChuaHangCongKenh` = GREATEST(`trip`.`sucChuaHangCongKenh`, COALESCE(`activeShipmentLoad`.`hangCongKenh`, 0)),
    `trip`.`sucChuaHangNhe` = GREATEST(`trip`.`sucChuaHangNhe`, COALESCE(`activeShipmentLoad`.`hangNhe`, 0));
