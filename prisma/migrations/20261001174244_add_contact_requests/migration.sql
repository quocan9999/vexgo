-- DropIndex
DROP INDEX `BangGia_loaiXeId_fkey` ON `BangGia`;

-- DropIndex
DROP INDEX `ChuyenXe_tuyenXeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `ChuyenXe_xeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `Xe_loaiXeId_fkey` ON `Xe`;

-- CreateTable
CREATE TABLE `LienHe` (
    `lienHeId` INTEGER NOT NULL AUTO_INCREMENT,
    `hoTen` VARCHAR(100) NOT NULL,
    `soDienThoai` VARCHAR(20) NOT NULL,
    `email` VARCHAR(150) NULL,
    `tieuDe` VARCHAR(200) NOT NULL,
    `noiDung` TEXT NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'CHO_XU_LY',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`lienHeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
