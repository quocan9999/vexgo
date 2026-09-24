-- AlterTable
ALTER TABLE `NhaXe` DROP COLUMN `chinhSachDoiHuy`;

-- CreateTable
CREATE TABLE `TrangNoiDung` (
    `trangNoiDungId` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `loaiTrang` VARCHAR(50) NOT NULL,
    `nhaXeId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `TrangNoiDung_nhaXeId_slug_key`(`nhaXeId`, `slug`),
    PRIMARY KEY (`trangNoiDungId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhienBanTrangNoiDung` (
    `phienBanTrangNoiDungId` INTEGER NOT NULL AUTO_INCREMENT,
    `soPhienBan` INTEGER NOT NULL,
    `tieuDe` VARCHAR(255) NOT NULL,
    `noiDung` LONGTEXT NOT NULL,
    `ngayHieuLucTu` DATETIME(0) NOT NULL,
    `ngayHieuLucDen` DATETIME(0) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL,
    `trangNoiDungId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `PhienBanTrangNoiDung_trangNoiDungId_soPhienBan_key`(`trangNoiDungId`, `soPhienBan`),
    PRIMARY KEY (`phienBanTrangNoiDungId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TepDinhKem` (
    `tepDinhKemId` INTEGER NOT NULL AUTO_INCREMENT,
    `tenTepGoc` VARCHAR(255) NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `kichThuoc` BIGINT NOT NULL,
    `phienBanTrangNoiDungId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `TepDinhKem_phienBanTrangNoiDungId_idx`(`phienBanTrangNoiDungId`),
    PRIMARY KEY (`tepDinhKemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrangNoiDung` ADD CONSTRAINT `TrangNoiDung_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhienBanTrangNoiDung` ADD CONSTRAINT `PhienBanTrangNoiDung_trangNoiDungId_fkey` FOREIGN KEY (`trangNoiDungId`) REFERENCES `TrangNoiDung`(`trangNoiDungId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TepDinhKem` ADD CONSTRAINT `TepDinhKem_phienBanTrangNoiDungId_fkey` FOREIGN KEY (`phienBanTrangNoiDungId`) REFERENCES `PhienBanTrangNoiDung`(`phienBanTrangNoiDungId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
