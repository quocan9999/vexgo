// /src/common/utils/formatters.ts

/**
 * Format số tiền sang dạng chữ Việt Nam (Tỷ, Triệu, Nghìn)
 * VD: 2500000000 -> "2.5 Tỷ VNĐ"
 */
export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return 'Thương lượng';
  if (amount === 0) return '0 VNĐ';

  if (amount >= 1_000_000_000) {
    const billions = amount / 1_000_000_000;
    return `${billions.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} Tỷ VNĐ`;
  }
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} Triệu VNĐ`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toLocaleString('vi-VN')} Nghìn VNĐ`;
  }
  return `${amount.toLocaleString('vi-VN')} VNĐ`;
}

/**
 * Format khoảng giá Min - Max
 * VD: (2000000000, 3500000000) -> "2 Tỷ - 3.5 Tỷ VNĐ"
 */
export function formatPriceRange(minPrice?: number | null, maxPrice?: number | null): string {
  if (!minPrice && !maxPrice) return 'Thỏa thuận';
  if (minPrice && !maxPrice) return `Từ ${formatCurrency(minPrice)}`;
  if (!minPrice && maxPrice) return `Đến ${formatCurrency(maxPrice)}`;
  if (minPrice === maxPrice) return formatCurrency(minPrice);
  return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
}

/**
 * Format khoảng diện tích
 * VD: (80, 120) -> "80 - 120 m²"
 */
export function formatAreaRange(minArea?: number | null, maxArea?: number | null): string {
  if (!minArea && !maxArea) return 'Không xác định';
  if (minArea && !maxArea) return `Từ ${minArea} m²`;
  if (!minArea && maxArea) return `Đến ${maxArea} m²`;
  if (minArea === maxArea) return `${minArea} m²`;
  return `${minArea} - ${maxArea} m²`;
}

/**
 * Format ngày tháng tiếng Việt (VD: "12/09/2026")
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format ngày giờ chi tiết (VD: "14:30 - 12/09/2026")
 */
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${formatDate(dateString)}`;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt không dấu (Unaccent) để tìm kiếm
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  str = str.replace(/đ/g, 'd');
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A');
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E');
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I');
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O');
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U');
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y');
  str = str.replace(/Đ/g, 'D');
  return str.toLowerCase().trim();
}
