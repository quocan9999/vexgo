START TRANSACTION;

INSERT IGNORE INTO `VaiTro` (`tenVaiTro`, `moTa`) VALUES
  ('SUPER_ADMIN', 'Quản trị hệ thống'),
  ('NHA_XE_ADMIN', 'Quản trị nhà xe'),
  ('NHAN_VIEN_BAN_VE', 'Nhân viên bán vé'),
  ('NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng'),
  ('NHAN_VIEN_PHU_XE', 'Nhân viên phụ xe'),
  ('NHAN_VIEN_KINH_DOANH', 'Nhân viên kinh doanh'),
  ('KHACH_HANG', 'Khách hàng');

INSERT IGNORE INTO `Quyen` (`tenQuyen`, `moTa`) VALUES
  ('vehicle-type:read', 'Xem danh sách và chi tiết loại xe trong phạm vi nhà xe.'),
  ('vehicle-type:create', 'Tạo loại xe trong phạm vi nhà xe.'),
  ('vehicle-type:update', 'Cập nhật loại xe trong phạm vi nhà xe.'),
  ('vehicle:read', 'Xem danh sách và chi tiết xe trong phạm vi nhà xe.'),
  ('vehicle:create', 'Tạo xe trong phạm vi nhà xe.'),
  ('vehicle:update', 'Cập nhật xe và trạng thái xe trong phạm vi nhà xe.'),
  ('seat:read', 'Xem cấu hình ghế của xe trong phạm vi nhà xe.'),
  ('seat:create', 'Thêm ghế vào xe trong phạm vi nhà xe.'),
  ('seat:update', 'Cập nhật ghế của xe trong phạm vi nhà xe.'),
  ('seat:delete', 'Xóa ghế khỏi xe trong phạm vi nhà xe.'),
  ('route:read', 'Xem danh sách và chi tiết tuyến xe trong phạm vi nhà xe.'),
  ('route:create', 'Tạo tuyến xe trong phạm vi nhà xe.'),
  ('route:update', 'Cập nhật tuyến xe và trạng thái tuyến trong phạm vi nhà xe.'),
  ('fare-price:read', 'Xem và tra cứu bảng giá vé trong phạm vi nhà xe.'),
  ('fare-price:create', 'Tạo bảng giá vé trong phạm vi nhà xe.'),
  ('fare-price:update', 'Cập nhật bảng giá vé và trạng thái bảng giá trong phạm vi nhà xe.'),
  ('bus-company:read', 'Xem danh sách và chi tiết nhà xe trên nền tảng.'),
  ('bus-company:create', 'Tạo nhà xe trên nền tảng.'),
  ('bus-company:update', 'Cập nhật nhà xe và trạng thái nhà xe trên nền tảng.'),
  ('admin-account:read', 'Xem danh sách và chi tiết tài khoản quản trị trên nền tảng.'),
  ('admin-account:create', 'Tạo tài khoản quản trị nhà xe trên nền tảng.'),
  ('admin-account:update', 'Cập nhật và thay đổi trạng thái tài khoản quản trị nhà xe.');

INSERT IGNORE INTO `VaiTroQuyen` (`vaiTroId`, `quyenId`)
SELECT `role`.`vaiTroId`, `permission`.`quyenId`
FROM (
  SELECT 'SUPER_ADMIN' AS `roleName`, 'bus-company:read' AS `permissionKey`
  UNION ALL SELECT 'SUPER_ADMIN', 'bus-company:create'
  UNION ALL SELECT 'SUPER_ADMIN', 'bus-company:update'
  UNION ALL SELECT 'SUPER_ADMIN', 'admin-account:read'
  UNION ALL SELECT 'SUPER_ADMIN', 'admin-account:create'
  UNION ALL SELECT 'SUPER_ADMIN', 'admin-account:update'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle-type:read'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle-type:create'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle-type:update'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle:read'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle:create'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'vehicle:update'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'seat:read'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'seat:create'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'seat:update'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'seat:delete'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'route:read'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'route:create'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'route:update'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'fare-price:read'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'fare-price:create'
  UNION ALL SELECT 'NHA_XE_ADMIN', 'fare-price:update'
) AS `defaults`
JOIN `VaiTro` AS `role` ON `role`.`tenVaiTro` = `defaults`.`roleName`
JOIN `Quyen` AS `permission` ON `permission`.`tenQuyen` = `defaults`.`permissionKey`
WHERE NOT EXISTS (
  SELECT 1 FROM `VaiTroQuyen` AS `existing`
  WHERE `existing`.`vaiTroId` = `role`.`vaiTroId`
);

COMMIT;
