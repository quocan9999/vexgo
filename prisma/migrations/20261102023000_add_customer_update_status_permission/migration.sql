START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('customer:update_status', 'Quản trị trạng thái hoạt động (khóa hoặc mở khóa) của tài khoản khách hàng trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'customer:update_status'
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
