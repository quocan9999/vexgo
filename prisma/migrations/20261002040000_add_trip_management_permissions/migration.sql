START TRANSACTION;

INSERT IGNORE INTO `VaiTro` (`tenVaiTro`, `moTa`) VALUES
  ('NHAN_VIEN_DIEU_HANH', 'Nhân viên điều hành');

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('trip:read', 'Xem danh sách, chi tiết và sơ đồ ghế chuyến xe trong phạm vi nhà xe.'),
  ('trip:create', 'Tạo chuyến xe mới và khởi tạo ghế chuyến trong phạm vi nhà xe.'),
  ('trip:update', 'Cập nhật chuyến xe và trạng thái vận hành trong phạm vi nhà xe.'),
  ('trip:cancel', 'Hủy chuyến xe trong phạm vi nhà xe.');

-- Grant trip permissions to NHA_XE_ADMIN
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN ('trip:read', 'trip:create', 'trip:update', 'trip:cancel')
WHERE `role`.`tenVaiTro` = 'NHA_XE_ADMIN';

-- Grant operational permissions to NHAN_VIEN_DIEU_HANH
INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM `VaiTro` AS `role`
JOIN `Quyen` AS `permission`
  ON `permission`.`tenQuyen` IN (
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
    'fare-price:update',
    'trip:read',
    'trip:create',
    'trip:update',
    'trip:cancel'
  )
WHERE `role`.`tenVaiTro` = 'NHAN_VIEN_DIEU_HANH';

COMMIT;
