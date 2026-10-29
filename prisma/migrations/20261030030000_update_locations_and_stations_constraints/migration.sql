-- AlterTable
ALTER TABLE `DanhMucDiaDiem` ADD COLUMN `diaDiemChaId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `BangSapNhapDiaDiem_diaDiemCuId_key` ON `BangSapNhapDiaDiem`(`diaDiemCuId`);

-- CreateIndex
CREATE UNIQUE INDEX `DanhMucDiaDiem_maDiaDiem_key` ON `DanhMucDiaDiem`(`maDiaDiem`);

-- CreateIndex
CREATE INDEX `DanhMucDiaDiem_diaDiemChaId_idx` ON `DanhMucDiaDiem`(`diaDiemChaId`);

-- CreateIndex
CREATE UNIQUE INDEX `DiemDonTraChuyenXe_chuyen_diem_loai_key` ON `DiemDonTraChuyenXe`(`chuyenXeId`, `diemDonTraId`, `loaiDiem`);

-- AddForeignKey
ALTER TABLE `DanhMucDiaDiem` ADD CONSTRAINT `DanhMucDiaDiem_diaDiemChaId_fkey` FOREIGN KEY (`diaDiemChaId`) REFERENCES `DanhMucDiaDiem`(`diaDiemId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
