ALTER TABLE `ThanhToan`
  ADD COLUMN `maGiaoDichSePay` VARCHAR(100) NULL,
  ADD UNIQUE INDEX `ThanhToan_maGiaoDichSePay_key` (`maGiaoDichSePay`);
