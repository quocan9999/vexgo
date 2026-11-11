-- DropForeignKey
ALTER TABLE `BangCuocGuiHang` DROP FOREIGN KEY `BangCuocGuiHang_diemGuiId_fkey`;

-- DropForeignKey
ALTER TABLE `BangCuocGuiHang` DROP FOREIGN KEY `BangCuocGuiHang_diemNhanId_fkey`;

-- DropIndex
DROP INDEX `BangCuocGuiHang_diemGuiId_idx` ON `BangCuocGuiHang`;

-- DropIndex
DROP INDEX `BangCuocGuiHang_diemNhanId_idx` ON `BangCuocGuiHang`;

-- AlterTable
ALTER TABLE `BangCuocGuiHang` DROP COLUMN `diemGuiId`,
    DROP COLUMN `diemNhanId`,
    ADD COLUMN `tuyenXeId` INTEGER NOT NULL;

-- Backfill legacy records to a valid route if any exist
UPDATE `BangCuocGuiHang` SET `tuyenXeId` = (SELECT `tuyenXeId` FROM `TuyenXe` ORDER BY `tuyenXeId` ASC LIMIT 1) WHERE `tuyenXeId` = 0;

-- CreateIndex
CREATE INDEX `BangCuocGuiHang_tuyenXeId_idx` ON `BangCuocGuiHang`(`tuyenXeId`);

-- AddForeignKey
ALTER TABLE `BangCuocGuiHang` ADD CONSTRAINT `BangCuocGuiHang_tuyenXeId_fkey` FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
