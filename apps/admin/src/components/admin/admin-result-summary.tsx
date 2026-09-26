type AdminResultSummaryProps = {
  totalItems: number | null;
};

const numberFormat = new Intl.NumberFormat('vi-VN');

export function AdminResultSummary({ totalItems }: AdminResultSummaryProps) {
  return totalItems === null
    ? 'Đang tải kết quả'
    : `${numberFormat.format(totalItems)} kết quả`;
}
