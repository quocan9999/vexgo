ALTER TABLE `Ghe`
  ADD COLUMN `tang` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `toaDoX` INTEGER NULL,
  ADD COLUMN `toaDoY` INTEGER NULL;

UPDATE `Ghe`
SET `tang` = 2
WHERE LOWER(COALESCE(`viTri`, '')) LIKE '%trên%'
   OR UPPER(`soGhe`) LIKE 'B%';

CREATE UNIQUE INDEX `Ghe_xeId_tang_toaDoX_toaDoY_key`
  ON `Ghe` (`xeId`, `tang`, `toaDoX`, `toaDoY`);

ALTER TABLE `GheChuyenXe`
  ADD COLUMN `tang` INTEGER NULL,
  ADD COLUMN `toaDoX` INTEGER NULL,
  ADD COLUMN `toaDoY` INTEGER NULL;
