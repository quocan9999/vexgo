-- AlterTable: đổi tên cột soGhe thành tenGhe và thêm maGhe
ALTER TABLE `Ghe`
  CHANGE COLUMN `soGhe` `tenGhe` VARCHAR(50) NOT NULL,
  ADD COLUMN `maGhe` VARCHAR(50) NULL;

-- Backfill mã UUID4 (32 ký tự hex lowercase) cho các ghế hiện có
UPDATE `Ghe`
SET `maGhe` = LOWER(REPLACE(UUID(), '-', ''))
WHERE `maGhe` IS NULL;

-- Đặt NOT NULL cho maGhe
ALTER TABLE `Ghe`
  MODIFY COLUMN `maGhe` VARCHAR(50) NOT NULL;

-- Cập nhật unique index cho tenGhe (trước đây là soGhe) và maGhe
DROP INDEX `Ghe_index_1` ON `Ghe`;
CREATE UNIQUE INDEX `Ghe_index_1` ON `Ghe` (`xeId`, `tenGhe`);
CREATE UNIQUE INDEX `Ghe_maGhe_key` ON `Ghe` (`maGhe`);
