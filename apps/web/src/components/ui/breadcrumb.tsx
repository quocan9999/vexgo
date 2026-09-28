// /src/common/components/ui/Breadcrumb.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { Home, ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  showHomeIcon?: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className = '',
  showHomeIcon = true,
}) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs font-medium text-slate-500 py-2.5 overflow-x-auto ${className}`}>
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        {/* Item đầu tiên: Trang chủ */}
        <li className="inline-flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:text-emerald-800 transition-colors cursor-pointer"
          >
            {showHomeIcon && <Home className="w-3.5 h-3.5 text-slate-400" />}
            <span>Trang chủ</span>
          </Link>
        </li>

        {/* Các items tiếp theo */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`crumb-${index}`} className="inline-flex items-center gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={`truncate max-w-xs sm:max-w-md ${isLast ? 'font-bold text-slate-900' : ''}`}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
