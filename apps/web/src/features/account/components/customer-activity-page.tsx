'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ticket } from 'lucide-react';
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

  // Tab states: 'upcoming' | 'history' | 'all'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'all'>('upcoming');
  const [hasInitializedTab, setHasInitializedTab] = useState(false);

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
      } catch (err: unknown) {
        const isAuthError =
          (err && typeof err === 'object' && 'status' in err && (err as { status?: number }).status === 401) ||
          (err instanceof Error &&
            (err.message.includes('Refresh token') ||
              err.message.includes('Chưa đăng nhập') ||
              err.message.includes('hết hạn')));

        if (isAuthError) {
          router.replace('/auth/login?next=/account/tickets');
          return;
        }

        if (!ignore) {
          console.warn('Lỗi khi tải danh sách vé:', err);
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách vé. Vui lòng thử lại.',
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

  // Phân loại chuyến xe sắp đi và lịch sử chuyến đi
  const isUpcoming = (b: BookingItem) => {
    if (b.status === 'DA_HUY' || b.paymentStatus === 'DA_HUY') return false;
    if (!b.departureTime) return true;
    try {
      const departure = new Date(b.departureTime);
      return departure.getTime() >= Date.now() - 2 * 60 * 60 * 1000;
    } catch {
      return true;
    }
  };

  const upcomingBookings = useMemo(() => bookings.filter(isUpcoming), [bookings]);
  const pastBookings = useMemo(() => bookings.filter((b) => !isUpcoming(b)), [bookings]);

  // Khởi tạo tab ban đầu một lần duy nhất nếu không có chuyến sắp đi nhưng có lịch sử
  useEffect(() => {
    if (!isLoading && bookings.length > 0 && !hasInitializedTab) {
      if (upcomingBookings.length === 0 && pastBookings.length > 0) {
        setActiveTab('history');
      }
      setHasInitializedTab(true);
    }
  }, [isLoading, bookings.length, upcomingBookings.length, pastBookings.length, hasInitializedTab]);

  const displayedBookings = useMemo(() => {
    if (activeTab === 'upcoming') return upcomingBookings;
    if (activeTab === 'history') return pastBookings;
    return bookings;
  }, [activeTab, upcomingBookings, pastBookings, bookings]);

  const viewState = resolveCustomerActivityViewState(
    isLoading,
    errorMessage,
    displayedBookings.length,
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
    <div className="min-h-screen bg-[#F5F5F5] py-8 md:py-12 overflow-x-hidden font-sans">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 w-full">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-[280px] shrink-0">
            <ProfileSidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">
              {/* Header Title */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                    Vé của tôi
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    Theo dõi vé xe sắp đi và lịch sử mua vé của bạn
                  </p>
                </div>
                <Link
                  href="/"
                  className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-full text-sm font-black shadow-sm transition-colors shrink-0"
                >
                  Đặt vé mới
                </Link>
              </div>

              {/* 2 Tabs: Chuyến sắp đi vs Lịch sử mua vé */}
              <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'upcoming'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Chuyến sắp đi</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'upcoming'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {upcomingBookings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'history'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Lịch sử mua vé</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'history'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {pastBookings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'all'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Tất cả</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === 'all'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {bookings.length}
                  </span>
                </button>
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
                    className="w-full lg:w-auto px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors h-[38px] cursor-pointer"
                  >
                    Tìm
                  </button>
                </div>
              </form>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[700px] text-sm text-center">
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
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewState === 'loading' ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-slate-500 font-medium whitespace-nowrap"
                        >
                          <div className="w-7 h-7 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          Đang tải danh sách vé...
                        </td>
                      </tr>
                    ) : viewState === 'error' ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <p className="font-medium text-red-600">
                            {errorMessage}
                          </p>
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="mt-3 rounded-full border border-red-200 px-5 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 cursor-pointer"
                          >
                            Thử lại
                          </button>
                        </td>
                      </tr>
                    ) : viewState === 'empty' ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-14 text-center"
                        >
                          <div className="max-w-md mx-auto">
                            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                              <Ticket className="w-7 h-7" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1.5">
                              {activeTab === 'upcoming'
                                ? 'Hiện tại bạn chưa có chuyến xe nào sắp đi'
                                : activeTab === 'history'
                                  ? 'Chưa có lịch sử chuyến đi nào'
                                  : 'Chưa có vé xe nào phù hợp'}
                            </h3>
                            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                              {activeTab === 'upcoming'
                                ? 'Các vé xe bạn mới đặt và chuẩn bị khởi hành sẽ hiển thị tại đây để bạn tiện lấy mã QR lên xe.'
                                : 'Các chuyến xe đã đi hoặc đã hủy của bạn sẽ được lưu trữ tại đây.'}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                              {activeTab === 'upcoming' ? (
                                <>
                                  <Link
                                    href="/"
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-black hover:bg-accent-hover transition-colors shadow-2xs"
                                  >
                                    <span>Tìm chuyến & Đặt vé ngay</span>
                                  </Link>
                                  {pastBookings.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('history')}
                                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <span>Xem lịch sử mua vé ({pastBookings.length})</span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <Link
                                  href="/"
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-black hover:bg-accent-hover transition-colors shadow-2xs"
                                >
                                  <span>Đặt vé mới</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedBookings.map((row, idx) => (
                        <tr
                          key={row.bookingId}
                          className={
                            idx % 2 === 0
                              ? 'bg-white hover:bg-slate-50/70 transition-colors'
                              : 'bg-[#FFFBEB] hover:bg-amber-50/80 transition-colors'
                          }
                        >
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-bold text-accent whitespace-nowrap">
                            <Link
                              href={`/invoice/${row.bookingId}`}
                              className="hover:underline flex items-center justify-center gap-1"
                              title="Bấm để xem chi tiết vé điện tử"
                            >
                              {row.bookingCode}
                            </Link>
                          </td>
                          <td className="px-2 sm:px-3 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                            <span className="font-bold">{row.ticketCount}</span>
                            {row.seatNumbers && row.seatNumbers.length > 0 && (
                              <span className="text-[11px] text-slate-500 block">
                                Ghế: {row.seatNumbers.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap text-left sm:text-center">
                            <span className="font-bold text-slate-900 block">
                              {row.route || 'Đang cập nhật'}
                            </span>
                            {row.busCompanyName && (
                              <span className="text-[11px] text-slate-500 block">
                                {row.busCompanyName}
                              </span>
                            )}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                            {formatDeparture(row.departureTime)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-bold text-slate-900 border-l border-slate-100 whitespace-nowrap">
                            {formatPrice(row.totalAmount)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium border-l border-slate-100 whitespace-nowrap">
                            {renderStatusBadge(row.paymentStatus || row.status)}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 border-l border-slate-100 whitespace-nowrap">
                            <Link
                              href={`/invoice/${row.bookingId}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                              title="Mở cuống vé điện tử"
                            >
                              <Ticket className="w-3.5 h-3.5 text-amber-400" />
                              <span>Xem vé</span>
                            </Link>
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
