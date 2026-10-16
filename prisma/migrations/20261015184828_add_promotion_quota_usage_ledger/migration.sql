-- Upgrade populated develop databases without deleting promotions or their references.
-- Legacy promotions have no defined lifetime quota/usage ledger. Preserve their business
-- fields and disable redemption until they are explicitly reconfigured outside this MVP.
ALTER TABLE `KhuyenMai` ADD COLUMN `soLuotDaSuDung` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `soLuotToiDa` INTEGER NULL;

UPDATE `KhuyenMai`
SET `soLuotToiDa` = 1,
    `maKhuyenMai` = COALESCE(`maKhuyenMai`, CONCAT('LEGACY-', `khuyenMaiId`)),
    `denNgay` = COALESCE(`denNgay`, `tuNgay`),
    `trangThai` = 'LEGACY_UNCONFIGURED';

ALTER TABLE `KhuyenMai` MODIFY `soLuotToiDa` INTEGER NOT NULL,
    MODIFY `maKhuyenMai` VARCHAR(50) NOT NULL,
    MODIFY `denNgay` DATE NOT NULL;

-- AlterTable
ALTER TABLE `PhieuDatVe` ADD COLUMN `soTienGiamKhuyenMai` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `SuDungKhuyenMai` (
    `suDungKhuyenMaiId` INTEGER NOT NULL AUTO_INCREMENT,
    `khuyenMaiId` INTEGER NOT NULL,
    `phieuDatVeId` INTEGER NOT NULL,
    `khachHangId` INTEGER NULL,
    `soDienThoaiChuanHoa` VARCHAR(16) NULL,
    `soTienGiam` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `SuDungKhuyenMai_phieuDatVeId_key`(`phieuDatVeId`),
    UNIQUE INDEX `SuDungKhuyenMai_khuyenMaiId_soDienThoaiChuanHoa_key`(`khuyenMaiId`, `soDienThoaiChuanHoa`),
    UNIQUE INDEX `SuDungKhuyenMai_khuyenMaiId_khachHangId_key`(`khuyenMaiId`, `khachHangId`),
    PRIMARY KEY (`suDungKhuyenMaiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SuDungKhuyenMai` ADD CONSTRAINT `SuDungKhuyenMai_khuyenMaiId_fkey` FOREIGN KEY (`khuyenMaiId`) REFERENCES `KhuyenMai`(`khuyenMaiId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SuDungKhuyenMai` ADD CONSTRAINT `SuDungKhuyenMai_phieuDatVeId_fkey` FOREIGN KEY (`phieuDatVeId`) REFERENCES `PhieuDatVe`(`phieuDatVeId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `SuDungKhuyenMai` ADD CONSTRAINT `SuDungKhuyenMai_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma schema DSL does not represent MySQL CHECK constraints; keep these database invariants in the migration.
ALTER TABLE `KhuyenMai`
    ADD CONSTRAINT `KhuyenMai_quota_positive_used_range_chk`
    CHECK (`soLuotToiDa` > 0 AND `soLuotDaSuDung` >= 0 AND `soLuotDaSuDung` <= `soLuotToiDa`);

ALTER TABLE `PhieuDatVe`
    ADD CONSTRAINT `PhieuDatVe_discount_non_negative_chk`
    CHECK (`soTienGiamKhuyenMai` >= 0);

ALTER TABLE `SuDungKhuyenMai`
    ADD CONSTRAINT `SuDungKhuyenMai_discount_non_negative_chk`
    CHECK (`soTienGiam` >= 0);
