CREATE TABLE `YeuCauOtp` (
    `yeuCauOtpId` INTEGER NOT NULL AUTO_INCREMENT,
    `challengeId` CHAR(36) NOT NULL,
    `soDienThoai` VARCHAR(16) NOT NULL,
    `mucDich` VARCHAR(30) NOT NULL,
    `maOtpHash` CHAR(64) NOT NULL,
    `soLanThu` INTEGER NOT NULL DEFAULT 0,
    `hetHanLuc` DATETIME(3) NOT NULL,
    `daXacThucLuc` DATETIME(3) NULL,
    `proofHash` CHAR(64) NULL,
    `proofHetHanLuc` DATETIME(3) NULL,
    `daSuDungLuc` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `YeuCauOtp_challengeId_key`(`challengeId`),
    UNIQUE INDEX `YeuCauOtp_proofHash_key`(`proofHash`),
    UNIQUE INDEX `YeuCauOtp_soDienThoai_mucDich_key`(`soDienThoai`, `mucDich`),
    INDEX `YeuCauOtp_phone_purpose_updated_idx`(`soDienThoai`, `mucDich`, `updatedAt`),
    PRIMARY KEY (`yeuCauOtpId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
