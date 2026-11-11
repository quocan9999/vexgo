START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('booking:read', 'Xem danh sách, chi tiết và lịch sử phiếu đặt vé trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'booking:read'
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
