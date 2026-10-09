START TRANSACTION;

-- Bring the operator role in line with the shared Admin permission defaults.
-- INSERT IGNORE preserves existing role grants and tenant-specific overrides.
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('shipment:read', 'shipment:update')
WHERE `role`.`tenVaiTro` = 'NHAN_VIEN_DIEU_HANH';

COMMIT;
