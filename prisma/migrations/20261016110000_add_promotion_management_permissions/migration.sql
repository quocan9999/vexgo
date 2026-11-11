START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('promotion:read', 'Xem khuyến mãi trong phạm vi nhà xe.'),
  ('promotion:create', 'Tạo khuyến mãi trong phạm vi nhà xe.'),
  ('promotion:update', 'Bật hoặc tạm ngưng khuyến mãi trong phạm vi nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN (
    'promotion:read',
    'promotion:create',
    'promotion:update'
  )
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
