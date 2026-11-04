-- CreateTable
CREATE TABLE `TaiNguyenMedia` (
    `taiNguyenMediaId` VARCHAR(36) NOT NULL,
    `yeuCauId` VARCHAR(36) NOT NULL,
    `nhaXeId` INTEGER NOT NULL,
    `xeId` INTEGER NOT NULL,
    `taiKhoanTaoId` INTEGER NOT NULL,
    `mucDich` VARCHAR(30) NOT NULL DEFAULT 'ANH_XE',
    `trangThai` VARCHAR(30) NOT NULL,
    `tenCloud` VARCHAR(128) NOT NULL,
    `thuMuc` VARCHAR(255) NOT NULL,
    `cloudinaryPublicId` VARCHAR(500) NOT NULL,
    `cloudinaryAssetId` VARCHAR(128) NULL,
    `sha256` CHAR(64) NOT NULL,
    `urlCongKhai` VARCHAR(1000) NULL,
    `phienBan` BIGINT NULL,
    `kichThuoc` INTEGER NULL,
    `chieuRong` INTEGER NULL,
    `chieuCao` INTEGER NULL,
    `dinhDang` VARCHAR(20) NULL,
    `daGoLuc` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaiNguyenMedia_cloudinaryPublicId_key`(`cloudinaryPublicId`),
    UNIQUE INDEX `TaiNguyenMedia_cloudinaryAssetId_key`(`cloudinaryAssetId`),
    INDEX `TaiNguyenMedia_vehicle_status_idx`(`nhaXeId`, `xeId`, `trangThai`),
    UNIQUE INDEX `TaiNguyenMedia_tenant_request_key`(`nhaXeId`, `yeuCauId`),
    PRIMARY KEY (`taiNguyenMediaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
-- Removing an otherwise deletable unused vehicle also removes its image links.
-- This never deletes the Cloudinary file; older DB backups still reference it.
ALTER TABLE `TaiNguyenMedia` ADD CONSTRAINT `TaiNguyenMedia_nhaXeId_xeId_fkey` FOREIGN KEY (`nhaXeId`, `xeId`) REFERENCES `Xe`(`nhaXeId`, `xeId`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `TaiNguyenMedia` ADD CONSTRAINT `TaiNguyenMedia_taiKhoanTaoId_fkey` FOREIGN KEY (`taiKhoanTaoId`) REFERENCES `TaiKhoan`(`taiKhoanId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `TaiNguyenMedia`
  ADD CONSTRAINT `TaiNguyenMedia_purpose_check` CHECK (`mucDich` = 'ANH_XE'),
  ADD CONSTRAINT `TaiNguyenMedia_status_check` CHECK (`trangThai` IN ('DANG_TAI', 'CHO_DOI_SOAT', 'SAN_SANG', 'DA_GO')),
  ADD CONSTRAINT `TaiNguyenMedia_ready_check` CHECK (`trangThai` <> 'SAN_SANG' OR
    (`cloudinaryAssetId` IS NOT NULL AND `urlCongKhai` IS NOT NULL AND `phienBan` IS NOT NULL
     AND `kichThuoc` IS NOT NULL AND `chieuRong` IS NOT NULL AND `chieuCao` IS NOT NULL AND `dinhDang` IS NOT NULL
     AND `kichThuoc` > 0 AND `chieuRong` > 0 AND `chieuCao` > 0 AND `dinhDang` = 'webp')),
  ADD CONSTRAINT `TaiNguyenMedia_removed_check` CHECK ((`trangThai` = 'DA_GO') = (`daGoLuc` IS NOT NULL));
