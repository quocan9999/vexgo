-- A header row marks an explicit tenant override, including an empty override.
-- With no header row, the tenant continues to inherit the global role defaults.
CREATE TABLE `CauHinhQuyenVaiTroNhaXe` (
    `nhaXeId` INTEGER NOT NULL,
    `vaiTroId` INTEGER NOT NULL,

    INDEX `CauHinhQuyenVaiTroNhaXe_vaiTroId_idx`(`vaiTroId`),
    PRIMARY KEY (`nhaXeId`, `vaiTroId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CauHinhQuyenVaiTroNhaXeChiTiet` (
    `nhaXeId` INTEGER NOT NULL,
    `vaiTroId` INTEGER NOT NULL,
    `quyenId` INTEGER NOT NULL,

    INDEX `CauHinhQuyenVaiTroNhaXeChiTiet_quyenId_idx`(`quyenId`),
    PRIMARY KEY (`nhaXeId`, `vaiTroId`, `quyenId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CauHinhQuyenVaiTroNhaXe`
  ADD CONSTRAINT `CauHinhQuyenVaiTroNhaXe_nhaXeId_fkey`
  FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CauHinhQuyenVaiTroNhaXe`
  ADD CONSTRAINT `CauHinhQuyenVaiTroNhaXe_vaiTroId_fkey`
  FOREIGN KEY (`vaiTroId`) REFERENCES `VaiTro`(`vaiTroId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `CauHinhQuyenVaiTroNhaXeChiTiet`
  ADD CONSTRAINT `CauHinhQuyenVaiTroNhaXeChiTiet_nhaXeId_vaiTroId_fkey`
  FOREIGN KEY (`nhaXeId`, `vaiTroId`)
  REFERENCES `CauHinhQuyenVaiTroNhaXe`(`nhaXeId`, `vaiTroId`)
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `CauHinhQuyenVaiTroNhaXeChiTiet`
  ADD CONSTRAINT `CauHinhQuyenVaiTroNhaXeChiTiet_quyenId_fkey`
  FOREIGN KEY (`quyenId`) REFERENCES `Quyen`(`quyenId`)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
