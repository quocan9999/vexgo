START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('customer:read', 'Xem danh sách, chi tiết và lịch sử khách hàng có giao dịch trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'customer:read'
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
