-- AlterTable
ALTER TABLE `PhanHoi` ADD COLUMN `traLoi` TEXT NULL,
    ADD COLUMN `thoiGianTraLoi` DATETIME(0) NULL,
    ADD COLUMN `nguoiTraLoi` VARCHAR(100) NULL;
