-- CreateTable
CREATE TABLE `GiuCho` (
    `giuChoId` INTEGER NOT NULL AUTO_INCREMENT,
    `tokenHash` CHAR(64) NOT NULL,
    `chuyenXeId` INTEGER NOT NULL,
    `taiKhoanId` INTEGER NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `hetHanLuc` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GiuCho_tokenHash_key`(`tokenHash`),
    INDEX `GiuCho_trip_expiry_idx`(`chuyenXeId`, `hetHanLuc`),
    INDEX `GiuCho_owner_session_expiry_idx`(`taiKhoanId`, `sessionId`, `hetHanLuc`),
    PRIMARY KEY (`giuChoId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiuChoGhe` (
    `giuChoGheId` INTEGER NOT NULL AUTO_INCREMENT,
    `giuChoId` INTEGER NOT NULL,
    `gheChuyenXeId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GiuChoGhe_giuChoId_idx`(`giuChoId`),
    UNIQUE INDEX `GiuChoGhe_gheChuyenXeId_key`(`gheChuyenXeId`),
    PRIMARY KEY (`giuChoGheId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GiuCho` ADD CONSTRAINT `GiuCho_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GiuCho` ADD CONSTRAINT `GiuCho_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GiuChoGhe` ADD CONSTRAINT `GiuChoGhe_giuChoId_fkey` FOREIGN KEY (`giuChoId`) REFERENCES `GiuCho`(`giuChoId`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GiuChoGhe` ADD CONSTRAINT `GiuChoGhe_gheChuyenXeId_fkey` FOREIGN KEY (`gheChuyenXeId`) REFERENCES `GheChuyenXe`(`gheChuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
