START TRANSACTION;

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('role:read', 'Xem cấu hình quyền vai trò trong phạm vi nhà xe.'),
  ('permission:assign', 'Gán quyền cho vai trò trong phạm vi nhà xe.');

-- Only extend the unmodified legacy default. Customized VaiTroQuyen mappings are preserved.
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('role:read', 'permission:assign')
JOIN (
  SELECT `assigned`.`vaiTroId`
  FROM `VaiTroQuyen` AS `assigned`
  JOIN `Quyen` AS `assignedPermission`
    ON `assignedPermission`.`quyenId` = `assigned`.`quyenId`
  GROUP BY `assigned`.`vaiTroId`
  HAVING COUNT(*) = 16
    AND SUM(`assignedPermission`.`tenQuyen` IN (
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update'
    )) = 16
    AND SUM(`assignedPermission`.`tenQuyen` NOT IN (
      'vehicle-type:read',
      'vehicle-type:create',
      'vehicle-type:update',
      'vehicle:read',
      'vehicle:create',
      'vehicle:update',
      'seat:read',
      'seat:create',
      'seat:update',
      'seat:delete',
      'route:read',
      'route:create',
      'route:update',
      'fare-price:read',
      'fare-price:create',
      'fare-price:update'
    )) = 0
) AS `legacyMapping`
  ON `legacyMapping`.`vaiTroId` = `role`.`vaiTroId`
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
