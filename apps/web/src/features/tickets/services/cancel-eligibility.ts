import type { TicketItem } from '@/features/account/services/tickets.api';

export interface CancelEligibilityResult {
  eligible: boolean;
  reason?: 'ALREADY_CANCELLED' | 'ALREADY_DEPARTED' | 'LESS_THAN_12_HOURS';
  title: string;
  message: string;
}

export function formatTimeAndDate(isoString: string | null | undefined): { time: string; date: string } {
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
  ticket: Pick<TicketItem, 'status' | 'departureTime'> | null | undefined,
  nowMs = Date.now(),
): CancelEligibilityResult {
  if (!ticket) {
    return {
      eligible: false,
      title: 'Không tìm thấy thông tin vé',
      message: 'Vui lòng kiểm tra lại mã vé và số điện thoại.',
    };
  }

  const statusUpper = (ticket.status || '').toUpperCase();
  if (statusUpper === 'HUY' || statusUpper === 'CANCELLED') {
    return {
      eligible: false,
      reason: 'ALREADY_CANCELLED',
      title: 'Vé đã được hủy',
      message: 'Vé này đã hoàn tất thủ tục hủy trước đó và không còn hiệu lực.',
    };
  }

  if (!ticket.departureTime) {
    return { eligible: true, title: '', message: '' };
  }

  const departureDate = new Date(ticket.departureTime);
  if (isNaN(departureDate.getTime())) {
    return { eligible: true, title: '', message: '' };
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
    };
  }

  if (diffHours < 12) {
    return {
      eligible: false,
      reason: 'LESS_THAN_12_HOURS',
      title: 'Vé không đủ điều kiện hủy',
      message: `Chuyến xe khởi hành vào lúc ${timeStr} (còn dưới 12 tiếng).\n\nTheo quy định của nhà xe, vé chỉ được hỗ trợ hủy trước giờ khởi hành tối thiểu 12 tiếng.\n\nVui lòng liên hệ tổng đài để được hỗ trợ.`,
    };
  }

  return { eligible: true, title: '', message: '' };
}
