export function formatTimestamp(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}

export function formatVnd(value: string | null | undefined) {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return '—';
  const [whole = '', fraction = ''] = value.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  const formattedWhole = new Intl.NumberFormat('vi-VN').format(BigInt(whole));
  return `${formattedWhole}${trimmedFraction ? `,${trimmedFraction}` : ''} ₫`;
}

export function statusLabel(status: string) {
  const known: Record<string, string> = {
    CHO_THANH_TOAN: 'Chờ thanh toán',
    DA_THANH_TOAN: 'Đã thanh toán',
    HOAN_THANH: 'Hoàn thành',
    DA_HUY: 'Đã hủy',
    DA_DAT: 'Đã đặt',
    HUY: 'Đã hủy',
    DANG_XU_LY: 'Đang xử lý',
    DANG_GUI: 'Đang gửi',
    THANH_CONG: 'Thành công',
    THAT_BAI: 'Thất bại',
    DA_HOAN_TIEN: 'Đã hoàn tiền',
    CHO_XAC_NHAN: 'Chờ xác nhận',
    MOI_TAO: 'Mới tạo',
    DA_TIEP_NHAN: 'Đã tiếp nhận',
    DANG_VAN_CHUYEN: 'Đang vận chuyển',
    DA_GIAO: 'Đã giao',
  };
  return known[status] ?? status.replaceAll('_', ' ');
}

export function statusIsActive(status: string) {
  return ['DA_THANH_TOAN', 'HOAN_THANH', 'DA_DAT', 'THANH_CONG'].includes(
    status,
  );
}

export function tripIntegrityMessage(integrity: string) {
  switch (integrity) {
    case 'MULTIPLE_TRIPS':
      return 'Dữ liệu phiếu có vé thuộc nhiều chuyến; thông tin chuyến không được xác định.';
    case 'NO_TICKETS':
      return 'Phiếu hiện chưa có vé để xác định chuyến.';
    case 'TRIP_UNAVAILABLE':
      return 'Không thể xác định chuyến trong phạm vi nhà xe.';
    case 'TRIP_MISMATCH':
      return 'Chuyến của hàng gửi không khớp với chuyến của phiếu.';
    default:
      return 'Chuyến xe chưa có thông tin.';
  }
}

export function historyStatusText(oldStatus: string | null, newStatus: string) {
  if (oldStatus === null) {
    return `Trạng thái được ghi nhận khi khởi tạo lịch sử: ${statusLabel(newStatus)}`;
  }
  return oldStatus === newStatus
    ? statusLabel(newStatus)
    : `${statusLabel(oldStatus)} → ${statusLabel(newStatus)}`;
}
