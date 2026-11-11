START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('shipment:read', 'Xem danh sách và chi tiết phiếu gửi hàng trong phạm vi nhà xe.'),
  ('shipment:update', 'Cập nhật trạng thái phiếu gửi hàng trong phạm vi nhà xe.');

-- Add only the new global defaults. Tenant-specific permission overrides remain untouched.
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('shipment:read', 'shipment:update')
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
