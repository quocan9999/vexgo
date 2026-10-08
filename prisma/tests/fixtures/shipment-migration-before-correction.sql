CREATE TABLE `ChuyenXe` (
  `chuyenXeId` INT NOT NULL,
  `sucChuaXeMay` INT NOT NULL DEFAULT 0,
  `sucChuaHangCongKenh` INT NOT NULL DEFAULT 0,
  `sucChuaHangNhe` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`chuyenXeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `LoaiHangHoa` (
  `loaiHangHoaId` INT NOT NULL,
  `nhomSucChua` VARCHAR(30) NOT NULL,
  PRIMARY KEY (`loaiHangHoaId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `BangCuocGuiHang` (
  `bangCuocGuiHangId` INT NOT NULL,
  `khoiLuongTu` DECIMAL(10,2) NOT NULL,
  `khoiLuongDen` DECIMAL(10,2) NULL,
  `mucCuoc` DECIMAL(18,2) NOT NULL,
  `tuNgay` DATE NOT NULL,
  `denNgay` DATE NULL,
  `trangThai` VARCHAR(30) NOT NULL,
  `diemGuiId` INT NOT NULL,
  `diemNhanId` INT NOT NULL,
  `loaiHangHoaId` INT NOT NULL,
  PRIMARY KEY (`bangCuocGuiHangId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PhieuGuiHang` (
  `phieuGuiHangId` INT NOT NULL,
  `cuocChinh` DECIMAL(18,2) NOT NULL,
  `phiDichVu` DECIMAL(18,2) NOT NULL,
  `soTienGiam` DECIMAL(18,2) NOT NULL,
  `tongPhi` DECIMAL(18,2) NOT NULL,
  `ngayGui` DATETIME NOT NULL,
  `trangThai` VARCHAR(30) NOT NULL,
  `chuyenXeId` INT NOT NULL,
  `diemGuiId` INT NOT NULL,
  `diemNhanId` INT NOT NULL,
  `bangCuocApDungId` INT NOT NULL,
  `donGiaoDichId` INT NOT NULL,
  PRIMARY KEY (`phieuGuiHangId`),
  KEY `PhieuGuiHang_bangCuocApDungId_idx` (`bangCuocApDungId`),
  CONSTRAINT `PhieuGuiHang_bangCuocApDungId_fkey`
    FOREIGN KEY (`bangCuocApDungId`) REFERENCES `BangCuocGuiHang` (`bangCuocGuiHangId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `HangHoa` (
  `hangHoaId` INT NOT NULL,
  `phieuGuiHangId` INT NOT NULL,
  `loaiHangHoaId` INT NOT NULL,
  `soLuong` INT NOT NULL,
  `khoiLuong` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`hangHoaId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PhieuDatVe` (
  `phieuDatVeId` INT NOT NULL,
  `donGiaoDichId` INT NOT NULL,
  PRIMARY KEY (`phieuDatVeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Ve` (
  `veId` INT NOT NULL,
  `phieuDatVeId` INT NOT NULL,
  `gheChuyenXeId` INT NOT NULL,
  PRIMARY KEY (`veId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `GheChuyenXe` (
  `gheChuyenXeId` INT NOT NULL,
  `chuyenXeId` INT NOT NULL,
  PRIMARY KEY (`gheChuyenXeId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DonGiaoDich` (
  `donGiaoDichId` INT NOT NULL,
  `tongTien` DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`donGiaoDichId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `HoaDon` (
  `hoaDonId` INT NOT NULL,
  `donGiaoDichId` INT NOT NULL,
  `tongTien` DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`hoaDonId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ThanhToan` (
  `thanhToanId` INT NOT NULL,
  `donGiaoDichId` INT NOT NULL,
  `soTien` DECIMAL(18,2) NOT NULL,
  PRIMARY KEY (`thanhToanId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `ChuyenXe` (`chuyenXeId`) VALUES (1), (2);
INSERT INTO `LoaiHangHoa` (`loaiHangHoaId`, `nhomSucChua`) VALUES (1, 'HANG_NHE'), (2, 'XE_MAY');
INSERT INTO `BangCuocGuiHang` (`bangCuocGuiHangId`, `khoiLuongTu`, `khoiLuongDen`, `mucCuoc`, `tuNgay`, `denNgay`, `trangThai`, `diemGuiId`, `diemNhanId`, `loaiHangHoaId`)
VALUES (1, 0.00, 5.00, 30.00, '2026-01-01', '2026-12-31', 'HET_HIEU_LUC', 10, 20, 1),
       (2, 0.00, 5.00, 40.00, '2026-01-01', '2026-12-31', 'HET_HIEU_LUC', 10, 20, 2);
INSERT INTO `PhieuGuiHang` (`phieuGuiHangId`, `cuocChinh`, `phiDichVu`, `soTienGiam`, `tongPhi`, `ngayGui`, `trangThai`, `chuyenXeId`, `diemGuiId`, `diemNhanId`, `bangCuocApDungId`, `donGiaoDichId`)
VALUES (1, 70.00, 0.00, 0.00, 70.00, '2026-10-06 08:00:00', 'MOI_TAO', 1, 10, 20, 1, 500);
INSERT INTO `HangHoa` (`hangHoaId`, `phieuGuiHangId`, `loaiHangHoaId`, `soLuong`, `khoiLuong`)
VALUES (1, 1, 1, 2, 2.50), (2, 1, 2, 1, 3.00);
INSERT INTO `DonGiaoDich` (`donGiaoDichId`, `tongTien`) VALUES (500, 150.00);
INSERT INTO `HoaDon` (`hoaDonId`, `donGiaoDichId`, `tongTien`) VALUES (500, 500, 150.00);
INSERT INTO `ThanhToan` (`thanhToanId`, `donGiaoDichId`, `soTien`) VALUES (500, 500, 150.00);
