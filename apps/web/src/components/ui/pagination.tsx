// /src/common/components/ui/Pagination.tsx
'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  const safeTotalPages = Math.max(1, totalPages);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', safeTotalPages);
      } else if (currentPage >= safeTotalPages - 2) {
        pages.push(1, '...', safeTotalPages - 3, safeTotalPages - 2, safeTotalPages - 1, safeTotalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', safeTotalPages);
      }
    }
    return pages;
  };

  return (
    <div className={`flex items-center justify-center gap-1.5 py-1 ${className}`}>
      {/* Nút Trang trước */}
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        aria-label="Trang trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Các số trang */}
      {getPageNumbers().map((page, index) => {
        if (page === '...') {
          return (
            <span key={`dots-${index}`} className="w-6 text-center font-bold text-xs text-slate-400">
              ...
            </span>
          );
        }

        const pageNum = page as number;
        const isActive = pageNum === currentPage;

        return (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={`min-w-[32px] h-8 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer select-none
              ${
                isActive
                  ? 'bg-brand-dark text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }
            `}
          >
            {pageNum}
          </button>
        );
      })}

      {/* Nút Trang sau */}
      <button
        type="button"
        disabled={currentPage >= safeTotalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        aria-label="Trang sau"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
