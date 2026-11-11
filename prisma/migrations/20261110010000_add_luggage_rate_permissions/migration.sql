INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`)
VALUES
  ('luggage-rate:read', 'Xem cấu hình cước hành lý nhà xe.'),
  ('luggage-rate:update', 'Cập nhật cấu hình cước hành lý nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT role.`vaiTroId`, permission.`quyenId`
FROM `VaiTro` AS role
JOIN `Quyen` AS permission
  ON permission.`tenQuyen` IN ('luggage-rate:read', 'luggage-rate:update')
WHERE role.`tenVaiTro` = 'NHA_XE_ADMIN';

INSERT IGNORE INTO `CauHinhQuyenVaiTroNhaXeChiTiet` (`nhaXeId`, `vaiTroId`, `quyenId`)
SELECT config.`nhaXeId`, config.`vaiTroId`, permission.`quyenId`
FROM `CauHinhQuyenVaiTroNhaXe` AS config
JOIN `VaiTro` AS role ON role.`vaiTroId` = config.`vaiTroId`
JOIN `Quyen` AS permission
  ON permission.`tenQuyen` IN ('luggage-rate:read', 'luggage-rate:update')
WHERE role.`tenVaiTro` = 'NHA_XE_ADMIN';
