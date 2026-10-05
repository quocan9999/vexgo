import type { TicketItem } from '@/features/account/services/tickets.api';

export interface CancelEligibilityResult {
  eligible: boolean;
  reason?:
    | 'ALREADY_CANCELLED'
    | 'ALREADY_DEPARTED'
    | 'LESS_THAN_12_HOURS'
    | 'DEPARTURE_TIME_UNAVAILABLE';
  title: string;
  message: string;
  cancelFeeRate?: number;
  cancelFee?: number;
  refundAmount?: number;
}

export function formatTimeAndDate(isoString: string | null | undefined): {
  time: string;
  date: string;
} {
  if (!isoString) return { time: '--:--', date: 'Chưa cập nhật' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { time: '--:--', date: isoString };
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return {
      time: `${hours}:${minutes}`,
      date: `${day}/${month}/${year}`,
    };
  } catch {
    return { time: '--:--', date: isoString };
  }
}

export function checkTicketCancelEligibility(
  ticket:
    | (Pick<TicketItem, 'status' | 'departureTime' | 'cancellation'> & {
        price?: number;
      })
    | null
    | undefined,
  nowMs = Date.now(),
): CancelEligibilityResult {
  if (!ticket) {
    return {
      eligible: false,
      title: 'Không tìm thấy thông tin vé',
      message: 'Vui lòng kiểm tra lại mã vé và số điện thoại.',
    };
  }

  if (ticket.cancellation && !ticket.cancellation.eligible) {
    switch (ticket.cancellation.reason) {
      case 'ALREADY_CANCELLED':
        return {
          eligible: false,
          reason: 'ALREADY_CANCELLED',
          title: 'Vé đã được hủy',
          message:
            'Vé này đã hoàn tất thủ tục hủy trước đó và không còn hiệu lực.',
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        };
      case 'ALREADY_DEPARTED':
        return {
          eligible: false,
          reason: 'ALREADY_DEPARTED',
          title: 'Chuyến xe đã khởi hành',
          message:
            'Vé không còn giá trị hủy hoặc hoàn tiền sau khi xe đã xuất bến.',
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        };
      case 'LESS_THAN_12_HOURS':
        return {
          eligible: false,
          reason: 'LESS_THAN_12_HOURS',
          title: 'Vé không đủ điều kiện hủy',
          message:
            'Vé chỉ được hỗ trợ hủy trước giờ khởi hành tối thiểu 12 tiếng.',
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        };
      case 'DEPARTURE_TIME_UNAVAILABLE':
        return {
          eligible: false,
          reason: 'DEPARTURE_TIME_UNAVAILABLE',
          title: 'Chưa thể xác định điều kiện hủy',
          message:
            'Thông tin giờ khởi hành chưa đầy đủ. Vui lòng liên hệ nhà xe để được hỗ trợ.',
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        };
      default:
        return {
          eligible: false,
          title: 'Vé không đủ điều kiện hủy',
          message: 'Vé không đủ điều kiện để thực hiện hủy theo quy định.',
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        };
    }
  }

  const statusUpper = (ticket.status || '').toUpperCase();
  if (
    statusUpper === 'HUY' ||
    statusUpper === 'CANCELLED' ||
    ticket.cancellation?.reason === 'ALREADY_CANCELLED'
  ) {
    return {
      eligible: false,
      reason: 'ALREADY_CANCELLED',
      title: 'Vé đã được hủy',
      message: 'Vé này đã hoàn tất thủ tục hủy trước đó và không còn hiệu lực.',
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    };
  }

  if (!ticket.departureTime) {
    if (ticket.cancellation?.reason === 'DEPARTURE_TIME_UNAVAILABLE') {
      return {
        eligible: false,
        reason: 'DEPARTURE_TIME_UNAVAILABLE',
        title: 'Chưa thể xác định điều kiện hủy',
        message:
          'Thông tin giờ khởi hành chưa đầy đủ. Vui lòng liên hệ nhà xe để được hỗ trợ.',
        cancelFeeRate: 0,
        cancelFee: 0,
        refundAmount: 0,
      };
    }
    if (ticket.cancellation?.eligible) {
      return {
        eligible: true,
        title: '',
        message: '',
        cancelFeeRate: ticket.cancellation.cancelFeeRate,
        cancelFee: ticket.cancellation.cancelFee,
        refundAmount: ticket.cancellation.refundAmount,
      };
    }
    return {
      eligible: false,
      reason: 'DEPARTURE_TIME_UNAVAILABLE',
      title: 'Chưa thể xác định điều kiện hủy',
      message:
        'Thông tin giờ khởi hành chưa đầy đủ. Vui lòng liên hệ nhà xe để được hỗ trợ.',
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    };
  }

  const departureDate = new Date(ticket.departureTime);
  if (isNaN(departureDate.getTime())) {
    if (ticket.cancellation?.eligible) {
      return {
        eligible: true,
        title: '',
        message: '',
        cancelFeeRate: ticket.cancellation.cancelFeeRate,
        cancelFee: ticket.cancellation.cancelFee,
        refundAmount: ticket.cancellation.refundAmount,
      };
    }
    return {
      eligible: false,
      reason: 'DEPARTURE_TIME_UNAVAILABLE',
      title: 'Chưa thể xác định điều kiện hủy',
      message:
        'Thông tin giờ khởi hành chưa đầy đủ. Vui lòng liên hệ nhà xe để được hỗ trợ.',
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    };
  }

  const departureMs = departureDate.getTime();
  const diffMs = departureMs - nowMs;
  const diffHours = diffMs / (1000 * 60 * 60);

  const formattedInfo = formatTimeAndDate(ticket.departureTime);
  const timeStr = `${formattedInfo.time}, ngày ${formattedInfo.date}`;

  if (diffHours <= 0) {
    return {
      eligible: false,
      reason: 'ALREADY_DEPARTED',
      title: 'Chuyến xe đã khởi hành',
      message: `Chuyến xe đã khởi hành vào lúc ${timeStr}.\n\nTheo quy định của nhà xe, vé không còn giá trị hủy hoặc hoàn tiền sau khi xe đã xuất bến.`,
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    };
  }

  if (diffHours < 12) {
    return {
      eligible: false,
      reason: 'LESS_THAN_12_HOURS',
      title: 'Vé không đủ điều kiện hủy',
      message: `Chuyến xe khởi hành vào lúc ${timeStr} (còn dưới 12 tiếng).\n\nTheo quy định của nhà xe, vé chỉ được hỗ trợ hủy trước giờ khởi hành tối thiểu 12 tiếng.\n\nVui lòng liên hệ tổng đài để được hỗ trợ.`,
      cancelFeeRate: 0,
      cancelFee: 0,
      refundAmount: 0,
    };
  }

  const cancelFeeRate = diffHours <= 24 ? 0.2 : 0.1;
  const price =
    ('price' in ticket && typeof ticket.price === 'number'
      ? ticket.price
      : null) ??
    (ticket.cancellation
      ? (ticket.cancellation.cancelFee || 0) +
        (ticket.cancellation.refundAmount || 0)
      : 0);

  let cancelFee = Math.round(price * cancelFeeRate);
  let refundAmount = Math.max(0, price - cancelFee);

  if (
    ticket.cancellation?.eligible &&
    ticket.cancellation.cancelFeeRate === cancelFeeRate
  ) {
    cancelFee = ticket.cancellation.cancelFee;
    refundAmount = ticket.cancellation.refundAmount;
  }

  return {
    eligible: true,
    title: '',
    message: '',
    cancelFeeRate,
    cancelFee,
    refundAmount,
  };
}
