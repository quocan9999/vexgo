import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaMariaDb } from '../apps/api/node_modules/@prisma/adapter-mariadb/dist/index.js';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

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
  LoaiXe: 3,
  Xe: 18,
  Ghe: 498,
  TuyenXe: 9,
  ChuyenXe: 96,
  GheChuyenXe: 2736,
  BangGia: 27,
  TaiKhoan: 42,
  KhachHang: 20,
  NhanVien: 21,
  VaiTro: 7,
  TaiKhoanVaiTro: 42,
  KhuyenMai: 15,
  BuuCuc: 15,
  BangCuocGuiHang: 72,
  LoaiHangHoa: 7,
  DonGiaoDich: 45,
  PhieuDatVe: 27,
  Ve: 54,
  PhieuGuiHang: 24,
  HangHoa: 42,
  HinhAnhHangHoa: 57,
  ThanhToan: 51,
  HoaDon: 39,
};

async function scalar(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Number(rows[0]?.value ?? 0);
}

async function assertEqual(label, actual, expectedValue) {
  if (actual !== expectedValue) throw new Error(`${label}: expected ${expectedValue}, got ${actual}`);
  console.log(`OK ${label}=${actual}`);
}

async function assertZero(label, actual) {
  await assertEqual(label, actual, 0);
}

function branchCitySql(alias) {
  return `(CASE WHEN ${alias}.quanHuyen IN ('Đà Lạt', 'Vũng Tàu') THEN ${alias}.quanHuyen ELSE ${alias}.tinhThanh END)`;
}

async function assertBusinessCodePatterns() {
  const checks = [
    ['maNhaXe', 'SELECT maNhaXe AS value FROM NhaXe', /^[A-Z0-9]{2,10}$/],
    ['maNhanVien', 'SELECT maNhanVien AS value FROM NhanVien', /^(FUTA|TB|HM)-NV-\d{4,}$/],
    ['maKhachHang', 'SELECT maKhachHang AS value FROM KhachHang', /^KH-\d{6,}$/],
    ['maTuyenXe', 'SELECT maTuyenXe AS value FROM TuyenXe', /^(FUTA|TB|HM)-TX-\d{4,}$/],
    ['maChuyenXe', 'SELECT maChuyenXe AS value FROM ChuyenXe', /^(FUTA|TB|HM)-CX-\d{8}-\d{4,}$/],
    ['maBuuCuc', 'SELECT maBuuCuc AS value FROM BuuCuc', /^(FUTA|TB|HM)-BC-\d{3,}$/],
    ['maKhuyenMai', 'SELECT maKhuyenMai AS value FROM KhuyenMai', /^[A-Z0-9]{3,20}$/],
    ['maDonGiaoDich', 'SELECT maDonGiaoDich AS value FROM DonGiaoDich', /^(FUTA|TB|HM)-GD-\d{12}-\d{4,}$/],
    ['maPhieuDatVe', 'SELECT maPhieuDatVe AS value FROM PhieuDatVe', /^(FUTA|TB|HM)-PDV-\d{12}-\d{4,}$/],
    ['maVe', 'SELECT maVe AS value FROM Ve', /^(FUTA|TB|HM)-PDV-\d{12}-\d{4,}-VE-\d{2,}$/],
    ['maVanDon', 'SELECT maVanDon AS value FROM PhieuGuiHang', /^(FUTA|TB|HM)-VD-\d{12}-\d{4,}$/],
    ['maHoaDon', 'SELECT maHoaDon AS value FROM HoaDon', /^(FUTA|TB|HM)-HD-\d{12}-\d{4,}$/],
  ];
  for (const [label, sql, pattern] of checks) {
    const rows = await prisma.$queryRawUnsafe(sql);
    for (const row of rows) {
      if (!pattern.test(row.value)) throw new Error(`${label} does not match ${pattern}: ${row.value}`);
    }
    console.log(`OK ${label} pattern (${rows.length})`);
  }

  const ticketRows = await prisma.$queryRawUnsafe('SELECT p.maPhieuDatVe, v.maVe AS value FROM PhieuDatVe p JOIN Ve v ON v.phieuDatVeId=p.phieuDatVeId');
  for (const row of ticketRows) {
    if (!row.value.startsWith(`${row.maPhieuDatVe}-VE-`)) throw new Error(`maVe does not derive from maPhieuDatVe: ${row.value}`);
  }
  console.log(`OK maVe to maPhieuDatVe linkage (${ticketRows.length})`);

  const transactionRows = await prisma.$queryRawUnsafe('SELECT d.maDonGiaoDich, p.maPhieuDatVe, g.maVanDon, h.maHoaDon FROM DonGiaoDich d LEFT JOIN PhieuDatVe p ON p.donGiaoDichId=d.donGiaoDichId LEFT JOIN PhieuGuiHang g ON g.donGiaoDichId=d.donGiaoDichId LEFT JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId');
  for (const row of transactionRows) {
    const match = row.maDonGiaoDich.match(/^([A-Z0-9]+)-GD-(\d{12})-(\d{4,})$/);
    if (!match) throw new Error(`Invalid transaction code: ${row.maDonGiaoDich}`);
    const [, operator, stamp, sequence] = match;
    for (const [field, prefix] of [['maPhieuDatVe', 'PDV'], ['maVanDon', 'VD'], ['maHoaDon', 'HD']]) {
      if (row[field] && row[field] !== `${operator}-${prefix}-${stamp}-${sequence}`) {
        throw new Error(`${field} suffix does not match ${row.maDonGiaoDich}: ${row[field]}`);
      }
    }
  }
  console.log(`OK GD/PDV/VD/HD shared timestamp and sequence (${transactionRows.length})`);
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
    await assertEqual(table, await scalar(`SELECT COUNT(*) AS value FROM \`${table}\``), expectedCount);
  }

  for (const table of ['Quyen', 'VaiTroQuyen', 'ThongBao', 'ThongBaoNguoiNhan', 'PhanHoi', 'TinNhanHoTro']) {
    await assertZero(`${table} omitted`, await scalar(`SELECT COUNT(*) AS value FROM \`${table}\``));
  }

  await assertZero('duplicate maNhaXe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maNhaXe) AS value FROM NhaXe'));
  await assertZero('duplicate maKhachHang', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maKhachHang) AS value FROM KhachHang'));
  await assertZero('duplicate maDonGiaoDich', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maDonGiaoDich) AS value FROM DonGiaoDich'));
  await assertZero('duplicate maPhieuDatVe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maPhieuDatVe) AS value FROM PhieuDatVe'));
  await assertZero('duplicate maVe', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maVe) AS value FROM Ve'));
  await assertZero('duplicate maVanDon', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maVanDon) AS value FROM PhieuGuiHang'));
  await assertZero('duplicate maHoaDon', await scalar('SELECT COUNT(*) - COUNT(DISTINCT maHoaDon) AS value FROM HoaDon'));
  await assertZero('duplicate maKhuyenMai within operator', await scalar("SELECT COUNT(*) - COUNT(DISTINCT CONCAT(nhaXeId, ':', maKhuyenMai)) AS value FROM KhuyenMai"));
  await assertZero('duplicate active seat', await scalar("SELECT COUNT(*) AS value FROM (SELECT gheChuyenXeId FROM Ve WHERE trangThai <> 'HUY' GROUP BY gheChuyenXeId HAVING COUNT(*) > 1) x"));
  await assertZero('booking tickets span multiple trips', await scalar('SELECT COUNT(*) AS value FROM (SELECT v.phieuDatVeId FROM Ve v JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId GROUP BY v.phieuDatVeId HAVING COUNT(DISTINCT gc.chuyenXeId) > 1) invalid'));
  await assertZero('ticket price list route or vehicle mismatch', await scalar('SELECT COUNT(*) AS value FROM Ve v JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId JOIN Xe x ON x.xeId=c.xeId LEFT JOIN BangGia bg ON bg.bangGiaId=v.bangGiaApDungId WHERE bg.bangGiaId IS NULL OR bg.tuyenXeId <> c.tuyenXeId OR bg.loaiXeId <> x.loaiXeId'));
  await assertZero('ticket price snapshot mismatch', await scalar('SELECT COUNT(*) AS value FROM Ve WHERE giaNiemYet <> giaThucTe'));
  await assertZero('booking total mismatch', await scalar('SELECT COUNT(*) AS value FROM PhieuDatVe p LEFT JOIN (SELECT phieuDatVeId, SUM(giaThucTe) total FROM Ve GROUP BY phieuDatVeId) v ON v.phieuDatVeId=p.phieuDatVeId WHERE p.tongTienBanDau <> COALESCE(v.total,0)'));
  await assertZero('shipping total mismatch', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE tongPhi <> cuocChinh + phiDichVu - soTienGiam'));
  await assertZero('promotion applied to seeded bookings', await scalar('SELECT COUNT(*) AS value FROM PhieuDatVe WHERE khuyenMaiId IS NOT NULL'));
  await assertZero('promotion applied to seeded shipments', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE khuyenMaiId IS NOT NULL OR soTienGiam <> 0'));
  await assertZero('plaintext seed passwords', await scalar("SELECT COUNT(*) AS value FROM TaiKhoan WHERE matKhau = 'VexGo@123'"));
  await assertZero('trips outside fixed date range', await scalar("SELECT COUNT(*) AS value FROM ChuyenXe WHERE ngayKhoiHanh < '2026-09-22' OR ngayKhoiHanh > '2026-09-29'"));
  await assertZero('booking after trip departure', await scalar("SELECT COUNT(*) AS value FROM PhieuDatVe p JOIN Ve v ON v.phieuDatVeId=p.phieuDatVeId JOIN GheChuyenXe gc ON gc.gheChuyenXeId=v.gheChuyenXeId JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId WHERE p.ngayDat >= TIMESTAMP(DATE(c.ngayKhoiHanh), TIME(c.gioKhoiHanh)) - INTERVAL 7 HOUR"));
  await assertZero('trip seats from another vehicle', await scalar('SELECT COUNT(*) AS value FROM GheChuyenXe gc JOIN ChuyenXe c ON c.chuyenXeId=gc.chuyenXeId JOIN Ghe g ON g.gheId=gc.gheId WHERE g.xeId <> c.xeId'));
  await assertZero('shipment branch crosses operator', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BuuCuc bg ON bg.buuCucId=p.buuCucGuiId JOIN BuuCuc bp ON bp.buuCucId=p.buuCucPhatId WHERE bg.nhaXeId <> bp.nhaXeId'));
  await assertZero('shipment trip crosses operator', await scalar('SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId JOIN Xe x ON x.xeId=c.xeId JOIN DonGiaoDich d ON d.donGiaoDichId=p.donGiaoDichId WHERE x.nhaXeId <> d.nhaXeId'));
  await assertZero('shipment assigned before send time', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId WHERE p.ngayGui >= TIMESTAMP(DATE(c.ngayKhoiHanh), TIME(c.gioKhoiHanh)) - INTERVAL 7 HOUR"));
  await assertZero('shipping rate weight mismatch', await scalar('SELECT COUNT(*) AS value FROM (SELECT p.phieuGuiHangId, SUM(h.khoiLuong) AS totalWeight, r.khoiLuongTu, r.khoiLuongDen FROM PhieuGuiHang p JOIN HangHoa h ON h.phieuGuiHangId=p.phieuGuiHangId JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId GROUP BY p.phieuGuiHangId, r.khoiLuongTu, r.khoiLuongDen HAVING totalWeight < r.khoiLuongTu OR (r.khoiLuongDen IS NOT NULL AND totalWeight > r.khoiLuongDen)) invalid'));
  await assertZero('shipment pickup branch differs from rate', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId WHERE p.hinhThucLayHang='GUI_TAI_BUU_CUC' AND (p.buuCucGuiId IS NULL OR p.buuCucGuiId <> r.buuCucGuiId)"));
  await assertZero('shipment delivery branch differs from rate', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId WHERE p.hinhThucGiaoHang='GIAO_TAI_BUU_CUC' AND (p.buuCucPhatId IS NULL OR p.buuCucPhatId <> r.buuCucPhatId)"));
  await assertZero('shipment pickup branch direction mismatch', await scalar(`SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId JOIN ChuyenXe c ON c.chuyenXeId=p.chuyenXeId JOIN TuyenXe t ON t.tuyenXeId=c.tuyenXeId JOIN BuuCuc bg ON bg.buuCucId=r.buuCucGuiId JOIN BuuCuc bp ON bp.buuCucId=r.buuCucPhatId WHERE t.diemDi <> ${branchCitySql('bg')} OR t.diemDen <> ${branchCitySql('bp')}`));
  await assertZero('shipment pickup address differs from branch', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BuuCuc b ON b.buuCucId=p.buuCucGuiId WHERE p.hinhThucLayHang='GUI_TAI_BUU_CUC' AND p.diaChiLayHang <> b.diaChi"));
  await assertZero('shipment delivery address differs from branch', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BuuCuc b ON b.buuCucId=p.buuCucPhatId WHERE p.hinhThucGiaoHang='GIAO_TAI_BUU_CUC' AND p.diaChiNguoiNhan <> b.diaChi"));
  await assertZero('unassigned shipment pickup address direction mismatch', await scalar(`SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId JOIN BuuCuc bg ON bg.buuCucId=r.buuCucGuiId WHERE p.chuyenXeId IS NULL AND p.hinhThucLayHang='NHAN_TAN_NOI' AND p.diaChiLayHang NOT LIKE CONCAT('%', ${branchCitySql('bg')}, '%')`));
  await assertZero('unassigned shipment delivery address direction mismatch', await scalar(`SELECT COUNT(*) AS value FROM PhieuGuiHang p JOIN BangCuocGuiHang r ON r.bangCuocGuiHangId=p.bangCuocApDungId JOIN BuuCuc bp ON bp.buuCucId=r.buuCucPhatId WHERE p.chuyenXeId IS NULL AND p.hinhThucGiaoHang='GIAO_TAN_NOI' AND p.diaChiNguoiNhan NOT LIKE CONCAT('%', ${branchCitySql('bp')}, '%')`));
  await assertZero('shipment with both home endpoints assigned to trip', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE chuyenXeId IS NOT NULL AND hinhThucLayHang='NHAN_TAN_NOI' AND hinhThucGiaoHang='GIAO_TAN_NOI'"));
  await assertZero('placeholder demo addresses', await scalar("SELECT COUNT(*) AS value FROM BuuCuc WHERE diaChi LIKE '%Đường Demo%'"));
  const snapshotCustomer = await prisma.khachHang.findUnique({ where: { maKhachHang: 'KH-000001' } });
  if (!snapshotCustomer) throw new Error('KH-000001 was not found by business key');
  await assertZero('snapshot mismatch absent', await scalar(`SELECT COUNT(*) AS value FROM DonGiaoDich d JOIN KhachHang k ON k.khachHangId=d.khachHangId JOIN TaiKhoan a ON a.taiKhoanId=k.taiKhoanId WHERE d.khachHangId=${snapshotCustomer.khachHangId} AND d.tenKhachHang=a.hoTen AND d.soDienThoaiKhachHang=a.soDienThoai`));
  await assertZero('missing successful invoice', await scalar("SELECT COUNT(*) AS value FROM DonGiaoDich d LEFT JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId WHERE d.trangThai='DA_THANH_TOAN' AND h.hoaDonId IS NULL"));
  await assertZero('invoice on unpaid transaction', await scalar("SELECT COUNT(*) AS value FROM DonGiaoDich d JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId WHERE d.trangThai <> 'DA_THANH_TOAN'"));
  await assertZero('invalid image URLs', await scalar("SELECT COUNT(*) AS value FROM HinhAnhHangHoa WHERE duongDan NOT LIKE 'https://%'") );
  await assertEqual('canceled ticket scenario', await scalar("SELECT COUNT(*) AS value FROM Ve WHERE trangThai='HUY'"), 6);
  await assertEqual('shipping pending dispatch scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE chuyenXeId IS NULL"), 12);
  await assertEqual('delivered shipment scenario', await scalar("SELECT COUNT(*) AS value FROM PhieuGuiHang WHERE trangThai='DA_GIAO'"), 6);
  await assertEqual('failed payment scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan WHERE trangThai='THAT_BAI'"), 3);
  await assertEqual('pending payment scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan WHERE trangThai='DANG_XU_LY'"), 3);
  await assertEqual('refund scenario', await scalar("SELECT COUNT(*) AS value FROM ThanhToan tt JOIN Ve v ON v.veId=tt.veId WHERE tt.loaiGiaoDich='HOAN_TIEN' AND v.trangThai='HUY'"), 3);
  await assertEqual('promotion active status', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='DANG_HOAT_DONG'"), 6);
  await assertEqual('promotion future status', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='SAP_DIEN_RA'"), 3);
  await assertEqual('promotion expired status', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='HET_HAN'"), 3);
  await assertEqual('promotion paused status', await scalar("SELECT COUNT(*) AS value FROM KhuyenMai WHERE trangThai='TAM_NGUNG'"), 3);
  await assertZero('ticket exchange timing mismatch', await scalar("SELECT COUNT(*) AS value FROM DonGiaoDich exchangeTx JOIN PhieuDatVe oldBooking ON oldBooking.maPhieuDatVe LIKE '%-PDV-220920261040-0005' JOIN Ve old ON old.phieuDatVeId=oldBooking.phieuDatVeId AND old.maVe LIKE '%-PDV-220920261040-0005-VE-01' JOIN GheChuyenXe oldSeat ON oldSeat.gheChuyenXeId=old.gheChuyenXeId JOIN ChuyenXe oldTrip ON oldTrip.chuyenXeId=oldSeat.chuyenXeId JOIN PhieuDatVe newBooking ON newBooking.donGiaoDichId=exchangeTx.donGiaoDichId JOIN Ve newVe ON newVe.phieuDatVeId=newBooking.phieuDatVeId AND newVe.maVe LIKE '%-PDV-240920261230-0014-VE-01' JOIN GheChuyenXe newSeat ON newSeat.gheChuyenXeId=newVe.gheChuyenXeId JOIN ChuyenXe newTrip ON newTrip.chuyenXeId=newSeat.chuyenXeId WHERE exchangeTx.maDonGiaoDich LIKE '%-GD-240920261230-0014' AND (exchangeTx.ngayTao >= TIMESTAMP(DATE(oldTrip.ngayKhoiHanh), TIME(oldTrip.gioKhoiHanh)) - INTERVAL 7 HOUR OR exchangeTx.ngayTao >= TIMESTAMP(DATE(newTrip.ngayKhoiHanh), TIME(newTrip.gioKhoiHanh)) - INTERVAL 7 HOUR)"));
  for (const code of ['FUTA', 'TB', 'HM']) {
    const exchangeRows = await prisma.$queryRawUnsafe(`SELECT old.maVe AS oldMaVe, old.trangThai AS oldStatus, old.giaThucTe AS oldPrice, oldSeat.trangThai AS oldSeatStatus, oldTrip.chuyenXeId AS oldTripId, oldTx.khachHangId AS oldCustomerId, newVe.maVe AS newMaVe, newVe.trangThai AS newStatus, newVe.giaThucTe AS newPrice, newSeat.trangThai AS newSeatStatus, newTrip.chuyenXeId AS newTripId, exchangeTx.khachHangId AS newCustomerId, tt.soTien AS difference, tt.loaiGiaoDich AS differenceType FROM Ve old JOIN PhieuDatVe oldBooking ON oldBooking.phieuDatVeId=old.phieuDatVeId JOIN DonGiaoDich oldTx ON oldTx.donGiaoDichId=oldBooking.donGiaoDichId JOIN GheChuyenXe oldSeat ON oldSeat.gheChuyenXeId=old.gheChuyenXeId JOIN ChuyenXe oldTrip ON oldTrip.chuyenXeId=oldSeat.chuyenXeId JOIN DonGiaoDich exchangeTx ON exchangeTx.maDonGiaoDich='${code}-GD-240920261230-0014' JOIN PhieuDatVe newBooking ON newBooking.donGiaoDichId=exchangeTx.donGiaoDichId JOIN Ve newVe ON newVe.phieuDatVeId=newBooking.phieuDatVeId AND newVe.maVe='${code}-PDV-240920261230-0014-VE-01' LEFT JOIN ThanhToan tt ON tt.donGiaoDichId=exchangeTx.donGiaoDichId AND tt.veId=newVe.veId AND tt.loaiGiaoDich IN ('THU_CHENH_LECH', 'HOAN_TIEN') AND tt.trangThai='THANH_CONG' JOIN GheChuyenXe newSeat ON newSeat.gheChuyenXeId=newVe.gheChuyenXeId JOIN ChuyenXe newTrip ON newTrip.chuyenXeId=newSeat.chuyenXeId WHERE old.maVe='${code}-PDV-220920261040-0005-VE-01'`);
    if (exchangeRows.length !== 1) throw new Error(`Expected one real exchange scenario for ${code}, got ${exchangeRows.length}`);
    const exchange = exchangeRows[0];
    const expectedDifference = Number(exchange.newPrice) - Number(exchange.oldPrice);
    const actualDifferencePayment = exchange.difference === null ? null : Number(exchange.difference);
    const validDifferencePayment = expectedDifference > 0
      ? exchange.differenceType === 'THU_CHENH_LECH' && actualDifferencePayment === expectedDifference
      : expectedDifference < 0
        ? exchange.differenceType === 'HOAN_TIEN' && actualDifferencePayment === Math.abs(expectedDifference)
        : exchange.difference === null;
    if (exchange.oldStatus !== 'HUY' || exchange.oldSeatStatus !== 'TRONG' || exchange.newStatus !== 'DA_DAT' || exchange.newSeatStatus !== 'DA_DAT' || Number(exchange.oldTripId) === Number(exchange.newTripId) || Number(exchange.oldCustomerId) !== Number(exchange.newCustomerId) || !validDifferencePayment) {
      throw new Error(`Invalid real exchange scenario for ${code}`);
    }
    console.log(`OK real ticket exchange ${exchange.oldMaVe} -> ${exchange.newMaVe} (${exchange.oldPrice} -> ${exchange.newPrice}, difference ${expectedDifference})`);

    const totalRows = await prisma.$queryRawUnsafe(`SELECT d.tongTien AS transactionTotal, h.tongTien AS invoiceTotal, COALESCE((SELECT SUM(CASE WHEN t.loaiGiaoDich='HOAN_TIEN' THEN -t.soTien ELSE t.soTien END) FROM ThanhToan t WHERE t.donGiaoDichId=d.donGiaoDichId AND t.trangThai='THANH_CONG'), 0) AS netSuccessfulPayments, COALESCE((SELECT SUM(t.soTien) FROM ThanhToan t WHERE t.donGiaoDichId=d.donGiaoDichId AND t.trangThai='THANH_CONG' AND t.loaiGiaoDich='THANH_TOAN'), 0) AS baseSuccessfulPayments, COALESCE((SELECT SUM(v.giaThucTe) FROM Ve v JOIN PhieuDatVe p ON p.phieuDatVeId=v.phieuDatVeId WHERE p.donGiaoDichId=d.donGiaoDichId AND v.maVe <> '${code}-PDV-240920261230-0014-VE-01'), 0) AS extraTicketTotal, COALESCE((SELECT SUM(p.tongPhi) FROM PhieuGuiHang p WHERE p.donGiaoDichId=d.donGiaoDichId), 0) AS shippingTotal FROM DonGiaoDich d LEFT JOIN HoaDon h ON h.donGiaoDichId=d.donGiaoDichId WHERE d.maDonGiaoDich='${code}-GD-240920261230-0014'`);
    if (totalRows.length !== 1) throw new Error(`Missing exchange total row for ${code}`);
    const totals = totalRows[0];
    const extraServices = Number(totals.extraTicketTotal) + Number(totals.shippingTotal);
    const expectedTransactionTotal = extraServices + expectedDifference;
    if (Number(totals.baseSuccessfulPayments) !== extraServices || Number(totals.netSuccessfulPayments) !== expectedTransactionTotal || Number(totals.transactionTotal) !== expectedTransactionTotal || Number(totals.invoiceTotal) !== expectedTransactionTotal) {
      throw new Error(`Exchange total double-count or payment mismatch for ${code}`);
    }
    console.log(`OK exchange totals ${code}: services ${extraServices}, net ${expectedTransactionTotal}`);
  }
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
