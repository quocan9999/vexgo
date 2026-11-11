CREATE TABLE `PhienDangNhap` (
    `phienDangNhapId` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` CHAR(36) NOT NULL,
    `refreshTokenHash` CHAR(64) NOT NULL,
    `hetHanLuc` DATETIME(3) NOT NULL,
    `thuHoiLuc` DATETIME(3) NULL,
    `tokenThayTheId` INTEGER NULL,
    `taiKhoanId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PhienDangNhap_sessionId_key`(`sessionId`),
    UNIQUE INDEX `PhienDangNhap_refreshTokenHash_key`(`refreshTokenHash`),
    UNIQUE INDEX `PhienDangNhap_tokenThayTheId_key`(`tokenThayTheId`),
    INDEX `PhienDangNhap_account_active_idx`(`taiKhoanId`, `thuHoiLuc`, `hetHanLuc`),
    PRIMARY KEY (`phienDangNhapId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PhienDangNhap`
    ADD CONSTRAINT `PhienDangNhap_taiKhoanId_fkey`
    FOREIGN KEY (`taiKhoanId`) REFERENCES `TaiKhoan`(`taiKhoanId`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `PhienDangNhap`
    ADD CONSTRAINT `PhienDangNhap_tokenThayTheId_fkey`
    FOREIGN KEY (`tokenThayTheId`) REFERENCES `PhienDangNhap`(`phienDangNhapId`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
