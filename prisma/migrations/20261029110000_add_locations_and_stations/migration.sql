-- CreateTable
CREATE TABLE `DanhMucDiaDiem` (
    `diaDiemId` INTEGER NOT NULL AUTO_INCREMENT,
    `maDiaDiem` VARCHAR(50) NOT NULL,
    `code` INTEGER NOT NULL,
    `tenDiaDiem` VARCHAR(150) NOT NULL,
    `tenKhongDau` VARCHAR(150) NOT NULL,
    `capDiaDiem` VARCHAR(50) NOT NULL,
    `laDiaDanhCu` BOOLEAN NOT NULL DEFAULT false,
    `chuThichSapNhap` VARCHAR(255) NULL,
    `noiBat` BOOLEAN NOT NULL DEFAULT false,
    `thuTuHienThi` INTEGER NOT NULL DEFAULT 0,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'HOAT_DONG',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `DanhMucDiaDiem_laDiaDanhCu_capDiaDiem_idx`(`laDiaDanhCu`, `capDiaDiem`),
    INDEX `DanhMucDiaDiem_tenKhongDau_idx`(`tenKhongDau`),
    UNIQUE INDEX `DanhMucDiaDiem_code_laDiaDanhCu_key`(`code`, `laDiaDanhCu`),
    PRIMARY KEY (`diaDiemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BangSapNhapDiaDiem` (
    `bangSapNhapDiaDiemId` INTEGER NOT NULL AUTO_INCREMENT,
    `diaDiemMoiId` INTEGER NOT NULL,
    `diaDiemCuId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `BangSapNhapDiaDiem_diaDiemCuId_idx`(`diaDiemCuId`),
    UNIQUE INDEX `BangSapNhapDiaDiem_moi_cu_key`(`diaDiemMoiId`, `diaDiemCuId`),
    PRIMARY KEY (`bangSapNhapDiaDiemId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiemDonTra` (
    `diemDonTraId` INTEGER NOT NULL AUTO_INCREMENT,
    `maDiem` VARCHAR(50) NOT NULL,
    `tenDiem` VARCHAR(150) NOT NULL,
    `loaiDiem` VARCHAR(50) NOT NULL,
    `diaChi` VARCHAR(255) NOT NULL,
    `diaDiemMoiId` INTEGER NOT NULL,
    `diaDiemCuId` INTEGER NOT NULL,
    `viDo` DECIMAL(10, 7) NULL,
    `kinhDo` DECIMAL(10, 7) NULL,
    `soDienThoai` VARCHAR(20) NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'HOAT_DONG',
    `nhaXeId` INTEGER NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `DiemDonTra_diaDiemMoiId_idx`(`diaDiemMoiId`),
    INDEX `DiemDonTra_diaDiemCuId_idx`(`diaDiemCuId`),
    UNIQUE INDEX `DiemDonTra_nhaXeId_maDiem_key`(`nhaXeId`, `maDiem`),
    PRIMARY KEY (`diemDonTraId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiemDonTraChuyenXe` (
    `diemDonTraChuyenXeId` INTEGER NOT NULL AUTO_INCREMENT,
    `chuyenXeId` INTEGER NOT NULL,
    `diemDonTraId` INTEGER NOT NULL,
    `loaiDiem` VARCHAR(20) NOT NULL,
    `thoiGianDuKien` TIME(0) NULL,
    `thuTu` INTEGER NOT NULL DEFAULT 1,
    `phuPhi` DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `DiemDonTraChuyenXe_chuyenXeId_loaiDiem_idx`(`chuyenXeId`, `loaiDiem`),
    INDEX `DiemDonTraChuyenXe_diemDonTraId_idx`(`diemDonTraId`),
    PRIMARY KEY (`diemDonTraChuyenXeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BangSapNhapDiaDiem` ADD CONSTRAINT `BangSapNhapDiaDiem_diaDiemMoiId_fkey` FOREIGN KEY (`diaDiemMoiId`) REFERENCES `DanhMucDiaDiem`(`diaDiemId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `BangSapNhapDiaDiem` ADD CONSTRAINT `BangSapNhapDiaDiem_diaDiemCuId_fkey` FOREIGN KEY (`diaDiemCuId`) REFERENCES `DanhMucDiaDiem`(`diaDiemId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTra` ADD CONSTRAINT `DiemDonTra_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTra` ADD CONSTRAINT `DiemDonTra_diaDiemMoiId_fkey` FOREIGN KEY (`diaDiemMoiId`) REFERENCES `DanhMucDiaDiem`(`diaDiemId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTra` ADD CONSTRAINT `DiemDonTra_diaDiemCuId_fkey` FOREIGN KEY (`diaDiemCuId`) REFERENCES `DanhMucDiaDiem`(`diaDiemId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTraChuyenXe` ADD CONSTRAINT `DiemDonTraChuyenXe_chuyenXeId_fkey` FOREIGN KEY (`chuyenXeId`) REFERENCES `ChuyenXe`(`chuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `DiemDonTraChuyenXe` ADD CONSTRAINT `DiemDonTraChuyenXe_diemDonTraId_fkey` FOREIGN KEY (`diemDonTraId`) REFERENCES `DiemDonTra`(`diemDonTraId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
