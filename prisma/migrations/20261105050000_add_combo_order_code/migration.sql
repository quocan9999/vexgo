-- AlterTable
ALTER TABLE `DonGiaoDich` ADD COLUMN `comboCode` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `DonGiaoDich_comboCode_idx` ON `DonGiaoDich`(`comboCode`);
