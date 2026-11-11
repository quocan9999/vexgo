-- DropIndex
DROP INDEX `BangGia_loaiXeId_fkey` ON `BangGia`;

-- DropIndex
DROP INDEX `ChuyenXe_tuyenXeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `ChuyenXe_xeId_fkey` ON `ChuyenXe`;

-- DropIndex
DROP INDEX `Xe_loaiXeId_fkey` ON `Xe`;

-- AlterTable
ALTER TABLE `ChuyenXe` ADD COLUMN `gioDen` TIME(0) NULL;

-- AlterTable
ALTER TABLE `TuyenXe` ADD COLUMN `thoiGianChayPhut` INTEGER NULL;
