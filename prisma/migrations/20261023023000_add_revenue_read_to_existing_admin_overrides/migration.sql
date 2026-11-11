-- Preserve existing overrides; roll out only the new F12 admin default.
-- Do not change employee roles or create override headers for inheriting tenants.
START TRANSACTION;

INSERT IGNORE INTO `CauHinhQuyenVaiTroNhaXeChiTiet` (`nhaXeId`, `vaiTroId`, `quyenId`)
SELECT `config`.`nhaXeId`, `config`.`vaiTroId`, `permission`.`quyenId`
FROM `CauHinhQuyenVaiTroNhaXe` AS `config`
JOIN `VaiTro` AS `role` ON `role`.`vaiTroId` = `config`.`vaiTroId`
JOIN `Quyen` AS `permission` ON `permission`.`tenQuyen` = 'revenue:read'
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

COMMIT;
