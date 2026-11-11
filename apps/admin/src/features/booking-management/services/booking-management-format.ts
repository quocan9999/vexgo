export function formatTimestamp(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
    .format(new Date(value))
    .replaceAll('/', '-');
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
    CHO_THANH_TOAN: 'Pending Payment',
    CHO_THAN_TOAN: 'Pending Payment',
    DA_THANH_TOAN: 'Paid',
    HOAN_THANH: 'Completed',
    DA_HUY: 'Cancelled',
    DA_DAT: 'Confirmed',
    HUY: 'Cancelled',
    DANG_XU_LY: 'Processing',
    DANG_GUI: 'Sending',
    THANH_CONG: 'Success',
    THAT_BAI: 'Failed',
    DA_HOAN_TIEN: 'Refunded',
    CHO_XAC_NHAN: 'Pending Confirmation',
    MOI_TAO: 'New',
    DA_TIEP_NHAN: 'Received',
    DANG_VAN_CHUYEN: 'In Transit',
    DA_GIAO: 'Delivered',
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
      return 'Tickets belong to multiple trips; trip information cannot be determined.';
    case 'NO_TICKETS':
      return 'Booking currently has no tickets to identify the trip.';
    case 'TRIP_UNAVAILABLE':
      return 'Trip not available within operator scope.';
    case 'TRIP_MISMATCH':
      return 'Shipment trip does not match booking trip.';
    default:
      return 'Trip information not available.';
  }
}

export function historyStatusText(oldStatus: string | null, newStatus: string) {
  if (oldStatus === null) {
    return `Recorded on history initialization: ${statusLabel(newStatus)}`;
  }
  return oldStatus === newStatus
    ? statusLabel(newStatus)
    : `${statusLabel(oldStatus)} → ${statusLabel(newStatus)}`;
}
