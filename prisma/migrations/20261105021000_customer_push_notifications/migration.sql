CREATE TABLE `ThietBiThongBao` (
  `thietBiThongBaoId` INTEGER NOT NULL AUTO_INCREMENT,
  `tokenHash` CHAR(64) NOT NULL,
  `token` TEXT NOT NULL,
  `khachHangId` INTEGER NOT NULL,
  `taiKhoanId` INTEGER NOT NULL,
  `sessionId` CHAR(36) NOT NULL,
  `hoatDong` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`thietBiThongBaoId`),
  UNIQUE INDEX `ThietBiThongBao_tokenHash_key` (`tokenHash`),
  INDEX `ThietBiThongBao_khachHangId_hoatDong_idx` (`khachHangId`, `hoatDong`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushThongBao` (
  `pushThongBaoId` INTEGER NOT NULL AUTO_INCREMENT,
  `eventKey` VARCHAR(180) NOT NULL,
  `thongBaoId` INTEGER NOT NULL,
  `khachHangId` INTEGER NOT NULL,
  `thietBiThongBaoId` INTEGER NOT NULL,
  `sessionId` CHAR(36) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `trangThai` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `leaseToken` CHAR(36) NULL,
  `leaseUntil` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`pushThongBaoId`),
  UNIQUE INDEX `PushThongBao_eventKey_key` (`eventKey`),
  INDEX `PushThongBao_trangThai_createdAt_idx` (`trangThai`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
