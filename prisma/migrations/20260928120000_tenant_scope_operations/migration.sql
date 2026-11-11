-- Tenantize vehicle types and make ownership consistency enforceable by MariaDB.
-- Existing global vehicle types are copied once per bus company that uses them.
-- Ownership is derived only from existing Xe and BangGia -> TuyenXe references.

ALTER TABLE `LoaiXe` ADD COLUMN `nhaXeId` INT NULL;
ALTER TABLE `BangGia` ADD COLUMN `nhaXeId` INT NULL;
ALTER TABLE `ChuyenXe` ADD COLUMN `nhaXeId` INT NULL;

CREATE TEMPORARY TABLE `_LoaiXeTenantBackfill` (
  `oldLoaiXeId` INT NOT NULL,
  `nhaXeId` INT NOT NULL,
  `newLoaiXeId` INT NULL,
  PRIMARY KEY (`oldLoaiXeId`, `nhaXeId`)
) ENGINE=InnoDB;

INSERT INTO `_LoaiXeTenantBackfill` (`oldLoaiXeId`, `nhaXeId`)
SELECT DISTINCT `owners`.`loaiXeId`, `owners`.`nhaXeId`
FROM (
  SELECT `x`.`loaiXeId`, `x`.`nhaXeId`
  FROM `Xe` AS `x`
  UNION ALL
  SELECT `bg`.`loaiXeId`, `tx`.`nhaXeId`
  FROM `BangGia` AS `bg`
  INNER JOIN `TuyenXe` AS `tx` ON `tx`.`tuyenXeId` = `bg`.`tuyenXeId`
) AS `owners`;

UPDATE `LoaiXe` AS `lx`
INNER JOIN (
  SELECT `oldLoaiXeId`, MIN(`nhaXeId`) AS `keptNhaXeId`
  FROM `_LoaiXeTenantBackfill`
  GROUP BY `oldLoaiXeId`
) AS `owners` ON `owners`.`oldLoaiXeId` = `lx`.`loaiXeId`
SET `lx`.`nhaXeId` = `owners`.`keptNhaXeId`;

-- Fail before cloning/remapping if a current LoaiXe has no resolvable owner.
ALTER TABLE `LoaiXe` MODIFY `nhaXeId` INT NOT NULL;

ALTER TABLE `LoaiXe` DROP INDEX `LoaiXe_index_0`;

INSERT INTO `LoaiXe` (`nhaXeId`, `tenLoai`, `moTa`, `createdAt`, `updatedAt`)
SELECT `owners`.`nhaXeId`, `original`.`tenLoai`, `original`.`moTa`,
       `original`.`createdAt`, `original`.`updatedAt`
FROM `_LoaiXeTenantBackfill` AS `owners`
INNER JOIN `LoaiXe` AS `original` ON `original`.`loaiXeId` = `owners`.`oldLoaiXeId`
WHERE `owners`.`nhaXeId` <> `original`.`nhaXeId`;

UPDATE `_LoaiXeTenantBackfill` AS `owners`
INNER JOIN `LoaiXe` AS `original` ON `original`.`loaiXeId` = `owners`.`oldLoaiXeId`
INNER JOIN `LoaiXe` AS `scoped`
  ON `scoped`.`nhaXeId` = `owners`.`nhaXeId`
 AND `scoped`.`tenLoai` = `original`.`tenLoai`
SET `owners`.`newLoaiXeId` = `scoped`.`loaiXeId`;

UPDATE `Xe` AS `x`
INNER JOIN `_LoaiXeTenantBackfill` AS `owners`
  ON `owners`.`oldLoaiXeId` = `x`.`loaiXeId`
 AND `owners`.`nhaXeId` = `x`.`nhaXeId`
SET `x`.`loaiXeId` = `owners`.`newLoaiXeId`;

UPDATE `BangGia` AS `bg`
INNER JOIN `TuyenXe` AS `tx` ON `tx`.`tuyenXeId` = `bg`.`tuyenXeId`
INNER JOIN `_LoaiXeTenantBackfill` AS `owners`
  ON `owners`.`oldLoaiXeId` = `bg`.`loaiXeId`
 AND `owners`.`nhaXeId` = `tx`.`nhaXeId`
SET `bg`.`loaiXeId` = `owners`.`newLoaiXeId`,
    `bg`.`nhaXeId` = `tx`.`nhaXeId`;

UPDATE `ChuyenXe` AS `cx`
INNER JOIN `TuyenXe` AS `tx` ON `tx`.`tuyenXeId` = `cx`.`tuyenXeId`
SET `cx`.`nhaXeId` = `tx`.`nhaXeId`;

DROP TEMPORARY TABLE `_LoaiXeTenantBackfill`;

ALTER TABLE `BangGia` MODIFY `nhaXeId` INT NOT NULL;
ALTER TABLE `ChuyenXe` MODIFY `nhaXeId` INT NOT NULL;

ALTER TABLE `Xe` DROP FOREIGN KEY `Xe_loaiXeId_fkey`;
ALTER TABLE `BangGia` DROP FOREIGN KEY `BangGia_tuyenXeId_fkey`;
ALTER TABLE `BangGia` DROP FOREIGN KEY `BangGia_loaiXeId_fkey`;
ALTER TABLE `ChuyenXe` DROP FOREIGN KEY `ChuyenXe_xeId_fkey`;
ALTER TABLE `ChuyenXe` DROP FOREIGN KEY `ChuyenXe_tuyenXeId_fkey`;

CREATE UNIQUE INDEX `LoaiXe_nhaXeId_tenLoai_key` ON `LoaiXe`(`nhaXeId`, `tenLoai`);
CREATE UNIQUE INDEX `LoaiXe_nhaXeId_loaiXeId_key` ON `LoaiXe`(`nhaXeId`, `loaiXeId`);
CREATE UNIQUE INDEX `Xe_nhaXeId_xeId_key` ON `Xe`(`nhaXeId`, `xeId`);
CREATE INDEX `Xe_nhaXeId_loaiXeId_idx` ON `Xe`(`nhaXeId`, `loaiXeId`);
CREATE UNIQUE INDEX `TuyenXe_nhaXeId_tuyenXeId_key` ON `TuyenXe`(`nhaXeId`, `tuyenXeId`);
CREATE INDEX `BangGia_nhaXeId_tuyenXeId_idx` ON `BangGia`(`nhaXeId`, `tuyenXeId`);
CREATE INDEX `BangGia_nhaXeId_loaiXeId_idx` ON `BangGia`(`nhaXeId`, `loaiXeId`);
CREATE INDEX `ChuyenXe_nhaXeId_xeId_idx` ON `ChuyenXe`(`nhaXeId`, `xeId`);
CREATE INDEX `ChuyenXe_nhaXeId_tuyenXeId_idx` ON `ChuyenXe`(`nhaXeId`, `tuyenXeId`);

ALTER TABLE `LoaiXe`
  ADD CONSTRAINT `LoaiXe_nhaXeId_fkey`
  FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `Xe`
  ADD CONSTRAINT `Xe_nhaXeId_loaiXeId_fkey`
  FOREIGN KEY (`nhaXeId`, `loaiXeId`) REFERENCES `LoaiXe`(`nhaXeId`, `loaiXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `BangGia`
  ADD CONSTRAINT `BangGia_nhaXeId_tuyenXeId_fkey`
  FOREIGN KEY (`nhaXeId`, `tuyenXeId`) REFERENCES `TuyenXe`(`nhaXeId`, `tuyenXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `BangGia`
  ADD CONSTRAINT `BangGia_nhaXeId_loaiXeId_fkey`
  FOREIGN KEY (`nhaXeId`, `loaiXeId`) REFERENCES `LoaiXe`(`nhaXeId`, `loaiXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ChuyenXe`
  ADD CONSTRAINT `ChuyenXe_nhaXeId_xeId_fkey`
  FOREIGN KEY (`nhaXeId`, `xeId`) REFERENCES `Xe`(`nhaXeId`, `xeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE `ChuyenXe`
  ADD CONSTRAINT `ChuyenXe_nhaXeId_tuyenXeId_fkey`
  FOREIGN KEY (`nhaXeId`, `tuyenXeId`) REFERENCES `TuyenXe`(`nhaXeId`, `tuyenXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
