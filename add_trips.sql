SET @tuyenXeId = 1;
SET @nhaXeId = 1;
SET @xeId = (SELECT xeId FROM Xe WHERE nhaXeId=@nhaXeId LIMIT 1);

INSERT INTO ChuyenXe (maChuyenXe, ngayKhoiHanh, gioKhoiHanh, trangThai, nhaXeId, tuyenXeId, xeId, updatedAt)
VALUES 
('FUTA-CX-01102026-T1', '2026-10-01', '1970-01-01 07:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW()),
('FUTA-CX-01102026-T2', '2026-10-01', '1970-01-01 08:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW()),
('FUTA-CX-01102026-T3', '2026-10-01', '1970-01-01 09:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW()),
('FUTA-CX-01102026-T4', '2026-10-01', '1970-01-01 10:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW()),
('FUTA-CX-01102026-T5', '2026-10-01', '1970-01-01 11:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW()),
('FUTA-CX-01102026-T6', '2026-10-01', '1970-01-01 12:00:00', 'MO_BAN', @nhaXeId, @tuyenXeId, @xeId, NOW());

INSERT INTO GheChuyenXe (chuyenXeId, gheId, trangThai, updatedAt)
SELECT c.chuyenXeId, g.gheId, 'TRONG', NOW()
FROM ChuyenXe c
JOIN Ghe g ON g.xeId = c.xeId
WHERE c.ngayKhoiHanh = '2026-10-01';
