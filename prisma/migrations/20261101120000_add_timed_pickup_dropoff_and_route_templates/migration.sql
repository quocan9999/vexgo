-- AlterTable
ALTER TABLE `DiemDonTra` ADD COLUMN `benTrungChuyenId` INTEGER NULL;

-- AlterTable
ALTER TABLE `DiemDonTraChuyenXe` ADD COLUMN `ghiChu` VARCHAR(255) NULL,
    ADD COLUMN `nhanKhach` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `phutCoMatTruoc` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `phutLech` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Ve` ADD COLUMN `diemDonChuyenXeId` INTEGER NULL,
    ADD COLUMN `diemDonSnapshot` JSON NULL,
    ADD COLUMN `diemTraChuyenXeId` INTEGER NULL,
    ADD COLUMN `diemTraSnapshot` JSON NULL;

-- CreateTable
CREATE TABLE `TuyenXeDiemDung` (
    `tuyenXeDiemDungId` INTEGER NOT NULL AUTO_INCREMENT,
    `tuyenXeId` INTEGER NOT NULL,
    `diemDonTraId` INTEGER NOT NULL,
    `loaiDiem` VARCHAR(20) NOT NULL,
    `phutLech` INTEGER NOT NULL,
    `thuTu` INTEGER NOT NULL DEFAULT 1,
    `phuPhi` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `phutCoMatTruoc` INTEGER NOT NULL DEFAULT 15,
    `nhanKhach` BOOLEAN NOT NULL DEFAULT true,
    `ghiChu` VARCHAR(255) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `TuyenXeDiemDung_tuyenXeId_loaiDiem_idx`(`tuyenXeId`, `loaiDiem`),
    INDEX `TuyenXeDiemDung_diemDonTraId_idx`(`diemDonTraId`),
    UNIQUE INDEX `TuyenXeDiemDung_tuyen_diem_loai_key`(`tuyenXeId`, `diemDonTraId`, `loaiDiem`),
    PRIMARY KEY (`tuyenXeDiemDungId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `DiemDonTra_benTrungChuyenId_idx` ON `DiemDonTra`(`benTrungChuyenId`);

-- CreateIndex
CREATE INDEX `Ve_diemDonChuyenXeId_idx` ON `Ve`(`diemDonChuyenXeId`);

-- CreateIndex
CREATE INDEX `Ve_diemTraChuyenXeId_idx` ON `Ve`(`diemTraChuyenXeId`);

-- AddForeignKey
ALTER TABLE `Ve` ADD CONSTRAINT `Ve_diemDonChuyenXeId_fkey` FOREIGN KEY (`diemDonChuyenXeId`) REFERENCES `DiemDonTraChuyenXe`(`diemDonTraChuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Ve` ADD CONSTRAINT `Ve_diemTraChuyenXeId_fkey` FOREIGN KEY (`diemTraChuyenXeId`) REFERENCES `DiemDonTraChuyenXe`(`diemDonTraChuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTra` ADD CONSTRAINT `DiemDonTra_benTrungChuyenId_fkey` FOREIGN KEY (`benTrungChuyenId`) REFERENCES `DiemDonTra`(`diemDonTraId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TuyenXeDiemDung` ADD CONSTRAINT `TuyenXeDiemDung_tuyenXeId_fkey` FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TuyenXeDiemDung` ADD CONSTRAINT `TuyenXeDiemDung_diemDonTraId_fkey` FOREIGN KEY (`diemDonTraId`) REFERENCES `DiemDonTra`(`diemDonTraId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
