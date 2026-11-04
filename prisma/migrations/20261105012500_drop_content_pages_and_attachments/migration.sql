-- DropForeignKey
ALTER TABLE `TepDinhKem` DROP FOREIGN KEY `TepDinhKem_phienBanTrangNoiDungId_fkey`;

-- DropForeignKey
ALTER TABLE `PhienBanTrangNoiDung` DROP FOREIGN KEY `PhienBanTrangNoiDung_trangNoiDungId_fkey`;

-- DropTable
DROP TABLE `TepDinhKem`;

-- DropTable
DROP TABLE `PhienBanTrangNoiDung`;

-- DropTable
DROP TABLE `TrangNoiDung`;
