-- CreateTable
CREATE TABLE `AiKnowledgeDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentCode` VARCHAR(100) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `scope` VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    `nhaXeId` INTEGER NULL,
    `hierarchyPath` VARCHAR(500) NOT NULL,
    `rawContent` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `AiKnowledgeDocument_documentCode_key`(`documentCode`),
    INDEX `AiKnowledgeDocument_nhaXeId_idx`(`nhaXeId`),
    INDEX `AiKnowledgeDocument_category_scope_isActive_idx`(`category`, `scope`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiKnowledgeChunk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `headerPrefix` VARCHAR(500) NOT NULL,
    `rawContent` TEXT NOT NULL,
    `groundedContent` TEXT NOT NULL,
    `embedding` JSON NOT NULL,
    `embeddingModel` VARCHAR(50) NOT NULL DEFAULT 'jina-embeddings-v3',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `AiKnowledgeChunk_documentId_idx`(`documentId`),
    UNIQUE INDEX `AiKnowledgeChunk_documentId_chunkIndex_key`(`documentId`, `chunkIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiChatSession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionToken` VARCHAR(64) NOT NULL,
    `khachHangId` INTEGER NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `AiChatSession_sessionToken_key`(`sessionToken`),
    INDEX `AiChatSession_khachHangId_idx`(`khachHangId`),
    INDEX `AiChatSession_sessionToken_idx`(`sessionToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiChatMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `content` TEXT NOT NULL,
    `intent` VARCHAR(50) NULL,
    `citations` JSON NULL,
    `toolCalls` JSON NULL,
    `requiresHumanHandoff` BOOLEAN NOT NULL DEFAULT false,
    `latencyMs` INTEGER NULL,
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `AiChatMessage_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiKnowledgeDocument` ADD CONSTRAINT `AiKnowledgeDocument_nhaXeId_fkey` FOREIGN KEY (`nhaXeId`) REFERENCES `NhaXe`(`nhaXeId`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AiKnowledgeChunk` ADD CONSTRAINT `AiKnowledgeChunk_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `AiKnowledgeDocument`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AiChatSession` ADD CONSTRAINT `AiChatSession_khachHangId_fkey` FOREIGN KEY (`khachHangId`) REFERENCES `KhachHang`(`khachHangId`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `AiChatMessage` ADD CONSTRAINT `AiChatMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `AiChatSession`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT;
