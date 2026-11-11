START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('trip:delete', 'Xóa chuyến chưa phát sinh giao dịch trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'trip:delete'
WHERE `role`.`tenVaiTro` IN ('NHA_XE_ADMIN', 'NHAN_VIEN_DIEU_HANH');

COMMIT;
