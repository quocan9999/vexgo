START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('revenue:read', 'Xem báo cáo doanh thu trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'revenue:read'
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
