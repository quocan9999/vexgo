START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('review:read', 'Xem danh sách và thống kê đánh giá, phản hồi trong phạm vi nhà xe.'),
  ('review:moderate', 'Kiểm duyệt (ẩn/hiển thị) đánh giá và phản hồi của khách hàng.');

-- Gán quyền mặc định cho NHA_XE_ADMIN
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('review:read', 'review:moderate')
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

-- Gán quyền mặc định cho NHAN_VIEN_CSKH (review:read)
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` = 'review:read'
WHERE `role`.`tenVaiTro` = 'NHAN_VIEN_CSKH';

COMMIT;
