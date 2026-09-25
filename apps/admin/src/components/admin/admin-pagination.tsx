import { ChevronLeft, ChevronRight } from 'lucide-react';

type AdminPaginationProps = {
  currentPage: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  pageSize: number;
  summaryLabel: string;
  totalItems: number;
  totalPages: number;
};

export function AdminPagination({
  currentPage,
  disabled = false,
  onPageChange,
  pageSize,
  summaryLabel,
  totalItems,
  totalPages,
}: AdminPaginationProps) {
  const normalizedTotalItems = Math.max(0, totalItems);
  const normalizedTotalPages = Math.max(0, totalPages);
  const normalizedPageSize = Math.max(1, pageSize);
  const displayedPage =
    normalizedTotalItems === 0 || normalizedTotalPages === 0
      ? 0
      : Math.min(Math.max(1, currentPage), normalizedTotalPages);
  const firstItem =
    displayedPage === 0
      ? 0
      : (displayedPage - 1) * normalizedPageSize + 1;
  const lastItem =
    displayedPage === 0
      ? 0
      : Math.min(displayedPage * normalizedPageSize, normalizedTotalItems);

  return (
    <div className="table-pagination">
      <span className="pagination-summary">
        Hiển thị <strong>{firstItem}–{lastItem}</strong> trong{' '}
        <strong>
          {new Intl.NumberFormat('vi-VN').format(normalizedTotalItems)}
        </strong>{' '}
        {summaryLabel}
      </span>
      <div className="pagination-controls" aria-label={`Phân trang ${summaryLabel}`}>
        <span>
          Trang <strong>{displayedPage}</strong> / {normalizedTotalPages}
        </span>
        <button
          aria-label="Trang trước"
          className="pagination-button"
          disabled={disabled || displayedPage <= 1}
          onClick={() => onPageChange(Math.max(1, displayedPage - 1))}
          type="button"
        >
          <ChevronLeft size={17} />
        </button>
        <button
          aria-label="Trang sau"
          className="pagination-button"
          disabled={disabled || displayedPage >= normalizedTotalPages}
          onClick={() => onPageChange(displayedPage + 1)}
          type="button"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
