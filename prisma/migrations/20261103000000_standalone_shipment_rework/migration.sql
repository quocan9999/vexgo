-- AlterTable
ALTER TABLE `PhieuGuiHang` ADD COLUMN `cuocDuTinh` DECIMAL(18, 2) NULL,
    ADD COLUMN `hanMangHangDen` DATETIME(0) NULL,
    ADD COLUMN `ngayDuKienGui` DATE NULL,
    ADD COLUMN `taiKhoanXacNhanCuocId` INTEGER NULL,
    ADD COLUMN `thoiDiemXacNhanCuoc` DATETIME(0) NULL,
    ADD COLUMN `tuyenXeId` INTEGER NULL,
    MODIFY `chuyenXeId` INTEGER NULL;

-- AlterTable
ALTER TABLE `HangHoa` ADD COLUMN `chieuCaoKhaiBao` DECIMAL(10, 2) NULL,
    ADD COLUMN `chieuCaoThucTe` DECIMAL(10, 2) NULL,
    ADD COLUMN `chieuDaiKhaiBao` DECIMAL(10, 2) NULL,
    ADD COLUMN `chieuDaiThucTe` DECIMAL(10, 2) NULL,
    ADD COLUMN `chieuRongKhaiBao` DECIMAL(10, 2) NULL,
    ADD COLUMN `chieuRongThucTe` DECIMAL(10, 2) NULL,
    ADD COLUMN `khoiLuongKhaiBao` DECIMAL(10, 2) NULL,
    ADD COLUMN `khoiLuongThucTe` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `ThanhToan` ADD COLUMN `taiKhoanXacNhanId` INTEGER NULL;

-- CreateTable
CREATE TABLE `LichSuDieuChinhCuocGuiHang` (
    `lichSuDieuChinhCuocGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    `phieuGuiHangId` INTEGER NOT NULL,
    `taiKhoanId` INTEGER NULL,
    `loaiThaoTac` VARCHAR(30) NOT NULL,
    `cuocTruoc` DECIMAL(18, 2) NULL,
    `cuocSau` DECIMAL(18, 2) NOT NULL,
    `lyDo` VARCHAR(500) NULL,
    `snapshotTruoc` JSON NULL,
    `snapshotSau` JSON NOT NULL,
    `thoiGian` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `LichSuDieuChinhCuocGuiHang_phieuGuiHangId_thoiGian_idx`(`phieuGuiHangId`, `thoiGian`),
    PRIMARY KEY (`lichSuDieuChinhCuocGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LichSuPhanChuyenGuiHang` (
    `lichSuPhanChuyenGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    `phieuGuiHangId` INTEGER NOT NULL,
    `chuyenXeTruocId` INTEGER NULL,
    `chuyenXeSauId` INTEGER NULL,
    `taiKhoanId` INTEGER NULL,
    `lyDo` VARCHAR(500) NULL,
    `thoiGian` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `LichSuPhanChuyenGuiHang_phieuGuiHangId_thoiGian_idx`(`phieuGuiHangId`, `thoiGian`),
    PRIMARY KEY (`lichSuPhanChuyenGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `XuLyTienGuiHang` (
    `xuLyTienGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    `phieuGuiHangId` INTEGER NOT NULL,
    `khoaSuKien` VARCHAR(191) NOT NULL,
    `lyDo` VARCHAR(50) NOT NULL,
    `soTien` DECIMAL(18, 2) NOT NULL,
    `trangThai` VARCHAR(30) NOT NULL DEFAULT 'CHO_XU_LY',
    `taiKhoanXuLyId` INTEGER NULL,
    `thoiDiemXuLy` DATETIME(0) NULL,
    `ketQua` VARCHAR(500) NULL,
    `thamChieu` VARCHAR(191) NULL,
    `thanhToanId` INTEGER NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `XuLyTienGuiHang_khoaSuKien_key`(`khoaSuKien`),
    INDEX `XuLyTienGuiHang_phieuGuiHangId_trangThai_idx`(`phieuGuiHangId`, `trangThai`),
    PRIMARY KEY (`xuLyTienGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `YeuCauTaoPhieuGuiHang` (
    `yeuCauTaoPhieuGuiHangId` INTEGER NOT NULL AUTO_INCREMENT,
    `phamVi` VARCHAR(100) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `phieuGuiHangId` INTEGER NULL,
    `ketQua` JSON NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `hetHanLuc` DATETIME(0) NOT NULL,

    UNIQUE INDEX `YeuCauTaoPhieuGuiHang_phamVi_key_key`(`phamVi`, `key`),
    PRIMARY KEY (`yeuCauTaoPhieuGuiHangId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `PhieuGuiHang_tuyenXeId_idx` ON `PhieuGuiHang`(`tuyenXeId`);

-- CreateIndex
CREATE INDEX `PhieuGuiHang_trangThai_hanMangHangDen_idx` ON `PhieuGuiHang`(`trangThai`, `hanMangHangDen`);

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_tuyenXeId_fkey` FOREIGN KEY (`tuyenXeId`) REFERENCES `TuyenXe`(`tuyenXeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PhieuGuiHang` ADD CONSTRAINT `PhieuGuiHang_taiKhoanXacNhanCuocId_fkey` FOREIGN KEY (`taiKhoanXacNhanCuocId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ThanhToan` ADD CONSTRAINT `ThanhToan_taiKhoanXacNhanId_fkey` FOREIGN KEY (`taiKhoanXacNhanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LichSuDieuChinhCuocGuiHang` ADD CONSTRAINT `LichSuDieuChinhCuocGuiHang_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LichSuDieuChinhCuocGuiHang` ADD CONSTRAINT `LichSuDieuChinhCuocGuiHang_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LichSuPhanChuyenGuiHang` ADD CONSTRAINT `LichSuPhanChuyenGuiHang_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `LichSuPhanChuyenGuiHang` ADD CONSTRAINT `LichSuPhanChuyenGuiHang_taiKhoanId_fkey` FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `XuLyTienGuiHang` ADD CONSTRAINT `XuLyTienGuiHang_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `XuLyTienGuiHang` ADD CONSTRAINT `XuLyTienGuiHang_taiKhoanXuLyId_fkey` FOREIGN KEY (`taiKhoanXuLyId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `XuLyTienGuiHang` ADD CONSTRAINT `XuLyTienGuiHang_thanhToanId_fkey` FOREIGN KEY (`thanhToanId`) REFERENCES `ThanhToan`(`thanhToanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `YeuCauTaoPhieuGuiHang` ADD CONSTRAINT `YeuCauTaoPhieuGuiHang_phieuGuiHangId_fkey` FOREIGN KEY (`phieuGuiHangId`) REFERENCES `PhieuGuiHang`(`phieuGuiHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Existing shipments retain their trip, prices, measurements and payments.
-- Do not infer a drop-off deadline or actual/declaration measurements for legacy rows.
UPDATE `PhieuGuiHang` p
JOIN `ChuyenXe` c ON c.`chuyenXeId` = p.`chuyenXeId`
SET p.`tuyenXeId` = c.`tuyenXeId`
WHERE p.`tuyenXeId` IS NULL;
