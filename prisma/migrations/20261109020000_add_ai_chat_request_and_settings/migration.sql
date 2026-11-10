-- CreateTable
CREATE TABLE `AiChatRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `requestId` VARCHAR(64) NOT NULL,
    `payloadHash` CHAR(64) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
    `sessionToken` VARCHAR(64) NULL,
    `taiKhoanId` INTEGER NULL,
    `khachHangId` INTEGER NULL,
    `recoveryKeyHash` CHAR(64) NULL,
    `responsePayload` JSON NULL,
    `errorMessage` TEXT NULL,
    `errorCode` VARCHAR(50) NULL,
    `leaseUntil` DATETIME(0) NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
    `expiresAt` DATETIME(0) NOT NULL,

    UNIQUE INDEX `AiChatRequest_requestId_key`(`requestId`),
    INDEX `AiChatRequest_taiKhoanId_status_idx`(`taiKhoanId`, `status`),
    INDEX `AiChatRequest_sessionToken_idx`(`sessionToken`),
    INDEX `AiChatRequest_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiChatbotSetting` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `idempotencyTtlDays` INTEGER NOT NULL DEFAULT 7,
    `leaseDurationSeconds` INTEGER NOT NULL DEFAULT 60,
    `contextHistoryLimit` INTEGER NOT NULL DEFAULT 10,
    `temperature` DECIMAL(3, 2) NOT NULL DEFAULT 0.15,
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert default setting record if not exists
INSERT INTO `AiChatbotSetting` (`id`, `idempotencyTtlDays`, `leaseDurationSeconds`, `contextHistoryLimit`, `temperature`)
VALUES (1, 7, 60, 10, 0.15)
ON DUPLICATE KEY UPDATE `id` = `id`;
