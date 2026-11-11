-- AlterTable
ALTER TABLE `GheChuyenXe` ADD COLUMN `giuChoId` INTEGER NULL;

-- CreateTable
CREATE TABLE `GiuCho` (
    `giuChoId` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` CHAR(64) NOT NULL,
    `chuyenXeId` INTEGER NOT NULL,
    `khachHangId` INTEGER NULL,
    `hetHanLuc` DATETIME(3) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'DANG_GIU',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GiuCho_tokenHash_key`(`tokenHash`),
    INDEX `GiuCho_chuyenXeId_hetHanLuc_idx`(`chuyenXeId`, `hetHanLuc`),
    INDEX `GiuCho_khachHangId_idx`(`khachHangId`),
    PRIMARY KEY (`giuChoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `GheChuyenXe_giuChoId_idx` ON `GheChuyenXe`(`giuChoId`);

-- AddForeignKey
ALTER TABLE `GheChuyenXe` ADD CONSTRAINT `GheChuyenXe_giuChoId_fkey` FOREIGN KEY (`giuChoId`) REFERENCES `GiuCho`(`giuChoId`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GiuCho` ADD CONSTRAINT `GiuCho_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GiuCho` ADD CONSTRAINT `GiuCho_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
