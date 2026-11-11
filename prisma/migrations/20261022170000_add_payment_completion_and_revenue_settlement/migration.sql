ALTER TABLE `ThanhToan`
  ADD COLUMN `thoiDiemHoanTat` DATETIME(0) NULL,
  ADD COLUMN `laQuyetToanHopLe` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `ThanhToan_revenue_report_idx` (`loaiGiaoDich`, `trangThai`, `laQuyetToanHopLe`, `thoiDiemHoanTat`);
