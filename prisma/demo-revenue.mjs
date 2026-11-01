// Synthetic completion times for the named demo seed only, never provider history.
export function isDemoRevenueOrder(code) {
  if (typeof code !== 'string') return false;
  return /^[0-9a-f]{32}$/.test(code) || /^(FUTA|TB|HM)-GD-\d{12}-\d{4}$/.test(code);
}

// Read persisted evidence before considering fixture values. A completed payment
// (including an offline confirmation) must never be rewritten by demo seeding.
export async function ensureDemoPayment(db, data) {
  const existing = await db.thanhToan.findFirst({
    where: { donGiaoDichId: data.donGiaoDichId, loaiGiaoDich: data.loaiGiaoDich, veId: data.veId ?? null },
  });
  if (existing && (existing.maGiaoDichSePay || existing.thoiDiemHoanTat || existing.laQuyetToanHopLe)) {
    return { payment: existing, operation: 'preserve' };
  }
  const paymentData = { ...data, ...await demoRevenueFields(db, { ...existing, ...data }) };
  if (existing) {
    const result = await db.thanhToan.updateMany({
      where: { thanhToanId: existing.thanhToanId, updatedAt: existing.updatedAt, maGiaoDichSePay: null, thoiDiemHoanTat: null, laQuyetToanHopLe: false },
      data: paymentData,
    });
    return {
      payment: await db.thanhToan.findUnique({ where: { thanhToanId: existing.thanhToanId } }),
      operation: result.count === 1 ? 'update' : 'preserve',
    };
  }
  return { payment: await db.thanhToan.create({ data: paymentData }), operation: 'create' };
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
  const lastFour = order.maDonGiaoDich.slice(-4);
  const parsedNum = /^\d+$/.test(lastFour) ? Number(lastFour) : parseInt(lastFour, 16);
  const delay = ((Number.isFinite(parsedNum) ? parsedNum : 1) % 2 + 1) * 60_000;
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
