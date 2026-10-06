-- Backfill legacy MO_BAN trip status to CHUA_KHOI_HANH
UPDATE `ChuyenXe`
SET `trangThai` = 'CHUA_KHOI_HANH'
WHERE `trangThai` = 'MO_BAN';
