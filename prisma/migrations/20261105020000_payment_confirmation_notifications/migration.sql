-- AlterTable
ALTER TABLE `ThongBao` ADD COLUMN `bookingId` INTEGER NULL,
    ADD COLUMN `category` VARCHAR(30) NOT NULL DEFAULT 'SYSTEM',
    ADD COLUMN `eventKey` VARCHAR(100) NULL,
    ADD COLUMN `ticketId` INTEGER NULL;

-- CreateTable
CREATE TABLE `EmailThongBao` (
    `emailThongBaoId` INTEGER NOT NULL AUTO_INCREMENT,
    `eventKey` VARCHAR(100) NOT NULL,
    `nguoiNhan` VARCHAR(150) NOT NULL,
    `tieuDe` VARCHAR(150) NOT NULL,
    `noiDung` TEXT NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    `soLanThu` INTEGER NOT NULL DEFAULT 0,
    `thuLaiLuc` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leaseToken` VARCHAR(36) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailThongBao_eventKey_key`(`eventKey`),
    INDEX `EmailThongBao_trangThai_thuLaiLuc_idx`(`trangThai`, `thuLaiLuc`),
    PRIMARY KEY (`emailThongBaoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ThongBao_eventKey_key` ON `ThongBao`(`eventKey`);
