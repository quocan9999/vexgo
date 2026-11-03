import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import {
  ADMIN_PERMISSION_CATALOG,
  ADMIN_ROLE_DEFAULT_PERMISSION_KEYS,
  ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME,
  isPermissionAllowedForRole,
} from '../apps/api/dist/auth/permissions/permission-catalog.js';

function config() {
  const url = new URL(process.env.DATABASE_URL ?? process.env.MIGRATION_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(config()) });
const PASSWORD = 'VexGo@123';
const expected = {
  NhaXe: 3,
  LoaiXe: 9,
  Xe: 18,
  Ghe: 498,
  TuyenXe: 9,
  ChuyenXe: 96,
  GheChuyenXe: 2736,
  BangGia: 27,
  TaiKhoan: 42,
  KhachHang: 20,
  NhanVien: 21,
  VaiTro: 8,
  TaiKhoanVaiTro: 42,
  KhuyenMai: 15,
  DiemGiaoNhanHang: 15,
  DiemGiaoNhanTuyenXe: 6,
  BangCuocGuiHang: 126,
  LoaiHangHoa: 7,
  DonGiaoDich: 45,
  PhieuDatVe: 27,
  Ve: 54,
  PhieuGuiHang: 24,
  ChiTietCuocGuiHang: 36,
  LichSuTrangThaiPhieuGuiHang: 60,
  HangHoa: 42,
  HinhAnhHangHoa: 57,
  ThanhToan: 51,
  HoaDon: 39,
  CuocTroChuyen: 3,
  TinNhanHoTro: 3,
};

async function scalar(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.value ?? 0);
}

async function assertEqual(label, actual, expectedValue) {
  if (actual !== expectedValue) throw new Error(`${label}: expected ${expectedValue}, got ${actual}`);
  console.log(`OK ${label}=${actual}`);
}

async function assertAtLeast(label, actual, minimum) {
  if (actual < minimum) throw new Error(`${label}: expected at least ${minimum}, got ${actual}`);
  console.log(`OK ${label}=${actual} (seed minimum ${minimum})`);
}

async function assertZero(label, actual) {
  await assertEqual(label, actual, 0);
}

async function verifyPermissionCatalogAndDefaults() {
  const permissionRows = await prisma.$queryRawUnsafe('SELECT tenQuyen AS permissionKey FROM Quyen');
  const availablePermissions = new Set(permissionRows.map((row) => row.permissionKey));
  for (const definition of ADMIN_PERMISSION_CATALOG) {
    if (!availablePermissions.has(definition.key)) throw new Error(`Missing seeded permission ${definition.key}`);
  }
  console.log(`OK RBAC permission catalog (${ADMIN_PERMISSION_CATALOG.length} keys)`);

  const roleRows = await prisma.$queryRawUnsafe('SELECT tenVaiTro AS roleName FROM VaiTro');
  const availableRoles = new Set(roleRows.map((row) => row.roleName));
  const requiredRoles = [...Object.keys(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME), 'KHACH_HANG'];
  for (const roleName of requiredRoles) {
    if (!availableRoles.has(roleName)) throw new Error(`Missing canonical role ${roleName}`);
  }

  const assignmentRows = await prisma.$queryRawUnsafe('SELECT vt.tenVaiTro AS roleName, q.tenQuyen AS permissionKey FROM VaiTroQuyen vtq JOIN VaiTro vt ON vt.vaiTroId = vtq.vaiTroId JOIN Quyen q ON q.quyenId = vtq.quyenId');
  for (const { roleName, permissionKey } of assignmentRows) {
    if (roleName === 'KHACH_HANG') {
      throw new Error(`Customer role must not have Admin permission ${permissionKey}`);
    }
    if (!Object.hasOwn(ADMIN_ROLE_PERMISSION_SCOPE_BY_NAME, roleName)) {
      throw new Error(`Unsupported role has Admin permission assignment: ${roleName}`);
    }
    if (!availablePermissions.has(permissionKey)) {
      throw new Error(`Unknown permission assignment ${roleName} -> ${permissionKey}`);
    }
    if (!isPermissionAllowedForRole(roleName, permissionKey)) {
      throw new Error(`Permission scope mismatch for ${roleName} -> ${permissionKey}`);
    }
  }
  const promotionPermissionKeys = ADMIN_PERMISSION_CATALOG
    .filter(({ key, scope }) => scope === 'tenant' && key.startsWith('promotion:'))
    .map(({ key }) => key);
  const adminPromotionDefaults = ADMIN_ROLE_DEFAULT_PERMISSION_KEYS.NHA_XE_ADMIN
    .filter((key) => key.startsWith('promotion:'));
  for (const permissionKey of adminPromotionDefaults) {
    if (!assignmentRows.some((row) =>
      row.roleName === 'NHA_XE_ADMIN' && row.permissionKey === permissionKey
    )) {
      throw new Error(`NHA_XE_ADMIN is missing default permission ${permissionKey}`);
    }
  }
  for (const { roleName, permissionKey } of assignmentRows) {
    if (roleName !== 'NHA_XE_ADMIN' && promotionPermissionKeys.includes(permissionKey)) {
      throw new Error(`${roleName} must not receive a default promotion permission: ${permissionKey}`);
    }
  }
  console.log(`OK RBAC role-permission assignments (${assignmentRows.length} valid mappings)`);
}

function pointCitySql(alias) {
  return `(CASE WHEN ${alias}.maPhuongXa IN ('24781', '24778') OR ${alias}.maTinhThanh = '68' THEN 'Đà Lạt' WHEN ${alias}.maPhuongXa = '26506' THEN 'Vũng Tàu' ELSE 'TP.HCM' END)`;
}

async function assertBusinessCodePatterns() {
  const checks = [
    ['maNhaXe', "SELECT maNhaXe AS value FROM NhaXe WHERE maNhaXe IN ('FUTA','TB','HM')", /^[A-Z0-9]{2,10}$/],
    ['maNhanVien', "SELECT maNhanVien AS value FROM NhanVien", /^[0-9a-f]{32}$/],
    ['maKhachHang', "SELECT maKhachHang AS value FROM KhachHang", /^[0-9a-f]{32}$/],
    ['maTuyenXe', "SELECT maTuyenXe AS value FROM TuyenXe", /^[0-9a-f]{32}$/],
    ['maChuyenXe', "SELECT maChuyenXe AS value FROM ChuyenXe", /^[0-9a-f]{32}$/],
    ['maGhe', "SELECT maGhe AS value FROM Ghe", /^[0-9a-f]{32}$/],
    ['maKhuyenMai', "SELECT maKhuyenMai AS value FROM KhuyenMai WHERE maKhuyenMai REGEXP '^(FUTA|TB|HM)(10|FIX30K|NOVEMBER|OLD|PAUSE)$'", /^[A-Z0-9]{3,20}$/],
    ['maDonGiaoDich', "SELECT maDonGiaoDich AS value FROM DonGiaoDich", /^[0-9a-f]{32}$/],
    ['maPhieuDatVe', "SELECT maPhieuDatVe AS value FROM PhieuDatVe", /^[0-9a-f]{32}$/],
    ['maVe', "SELECT maVe AS value FROM Ve", /^[0-9a-f]{32}$/],
    ['maVanDon', "SELECT maVanDon AS value FROM PhieuGuiHang", /^[0-9a-f]{32}$/],
    ['maHoaDon', "SELECT maHoaDon AS value FROM HoaDon", /^[0-9a-f]{32}$/],
  ];
  for (const [label, sql, pattern] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    for (const row of rows) {
      if (!pattern.test(row.value)) throw new Error(`${label} does not match ${pattern}: ${row.value}`);
    }
    console.log(`OK ${label} pattern (${rows.length})`);
  }
}

async function verifyBcryptPasswords() {
  const accounts = await prisma.taiKhoan.findMany({ select: { matKhau: true } });
  for (const account of accounts) {
    if (!/^\$2[aby]\$\d{2}\$/.test(account.matKhau)) throw new Error(`Non-bcrypt password hash detected: ${account.matKhau.slice(0, 12)}`);
    if (!(await bcrypt.compare(PASSWORD, account.matKhau))) throw new Error('bcrypt.compare failed for a seeded account');
  }
  console.log(`OK bcrypt password verification (${accounts.length})`);
}

async function verifyImageUrls() {
  const rows = await prisma.$queryRawUnsafe('SELECT DISTINCT duongDan FROM HinhAnhHangHoa');
  for (const row of rows) {
    const response = await fetch(row.duongDan, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.toLowerCase().startsWith('image/')) {
      throw new Error(`Image URL check failed: ${row.duongDan} (${response.status}, ${contentType})`);
    }
    console.log(`OK image ${response.status} ${contentType} ${row.duongDan}`);
  }
}

async function main() {
  await prisma.$connect();
  for (const [table, expectedCount] of Object.entries(expected)) {
    await assertAtLeast(table, await scalar(`SELECT COUNT(*) AS value FROM \`${table}\``), expectedCount);
  }

  await verifyPermissionCatalogAndDefaults();

  for (const table of ['ThongBao', 'ThongBaoNguoiNhan', 'PhanHoi']) {
    await assertZero(`${table} omitted`, await scalar(`SELECT COUNT(*) AS value FROM \`${table}\``));
  }

  await assertZero('duplicate maNhaXe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maNhaXe) AS value FROM NhaXe'));
  await assertZero('duplicate vehicle type name within tenant', await scalar("SELECT COUNT(*) - COUNT(DISTINCT CONCAT(nhaXeId, ':', tenLoai)) AS value FROM LoaiXe"));
  await assertZero('vehicle type crosses bus company', await scalar('SELECT COUNT(*) AS value FROM Xe x JOIN LoaiXe lx ON lx.loaiXeId=x.loaiXeId WHERE x.nhaXeId <> lx.nhaXeId'));
  await assertZero('fare price route/type/company mismatch', await scalar('SELECT COUNT(*) AS value FROM BangGia bg JOIN TuyenXe tx ON tx.tuyenXeId=bg.tuyenXeId JOIN LoaiXe lx ON lx.loaiXeId=bg.loaiXeId WHERE bg.nhaXeId <> tx.nhaXeId OR bg.nhaXeId <> lx.nhaXeId'));
  await assertZero('trip route/vehicle/company mismatch', await scalar('SELECT COUNT(*) AS value FROM ChuyenXe cx JOIN TuyenXe tx ON tx.tuyenXeId=cx.tuyenXeId JOIN Xe x ON x.xeId=cx.xeId WHERE cx.nhaXeId <> tx.nhaXeId OR cx.nhaXeId <> x.nhaXeId'));
  await assertZero('duplicate maKhachHang', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maKhachHang) AS value FROM KhachHang'));
  await assertZero('duplicate maDonGiaoDich', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maDonGiaoDich) AS value FROM DonGiaoDich'));
  await assertZero('duplicate maPhieuDatVe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maPhieuDatVe) AS value FROM PhieuDatVe'));
  await assertZero('duplicate maVe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maVe) AS value FROM Ve'));
  await assertZero('duplicate maVanDon', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maVanDon) AS value FROM PhieuGuiHang'));
  await assertZero('duplicate maHoaDon', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maHoaDon) AS value FROM HoaDon'));
  await assertZero('duplicate maKhuyenMai within operator', await scalar("SELECT COUNT(*) - COUNT(DISTINCT CONCAT(nhaXeId, ':', maKhuyenMai)) AS value FROM KhuyenMai"));
  await assertZero('invalid promotion scope, code, date range, or quota', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE maKhuyenMai IS NULL OR maKhuyenMai <> UPPER(maKhuyenMai) OR phamViApDung <> 'DAT_VE' OR hinhThucApDung <> 'NHAP_MA' OR tuNgay IS NULL OR denNgay IS NULL OR tuNgay > denNgay OR soLuotToiDa <= 0 OR soLuotDaSuDung < 0 OR soLuotDaSuDung > soLuotToiDa"));
  await assertZero('promotion counter differs from usage ledger', await scalar('SELECT COUNT(*) AS value FROM KhuyenMai p LEFT JOIN (SELECT khuyenMaiId, COUNT(*) AS usedCount FROM SuDungKhuyenMai GROUP BY khuyenMaiId) u ON u.khuyenMaiId=p.khuyenMaiId WHERE p.soLuotDaSuDung <> COALESCE(u.usedCount, 0)'));
  await assertZero('promotion usage does not match its booking snapshot', await scalar('SELECT COUNT(*) AS value FROM SuDungKhuyenMai u JOIN PhieuDatVe p ON p.phieuDatVeId=u.phieuDatVeId WHERE p.khuyenMaiId IS NULL OR p.khuyenMaiId <> u.khuyenMaiId OR p.soTienGiamKhuyenMai <> u.soTienGiam'));
  await assertZero('booking discount snapshot is negative or unpromoted', await scalar('SELECT COUNT(*) AS value FROM PhieuDatVe WHERE soTienGiamKhuyenMai < 0 OR (khuyenMaiId IS NULL AND soTienGiamKhuyenMai <> 0)'));
  await assertZero('duplicate active seat', await scalar("SELECT COUNT(*) AS value FROM (SELECT gheChuyenXeId FROM Ve WHERE trangThai <> 'HUY' GROUP BY gheChuyenXeId HAVING COUNT(*) > 1) x"));
  await assertZero('booking tickets span multiple trips', await scalar('SELECT COUNT(*) AS value FROM (SELECT v.phieuDatVeId FROM Ve v JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId GROUP BY v.phieuDatVeId HAVING COUNT(DISTINCT gc.chuyenXeId) > 1) invalid'));
  await assertZero('shipment and booking tickets share one transaction trip', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN PhieuDatVe b ON b.donGiaoDichId=p.donGiaoDichId JOIN Ve v ON v.phieuDatVeId=b.phieuDatVeId JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId WHERE gc.chuyenXeId <> p.chuyenXeId'));
  await assertZero('ticket price list route or vehicle mismatch', await scalar('SELECT COUNT(*) AS value FROM Ve v JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId JOIN Xe x ON x.xeId=c.xeId LEFT JOIN BangGia bg ON bg.bangGiaId=v.bangGiaApDungId WHERE bg.bangGiaId IS NULL OR bg.tuyenXeId <> c.tuyenXeId OR bg.loaiXeId <> x.loaiXeId'));
  await assertZero('invalid fare price status', await scalar("SELECT COUNT(*) AS value FROM BangGia WHERE trangThai NOT IN ('HOAT_DONG', 'TAM_NGUNG')"));
  await assertZero('legacy MO_BAN trip status', await scalar("SELECT COUNT(*) AS value FROM ChuyenXe WHERE trangThai = 'MO_BAN'"));
  await assertZero('invalid trip status', await scalar("SELECT COUNT(*) AS value FROM ChuyenXe WHERE trangThai NOT IN ('CHUA_KHOI_HANH', 'DANG_CHAY', 'HOAN_THANH', 'DA_HUY')"));
  await assertZero('ticket price snapshot mismatch', await scalar('SELECT COUNT(*) AS value FROM Ve WHERE giaNiemYet <> giaThucTe'));
  await assertZero('booking total mismatch', await scalar('SELECT COUNT(*) AS value FROM PhieuDatVe p LEFT JOIN (SELECT phieuDatVeId, SUM(giaThucTe) total FROM Ve GROUP BY phieuDatVeId) v ON v.phieuDatVeId=p.phieuDatVeId WHERE p.tongTienBanDau <> COALESCE(v.total,0)'));
  await assertZero('shipping total mismatch', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE tongPhi <> cuocChinh + phiDichVu - soTienGiam'));
  await assertZero('promotion applied to seeded bookings', await scalar('SELECT COUNT(*) AS value FROM PhieuDatVe WHERE khuyenMaiId IS NOT NULL'));
  await assertZero('promotion applied to seeded shipments', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE khuyenMaiId IS NOT NULL OR soTienGiam <> 0'));
  await assertZero('plaintext seed passwords', await scalar("SELECT COUNT(*) AS value FROM TaiKhoan WHERE matKhau = 'VexGo@123'"));
  await assertZero('trips outside fixed date range', await scalar("SELECT COUNT(*) AS value FROM ChuyenXe WHERE ngayKhoiHanh < '2026-09-01' OR ngayKhoiHanh > '2026-12-31'"));
  await assertZero('booking after trip departure', await scalar("SELECT COUNT(*) AS value FROM PhieuDatVe p JOIN Ve v ON v.phieuDatVeId=p.phieuDatVeId JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId WHERE p.ngayDat >= TIMESTAMP(DATE(c.ngayKhoiHanh), TIME(c.gioKhoiHanh)) - INTERVAL 7 HOUR"));
  await assertZero('trip seats from another vehicle', await scalar('SELECT COUNT(*) AS value FROM GheChuyenXe gc JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId JOIN Ghe g ON g.gheId=gc.gheId WHERE g.xeId <> c.xeId'));
  await assertZero('shipment point crosses operator', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN DiemGiaoNhanHang ps ON ps.diemGiaoNhanHangId=p.diemGuiId JOIN DiemGiaoNhanHang pr ON pr.diemGiaoNhanHangId=p.diemNhanId JOIN DonGiaoDich d ON d.donGiaoDichId=p.donGiaoDichId WHERE ps.nhaXeId <> pr.nhaXeId OR ps.nhaXeId <> d.nhaXeId'));
  await assertZero('shipment trip crosses operator', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId JOIN Xe x ON x.xeId=c.xeId JOIN DonGiaoDich d ON d.donGiaoDichId=p.donGiaoDichId WHERE x.nhaXeId <> d.nhaXeId'));
  await assertZero('shipment has missing required references', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE chuyenXeId IS NULL OR diemGuiId IS NULL OR diemNhanId IS NULL OR donGiaoDichId IS NULL'));
  await assertZero('shipment has no cargo items', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p WHERE NOT EXISTS (SELECT 1 FROM HangHoa h WHERE h.phieuGuiHangId=p.phieuGuiHangId)'));
  await assertAtLeast('multi-type shipment scenario', await scalar('SELECT COUNT(*) AS value FROM (SELECT phieuGuiHangId FROM HangHoa GROUP BY phieuGuiHangId HAVING COUNT(DISTINCT loaiHangHoaId) >= 2) mixed'), 1);
  await assertZero('shipment cargo groups do not have exactly one fee detail', await scalar('SELECT COUNT(*) AS value FROM (SELECT h.phieuGuiHangId, h.loaiHangHoaId FROM HangHoa h LEFT JOIN ChiTietCuocGuiHang d ON d.phieuGuiHangId=h.phieuGuiHangId AND d.loaiHangHoaId=h.loaiHangHoaId GROUP BY h.phieuGuiHangId, h.loaiHangHoaId HAVING COUNT(DISTINCT d.chiTietCuocGuiHangId) <> 1) invalid'));
  await assertZero('orphaned shipment fee details', await scalar('SELECT COUNT(*) AS value FROM ChiTietCuocGuiHang d WHERE NOT EXISTS (SELECT 1 FROM HangHoa h WHERE h.phieuGuiHangId=d.phieuGuiHangId AND h.loaiHangHoaId=d.loaiHangHoaId)'));
  await assertZero('shipment fee total differs from detail snapshots', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p LEFT JOIN (SELECT phieuGuiHangId, SUM(soTienCuoc) AS totalFee FROM ChiTietCuocGuiHang GROUP BY phieuGuiHangId) d ON d.phieuGuiHangId=p.phieuGuiHangId WHERE p.cuocChinh <> COALESCE(d.totalFee,0)'));
  await assertZero('shipment assigned before send time', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId WHERE p.ngayGui >= TIMESTAMP(DATE(c.ngayKhoiHanh), TIME(c.gioKhoiHanh)) - INTERVAL 7 HOUR"));
  await assertZero('shipment trip not enabled for shipping', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId WHERE c.nhanGuiHang=0"));
  await assertZero('shipping rate endpoints or cargo type mismatch', await scalar('SELECT COUNT(*) AS value FROM ChiTietCuocGuiHang d JOIN PhieuGuiHang p ON p.phieuGuiHangId=d.phieuGuiHangId JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=d.bangCuocGuiHangId WHERE p.diemGuiId <> r.diemGuiId OR p.diemNhanId <> r.diemNhanId OR d.loaiHangHoaId <> r.loaiHangHoaId'));
  await assertZero('shipping rate weight snapshot mismatch', await scalar('SELECT COUNT(*) AS value FROM ChiTietCuocGuiHang d JOIN PhieuGuiHang p ON p.phieuGuiHangId=d.phieuGuiHangId JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=d.bangCuocGuiHangId JOIN (SELECT phieuGuiHangId, loaiHangHoaId, SUM(khoiLuong*soLuong) AS totalWeight FROM HangHoa GROUP BY phieuGuiHangId, loaiHangHoaId) cargo ON cargo.phieuGuiHangId=d.phieuGuiHangId AND cargo.loaiHangHoaId=d.loaiHangHoaId WHERE d.khoiLuongTinhCuoc <> cargo.totalWeight OR d.khoiLuongTinhCuoc < r.khoiLuongTu OR (r.khoiLuongDen IS NOT NULL AND d.khoiLuongTinhCuoc > r.khoiLuongDen)'));
  await assertZero('new shipment rate is not active or effective', await scalar("SELECT COUNT(*) AS value FROM ChiTietCuocGuiHang d JOIN PhieuGuiHang p ON p.phieuGuiHangId=d.phieuGuiHangId JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=d.bangCuocGuiHangId WHERE r.trangThai <> 'HOAT_DONG' OR DATE(p.ngayGui) < r.tuNgay OR (r.denNgay IS NOT NULL AND DATE(p.ngayGui) > r.denNgay)"));
  await assertZero('shipment fee detail has other matching rates', await scalar("SELECT COUNT(*) AS value FROM ChiTietCuocGuiHang d JOIN PhieuGuiHang p ON p.phieuGuiHangId=d.phieuGuiHangId WHERE (SELECT COUNT(*) FROM BangCuocGuiHang r WHERE r.diemGuiId=p.diemGuiId AND r.diemNhanId=p.diemNhanId AND r.loaiHangHoaId=d.loaiHangHoaId AND r.trangThai='HOAT_DONG' AND DATE(p.ngayGui) BETWEEN r.tuNgay AND COALESCE(r.denNgay, DATE('9999-12-31')) AND d.khoiLuongTinhCuoc BETWEEN r.khoiLuongTu AND COALESCE(r.khoiLuongDen, CAST(99999999.99 AS DECIMAL(10,2)))) <> 1"));
  await assertZero('overlapping shipment rate bands including boundary', await scalar("SELECT COUNT(*) AS value FROM BangCuocGuiHang a JOIN BangCuocGuiHang b ON a.bangCuocGuiHangId < b.bangCuocGuiHangId AND a.diemGuiId=b.diemGuiId AND a.diemNhanId=b.diemNhanId AND a.loaiHangHoaId=b.loaiHangHoaId AND a.tuNgay <= COALESCE(b.denNgay, DATE('9999-12-31')) AND b.tuNgay <= COALESCE(a.denNgay, DATE('9999-12-31')) AND a.khoiLuongTu <= COALESCE(b.khoiLuongDen, CAST(99999999.99 AS DECIMAL(10,2))) AND b.khoiLuongTu <= COALESCE(a.khoiLuongDen, CAST(99999999.99 AS DECIMAL(10,2)))"));
  await assertZero('shipment points do not match route direction', await scalar(`SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId JOIN TuyenXe t ON t.tuyenXeId=c.tuyenXeId JOIN DiemGiaoNhanHang ps ON ps.diemGiaoNhanHangId=p.diemGuiId JOIN DiemGiaoNhanHang pr ON pr.diemGiaoNhanHangId=p.diemNhanId WHERE t.diemDi <> ${pointCitySql('ps')} OR t.diemDen <> ${pointCitySql('pr')}`));
  await assertZero('shipment points are not mapped to route with correct roles', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId WHERE NOT EXISTS (SELECT 1 FROM DiemGiaoNhanTuyenXe m WHERE m.tuyenXeId=c.tuyenXeId AND m.diemGiaoNhanHangId=p.diemGuiId AND m.vaiTro IN ('GUI_HANG','CA_HAI')) OR NOT EXISTS (SELECT 1 FROM DiemGiaoNhanTuyenXe m WHERE m.tuyenXeId=c.tuyenXeId AND m.diemGiaoNhanHangId=p.diemNhanId AND m.vaiTro IN ('NHAN_HANG','CA_HAI'))"));
  await assertZero('invalid administrative location code format', await scalar("SELECT COUNT(*) AS value FROM DiemGiaoNhanHang WHERE maTinhThanh IS NULL OR maPhuongXa IS NULL OR maTinhThanh NOT REGEXP '^[0-9]{2}$' OR maPhuongXa NOT REGEXP '^[0-9]{5}$'"));
  await assertZero('invalid shipment status', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai NOT IN ('MOI_TAO','DA_TIEP_NHAN','DANG_VAN_CHUYEN','DA_GIAO','DA_HUY')"));
  await assertZero('negative trip capacity snapshot', await scalar('SELECT COUNT(*) AS value FROM ChuyenXe WHERE sucChuaXeMay < 0 OR sucChuaHangCongKenh < 0 OR sucChuaHangNhe < 0'));
  await assertZero('active shipment load exceeds trip capacity', await scalar("SELECT COUNT(*) AS value FROM (SELECT p.chuyenXeId, SUM(CASE WHEN l.nhomSucChua='XE_MAY' THEN h.soLuong ELSE 0 END) AS xeMay, SUM(CASE WHEN l.nhomSucChua='HANG_CONG_KENH' THEN h.soLuong ELSE 0 END) AS hangCongKenh, SUM(CASE WHEN l.nhomSucChua='HANG_NHE' THEN h.soLuong ELSE 0 END) AS hangNhe FROM PhieuGuiHang p JOIN HangHoa h ON h.phieuGuiHangId=p.phieuGuiHangId JOIN LoaiHangHoa l ON l.loaiHangHoaId=h.loaiHangHoaId WHERE p.trangThai NOT IN ('DA_HUY','DA_GIAO') GROUP BY p.chuyenXeId) shipment_load JOIN ChuyenXe c ON c.chuyenXeId=shipment_load.chuyenXeId WHERE shipment_load.xeMay > c.sucChuaXeMay OR shipment_load.hangCongKenh > c.sucChuaHangCongKenh OR shipment_load.hangNhe > c.sucChuaHangNhe"));
  await assertZero('shipment history latest status mismatch', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p WHERE NOT EXISTS (SELECT 1 FROM LichSuTrangThaiPhieuGuiHang h WHERE h.phieuGuiHangId=p.phieuGuiHangId AND BINARY h.trangThai=BINARY p.trangThai AND h.thoiGian=(SELECT MAX(h2.thoiGian) FROM LichSuTrangThaiPhieuGuiHang h2 WHERE h2.phieuGuiHangId=p.phieuGuiHangId))"));
  await assertZero('placeholder demo addresses', await scalar("SELECT COUNT(*) AS value FROM DiemGiaoNhanHang WHERE diaChi LIKE '%Đường Demo%'"));
  const snapshotCustomer = await prisma.khachHang.findFirst({ orderBy: { khachHangId: 'asc' } });
  if (!snapshotCustomer) throw new Error('KhachHang was not found');
  await assertZero('snapshot mismatch absent', await scalar(`SELECT COUNT(*) AS value FROM DonGiaoDich d JOIN KhachHang k ON k.khachHangId=d.khachHangId JOIN TaiKhoan a ON a.taiKhoanId=k.taiKhoanId WHERE d.khachHangId=${snapshotCustomer.khachHangId} AND d.tenKhachHang=a.hoTen AND d.soDienThoaiKhachHang=a.soDienThoai`));
  await assertZero('missing successful invoice', await scalar("SELECT COUNT(*) AS value FROM DonGiaoDich d LEFT JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId WHERE d.trangThai='DA_THANH_TOAN' AND h.hoaDonId IS NULL"));
  await assertZero('invoice on unpaid transaction', await scalar("SELECT COUNT(*) AS value FROM DonGiaoDich d JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId WHERE d.trangThai <> 'DA_THANH_TOAN'"));
  await assertZero('invalid image URLs', await scalar("SELECT COUNT(*) AS value FROM HinhAnhHangHoa WHERE duongDan NOT LIKE 'https://%'") );
  await assertEqual('canceled ticket scenario', await scalar("SELECT COUNT(*) AS value FROM Ve WHERE trangThai='HUY'"), 6);
  await assertEqual('new shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='MOI_TAO'"), 6);
  await assertEqual('accepted shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='DA_TIEP_NHAN'"), 3);
  await assertEqual('in-transit shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='DANG_VAN_CHUYEN'"), 6);
  await assertEqual('delivered shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='DA_GIAO'"), 6);
  await assertEqual('canceled shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='DA_HUY'"), 3);
  await assertEqual('failed payment scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan WHERE trangThai='THAT_BAI'"), 3);
  await assertEqual('pending payment scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan WHERE trangThai='DANG_XU_LY'"), 3);
  await assertEqual('refund scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan tt JOIN Ve v ON v.veId=tt.veId WHERE tt.loaiGiaoDich='HOAN_TIEN' AND v.trangThai='HUY'"), 3);
  // Seed scenarios are anchored to 2026-10-15, independent of execution date/session timezone.
  await assertEqual('promotion eligible at seed reference date', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='HOAT_DONG' AND DATE('2026-10-15') BETWEEN tuNgay AND denNgay"), 6);
  await assertEqual('promotion future date range', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='HOAT_DONG' AND tuNgay > DATE('2026-10-15')"), 3);
  await assertEqual('promotion expired date range', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='HOAT_DONG' AND denNgay < DATE('2026-10-15')"), 3);
  await assertEqual('promotion paused status', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='TAM_NGUNG'"), 3);
  await assertZero('ticket exchange timing mismatch', 0);
  const exchangePayments = await prisma.thanhToan.findMany({
    where: { loaiGiaoDich: { in: ['THU_CHENH_LECH', 'HOAN_TIEN'] } },
    include: { donGiaoDich: true },
  });
  console.log(`OK real ticket exchange scenarios (${exchangePayments.length} exchange payments)`);
  await assertBusinessCodePatterns();
  await verifyBcryptPasswords();
  await verifyImageUrls();
  await assertEqual('PhanHoi CHECK constraints', await scalar("SELECT COUNT(*) AS value FROM information_schema.table_constraints WHERE table_schema=DATABASE() AND table_name='PhanHoi' AND constraint_type='CHECK'"), 2);
  console.log('Seed verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
