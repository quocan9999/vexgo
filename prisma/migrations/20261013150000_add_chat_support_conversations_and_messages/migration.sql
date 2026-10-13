-- DropForeignKey
ALTER TABLE `TinNhanHoTro` DROP FOREIGN KEY `TinNhanHoTro_khachHangId_fkey`;

-- DropIndex
DROP INDEX `TinNhanHoTro_khachHangId_fkey` ON `TinNhanHoTro`;

-- AlterTable
ALTER TABLE `TinNhanHoTro` DROP COLUMN `khachHangId`,
    DROP COLUMN `thoiGian`,
    ADD COLUMN `clientMessageId` VARCHAR(64) NULL,
    ADD COLUMN `cuocTroChuyenId` INTEGER NOT NULL,
    ADD COLUMN `daDocLuc` DATETIME(0) NULL,
    ADD COLUMN `loaiNguoiGui` VARCHAR(30) NOT NULL,
    ADD COLUMN `loaiTinNhan` VARCHAR(30) NOT NULL DEFAULT 'VAN_BAN',
    ADD COLUMN `taiKhoanGuiId` INTEGER NOT NULL,
    ADD COLUMN `tepDinhKemUrl` VARCHAR(500) NULL,
    MODIFY `trangThai` VARCHAR(30) NOT NULL DEFAULT 'DA_GUI';

-- CreateTable
CREATE TABLE `CuocTroChuyen` (
    `cuocTroChuyenId` INTEGER NOT NULL AUTO_INCREMENT,
    `maCuocTroChuyen` VARCHAR(50) NOT NULL,
    `tieuDe` VARCHAR(255) NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'CHO_TIEP_NHAN',
    `kenhHoTro` VARCHAR(20) NOT NULL DEFAULT 'WEB',
    `cheDoChat` VARCHAR(30) NOT NULL DEFAULT 'NGUOI_THAT',
    `khachHangId` INTEGER NOT NULL,
    `nhanVienId` INTEGER NULL,
    `nhaXeId` INTEGER NOT NULL,
    `dongLuc` DATETIME(0) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `CuocTroChuyen_maCuocTroChuyen_key`(`maCuocTroChuyen`),
    INDEX `CuocTroChuyen_nhaXe_trangThai_idx`(`nhaXeId`, `trangThai`),
    INDEX `CuocTroChuyen_khachHang_trangThai_idx`(`khachHangId`, `trangThai`),
    INDEX `CuocTroChuyen_nhanVien_trangThai_idx`(`nhanVienId`, `trangThai`),
    PRIMARY KEY (`cuocTroChuyenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `TinNhanHoTro_clientMessageId_key` ON `TinNhanHoTro`(`clientMessageId`);

-- CreateIndex
CREATE INDEX `TinNhanHoTro_cuocTroChuyenId_createdAt_idx` ON `TinNhanHoTro`(`cuocTroChuyenId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhanVienId_fkey` FOREIGN KEY (`nhanVienId`) REFERENCES `NhanVien`(`nhanVienId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `CuocTroChuyen` ADD CONSTRAINT `CuocTroChuyen_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_cuocTroChuyenId_fkey` FOREIGN KEY (`cuocTroChuyenId`) REFERENCES `CuocTroChuyen`(`cuocTroChuyenId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TinNhanHoTro` ADD CONSTRAINT `TinNhanHoTro_taiKhoanGuiId_fkey` FOREIGN KEY (`taiKhoanGuiId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
