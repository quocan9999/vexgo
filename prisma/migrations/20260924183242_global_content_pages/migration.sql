-- DropForeignKey
ALTER TABLE `TrangNoiDung` DROP FOREIGN KEY `TrangNoiDung_nhaXeId_fkey`;

-- DropIndex
DROP INDEX `TrangNoiDung_nhaXeId_slug_key` ON `TrangNoiDung`;

-- AlterTable
ALTER TABLE `PhienBanTrangNoiDung` MODIFY `ngayHieuLucTu` DATE NOT NULL,
    MODIFY `ngayHieuLucDen` DATE NULL;

-- AlterTable
ALTER TABLE `TrangNoiDung` DROP COLUMN `nhaXeId`;

-- CreateIndex
CREATE UNIQUE INDEX `TepDinhKem_storageKey_key` ON `TepDinhKem`(`storageKey`);

-- CreateIndex
CREATE UNIQUE INDEX `TrangNoiDung_slug_key` ON `TrangNoiDung`(`slug`);
