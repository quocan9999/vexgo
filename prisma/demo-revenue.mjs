// Synthetic completion times for the named demo seed only, never provider history.
export function isDemoRevenueOrder(code) {
  return /^(FUTA|TB|HM)-GD-\d{12}-\d{4}$/.test(code);
}

function wholeVnd(value) {
  const text = String(value);
  if (!/^\d+(?:\.0+)?$/.test(text)) return null;
  return BigInt(text.split('.')[0]);
}

function saleMatchesOrder(order, payment) {
  const amount = wholeVnd(payment.soTien);
  const ticketAmounts = (order.phieuDatVe?.ves ?? []).map((ticket) => wholeVnd(ticket.giaThucTe));
  const shipping = wholeVnd(order.phieuGuiHang?.tongPhi ?? 0);
  if (amount === null || amount <= 0n || shipping === null || ticketAmounts.includes(null)) return false;
  const total = ticketAmounts.reduce((sum, value) => sum + value, shipping);
  return (order.phieuDatVe || order.phieuGuiHang) &&
    order.trangThai === 'DA_THANH_TOAN' &&
    amount === wholeVnd(order.tongTien) && amount === total;
}

export async function demoRevenueFields(db, payment) {
  const empty = { thoiDiemHoanTat: null, laQuyetToanHopLe: false };
  if (payment.trangThai !== 'THANH_CONG' || payment.maGiaoDichSePay) return empty;
  const order = await db.donGiaoDich.findUnique({
    where: { donGiaoDichId: payment.donGiaoDichId },
    include: {
      phieuDatVe: { include: { ves: true } },
      phieuGuiHang: true,
      thanhToans: true,
    },
  });
  if (!order || !isDemoRevenueOrder(order.maDonGiaoDich)) return empty;
  const successfulSales = order.thanhToans.filter((row) => row.loaiGiaoDich === 'THANH_TOAN' && row.trangThai === 'THANH_CONG');
  const delay = (Number(order.maDonGiaoDich.slice(-4)) % 2 + 1) * 60_000;
  const completeAfter = (...dates) => new Date(Math.max(...dates.map((date) => new Date(date).getTime())) + delay);
  if (payment.loaiGiaoDich === 'THANH_TOAN') {
    if (successfulSales.length > 1 || !saleMatchesOrder(order, payment)) return empty;
    return { thoiDiemHoanTat: completeAfter(order.ngayTao, payment.thoiGian), laQuyetToanHopLe: true };
  }
  if (payment.loaiGiaoDich !== 'HOAN_TIEN' || successfulSales.length !== 1) return empty;
  const sale = successfulSales[0];
  const ticket = order.phieuDatVe?.ves.find((row) => row.veId === payment.veId);
  const refundAmount = wholeVnd(payment.soTien);
  const successfulRefunds = order.thanhToans.filter((row) => row.loaiGiaoDich === 'HOAN_TIEN' && row.trangThai === 'THANH_CONG' && row.veId === payment.veId);
  if (!saleMatchesOrder(order, sale) || sale.maGiaoDichSePay || !ticket || ticket.trangThai !== 'HUY' ||
      refundAmount === null || refundAmount <= 0n || refundAmount > wholeVnd(ticket.giaThucTe) || successfulRefunds.length > 1) return empty;
  const saleCompletion = sale.thoiDiemHoanTat ?? completeAfter(order.ngayTao, sale.thoiGian);
  return { thoiDiemHoanTat: completeAfter(payment.thoiGian, saleCompletion), laQuyetToanHopLe: false };
}
