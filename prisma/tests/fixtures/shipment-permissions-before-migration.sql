CREATE TABLE `VaiTro` (
  `vaiTroId` INT NOT NULL AUTO_INCREMENT,
  `tenVaiTro` VARCHAR(50) NOT NULL,
  `moTa` VARCHAR(255) NULL,
  `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vaiTroId`),
  UNIQUE KEY `VaiTro_tenVaiTro_key` (`tenVaiTro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Quyen` (
  `quyenId` INT NOT NULL AUTO_INCREMENT,
  `tenQuyen` VARCHAR(100) NOT NULL,
  `moTa` VARCHAR(255) NULL,
  `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`quyenId`),
  UNIQUE KEY `Quyen_tenQuyen_key` (`tenQuyen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `VaiTroQuyen` (
  `vaiTroId` INT NOT NULL,
  `quyenId` INT NOT NULL,
  PRIMARY KEY (`vaiTroId`, `quyenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CauHinhQuyenVaiTroNhaXe` (
  `nhaXeId` INT NOT NULL,
  `vaiTroId` INT NOT NULL,
  PRIMARY KEY (`nhaXeId`, `vaiTroId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CauHinhQuyenVaiTroNhaXeChiTiet` (
  `nhaXeId` INT NOT NULL,
  `vaiTroId` INT NOT NULL,
  `quyenId` INT NOT NULL,
  PRIMARY KEY (`nhaXeId`, `vaiTroId`, `quyenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `VaiTro` (`vaiTroId`, `tenVaiTro`, `moTa`) VALUES
  (1, 'NHA_XE_ADMIN', 'Tenant admin'),
  (2, 'SUPER_ADMIN', 'Platform admin');

INSERT INTO `Quyen` (`quyenId`, `tenQuyen`, `moTa`) VALUES
  (1, 'vehicle:read', 'Existing tenant permission');

INSERT INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`) VALUES (1, 1);
INSERT INTO `CauHinhQuyenVaiTroNhaXe` (`nhaXeId`, `vaiTroId`) VALUES (777, 1);
INSERT INTO `CauHinhQuyenVaiTroNhaXeChiTiet` (`nhaXeId`, `vaiTroId`, `quyenId`) VALUES (777, 1, 1);
