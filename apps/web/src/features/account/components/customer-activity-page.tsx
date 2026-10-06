'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProfileSidebar } from '@/features/account/components/profile-sidebar';
import { useAuthSession } from '@/features/auth/auth-session';
import {
  bookingsApi,
  type BookingItem,
  type PaginationMeta,
} from '@/features/account/services/bookings.api';
import { resolveCustomerActivityViewState } from '@/features/account/services/customer-activity-view-state';

function formatDeparture(isoString: string | null): string {
  if (!isoString) return '--:-- --/--/----';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}-${month}-${year}`;
  } catch {
    return isoString;
  }
}

function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

function renderStatusBadge(status: string | null) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'DA_THANH_TOAN' || s === 'THANH_CONG') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">
        Đã thanh toán
      </span>
    );
  }
  if (s === 'CHO_THANH_TOAN' || s === 'CHO_XU_LY') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
        Chờ thanh toán
      </span>
    );
  }
  if (s === 'DA_HUY' || s === 'THAT_BAI') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
        Đã hủy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-slate-600 bg-slate-100 whitespace-nowrap">
      {status}
    </span>
  );
}

export default function CustomerActivityPage() {
  const router = useRouter();
  const { accessToken, isHydrated, executeWithAuth } = useAuthSession();

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Filter states
  const [codeFilter, setCodeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Applied query params for active search
  const [activeQuery, setActiveQuery] = useState({
    code: '',
    date: '',
    route: '',
    status: '',
    page: 1,
    pageSize: 10,
  });

  useEffect(() => {
    let ignore = false;
    if (!isHydrated) return;
    if (!accessToken) {
      router.replace('/auth/login?next=/account/tickets');
      return;
    }

    const fetchBookings = async () => {
      setErrorMessage('');
      try {
        const res = await executeWithAuth((token) =>
          bookingsApi.getBookings(token, {
            page: activeQuery.page,
            pageSize: activeQuery.pageSize,
            code: activeQuery.code || undefined,
            departureDate: activeQuery.date || undefined,
            route: activeQuery.route || undefined,
            status: activeQuery.status || undefined,
          }),
        );
        if (!ignore && res) {
          setBookings(res.data);
          setMeta(res.meta);
          setErrorMessage('');
        }
      } catch (err) {
        console.error('Lỗi khi tải lịch sử đặt vé:', err);
        if (!ignore) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Không thể tải lịch sử đặt vé. Vui lòng thử lại.',
          );
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void fetchBookings();
    return () => {
      ignore = true;
    };
  }, [
    isHydrated,
    accessToken,
    router,
    executeWithAuth,
    activeQuery.page,
    activeQuery.pageSize,
    activeQuery.code,
    activeQuery.date,
    activeQuery.route,
    activeQuery.status,
    retryKey,
  ]);

  const viewState = resolveCustomerActivityViewState(
    isLoading,
    errorMessage,
    bookings.length,
  );

  const handleRetry = () => {
    setIsLoading(true);
    setErrorMessage('');
    setRetryKey((current) => current + 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setActiveQuery((prev) => ({
      ...prev,
      code: codeFilter.trim(),
      date: dateFilter,
      route: routeFilter.trim(),
      status: statusFilter,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > meta.totalPages) return;
    setIsLoading(true);
    setActiveQuery((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    setIsLoading(true);
    setActiveQuery((prev) => ({ ...prev, pageSize: newSize, page: 1 }));
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] py-8 md:py-12 overflow-x-hidden">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6 w-full">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-[280px] shrink-0">
            <ProfileSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 sm:p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900">
                    Lịch sử mua vé
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Theo dõi và quản lý quá trình lịch sử mua vé của bạn
                  </p>
                </div>
                <Link
                  href="/"
                  className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-full text-sm font-black shadow-sm transition-colors shrink-0"
                >
                  Đặt vé
                </Link>
              </div>

              {/* Filters */}
              <form
                onSubmit={handleSearch}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.2fr_1fr_auto] gap-3 sm:gap-4 mb-6"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mã vé
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập Mã vé"
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Thời gian
                  </label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full text-sm px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent text-slate-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tuyến đường
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập tuyến đường"
                    value={routeFilter}
                    onChange={(e) => setRouteFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Trạng thái
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent bg-white text-slate-500 transition-colors"
                  >
                    <option value="">Tất cả</option>
                    <option value="DA_THANH_TOAN">Đã thanh toán</option>
                    <option value="CHO_THANH_TOAN">Chờ thanh toán</option>
                    <option value="DA_HUY">Đã hủy</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full lg:w-auto px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors h-[38px]"
                  >
                    Tìm
                  </button>
                </div>
              </form>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full min-w-[620px] text-sm text-center">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        Mã vé
                      </th>
                      <th className="px-2 sm:px-3 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Số vé
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Tuyến đường
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Ngày đi
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Số tiền
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Thanh toán
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewState === 'loading' ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-500 font-medium whitespace-nowrap"
                        >
                          Đang tải lịch sử đặt vé...
                        </td>
                      </tr>
                    ) : viewState === 'error' ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center">
                          <p className="font-medium text-red-600">
                            {errorMessage}
                          </p>
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="mt-3 rounded-full border border-red-200 px-5 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-50"
                          >
                            Thử lại
                          </button>
                        </td>
                      </tr>
                    ) : viewState === 'empty' ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-slate-500 font-medium whitespace-nowrap"
                        >
                          Chưa có lịch sử đặt vé nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((row, idx) => (
                        <tr
                          key={row.bookingId}
                          className={
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFBEB]'
                          }
                        >
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-bold text-accent whitespace-nowrap">
                            {row.bookingCode}
                          </td>
                          <td className="px-2 sm:px-3 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                            {row.ticketCount}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                            {row.route || 'Đang cập nhật'}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                            {formatDeparture(row.departureTime)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold text-slate-800 border-l border-slate-100 whitespace-nowrap">
                            {formatPrice(row.totalAmount)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium border-l border-slate-100 whitespace-nowrap">
                            {renderStatusBadge(row.paymentStatus || row.status)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <select
                    value={activeQuery.pageSize}
                    onChange={handlePageSizeChange}
                    className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  Tổng số: {meta.totalItems}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handlePageChange(meta.page - 1)}
                    disabled={meta.page <= 1}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: meta.totalPages || 1 }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === meta.totalPages ||
                        Math.abs(p - meta.page) <= 1,
                    )
                    .map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center border rounded font-bold transition-colors ${
                          meta.page === pageNum
                            ? 'border-accent bg-accent text-white'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => handlePageChange(meta.page + 1)}
                    disabled={meta.page >= meta.totalPages}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
