export function formatCurrency(value: number, locale = 'vi') {
  if (locale === 'en') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} VND`;
  }
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

export function formatCompactCurrency(value: number, locale = 'vi') {
  if (locale === 'en') {
    return `${new Intl.NumberFormat('en-US').format(value)} VND`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
}
