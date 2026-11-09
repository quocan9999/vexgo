'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ticket, Star, QrCode, Clock, Trash2, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ProfileSidebar } from '@/features/account/components/profile-sidebar';
import { useAuthSession } from '@/features/auth/auth-session';
import {
  bookingsApi,
  type BookingItem,
  type PaginationMeta,
} from '@/features/account/services/bookings.api';
import {
  createPaymentDraftFromBooking,
  getLatestActivePaymentDraft,
  markPaymentDraftsTerminalByOrder,
} from '@/features/booking/services/payment-draft';
import { ReviewDialog } from '@/features/tickets/components/review-dialog';
import {
  MyReviewModal,
  type MyReviewData,
} from '@/features/tickets/components/my-review-modal';
import { reviewsApi } from '@/features/tickets/services/reviews.api';
import { resolveCustomerActivityViewState } from '@/features/account/services/customer-activity-view-state';

function canResumeBookingPayment(row: BookingItem, nowMs: number = Date.now()): boolean {
  if (
    row.status !== 'CHO_THANH_TOAN' ||
    (row.paymentStatus && row.paymentStatus !== 'CHO_THANH_TOAN')
  ) {
    return false;
  }
  if (!row.paymentExpiresAt) return true;
  const expiresMs = Date.parse(row.paymentExpiresAt);
  return !Number.isFinite(expiresMs) || expiresMs > nowMs;
}

function formatCountdown(expiresAtIso: string | undefined, nowMs: number): string | null {
  if (!expiresAtIso) return null;
  const expiresMs = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresMs)) return null;
  const remainingSec = Math.max(0, Math.ceil((expiresMs - nowMs) / 1000));
  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

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

function formatPrice(amount: number, locale: string = 'vi'): string {
  if (locale === 'en') {
    return `${new Intl.NumberFormat('en-US').format(amount)} VND`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

function renderStatusBadge(status: string | null, t: (key: any) => string) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'DA_THANH_TOAN' || s === 'THANH_CONG' || s === 'HOAN_TAT') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap">
        {t('statusPaid')}
      </span>
    );
  }
  if (s === 'HOAN_TIEN') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 whitespace-nowrap">
        {t('statusRefunded')}
      </span>
    );
  }
  if (s === 'CHO_THANH_TOAN' || s === 'CHO_XU_LY') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
        {t('statusPending')}
      </span>
    );
  }
  if (s === 'DA_HUY' || s === 'HUY' || s === 'THAT_BAI') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
        {t('statusCancelled')}
      </span>
    );
  }
  if (s === 'HET_HAN' || s === 'EXPIRED') {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 whitespace-nowrap">
        {t('statusExpired')}
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
  const t = useTranslations('account.tickets');
  const locale = useLocale();
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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history' | 'all'>(
    'upcoming',
  );
  const [hasInitializedTab, setHasInitializedTab] = useState(false);
  const [referenceTime] = useState(() => Date.now());

  // Booking filter states
  const [codeFilter, setCodeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Applied query params for bookings
  const [activeQuery, setActiveQuery] = useState({
    code: '',
    date: '',
    route: '',
    status: '',
    page: 1,
    pageSize: 10,
  });

  // Trip Review Dialog state
  const [reviewTarget, setReviewTarget] = useState<{
    tripId: number;
    route: string;
    date: string;
    busBrand: string;
  } | null>(null);
  const [reviewedTripIds, setReviewedTripIds] = useState<number[]>([]);
  const [customerReviews, setCustomerReviews] = useState<
    Record<number, MyReviewData>
  >({});
  const [viewingReview, setViewingReview] = useState<MyReviewData | null>(null);
  const [deleteConfirmTripId, setDeleteConfirmTripId] = useState<number | null>(
    null,
  );
  const [isDeletingReview, setIsDeletingReview] = useState(false);

  const handleConfirmDeleteReview = async () => {
    if (!deleteConfirmTripId || !executeWithAuth) return;
    setIsDeletingReview(true);
    try {
      await executeWithAuth((token) =>
        reviewsApi.deleteTripReview(token, deleteConfirmTripId),
      );
      setReviewedTripIds((prev) =>
        prev.filter((id) => id !== deleteConfirmTripId),
      );
      setDeleteConfirmTripId(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xóa đánh giá.';
      alert(msg);
    } finally {
      setIsDeletingReview(false);
    }
  };

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('tab') === 'shipments'
    ) {
      router.replace('/account/shipments');
      return;
    }

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

          executeWithAuth((token) => reviewsApi.getMyReviews(token))
            .then((revRes) => {
              if (!ignore && revRes?.data?.reviews) {
                const ids = revRes.data.reviews
                  .map((r) => r.tripId)
                  .filter(Boolean);
                setReviewedTripIds(ids);

                const revMap: Record<number, MyReviewData> = {};
                revRes.data.reviews.forEach((r) => {
                  if (r.tripId) {
                    revMap[r.tripId] = {
                      id: r.id,
                      tripId: r.tripId,
                      rating: r.rating,
                      comment: r.comment,
                      createdAt: r.createdAt,
                      routeName: r.routeName ?? undefined,
                      date: r.tripDate ?? undefined,
                      reply: r.reply || null,
                    };
                  }
                });
                setCustomerReviews(revMap);
              }
            })
            .catch(() => {});

          if (!hasInitializedTab) {
            const hasUpcoming = res.data.some((b) => {
              if (
                ['DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(b.status) ||
                ['DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(
                  b.paymentStatus ?? '',
                )
              ) {
                return false;
              }
              if (!b.departureTime) return true;
              try {
                return (
                  new Date(b.departureTime).getTime() >=
                  referenceTime - 2 * 60 * 60 * 1000
                );
              } catch {
                return true;
              }
            });
            if (!hasUpcoming && res.data.length > 0) {
              setActiveTab('history');
            }
            setHasInitializedTab(true);
          }
        }
      } catch (err: unknown) {
        const isAuthError =
          (err &&
            typeof err === 'object' &&
            'status' in err &&
            (err as { status?: number }).status === 401) ||
          (err instanceof Error &&
            (err.message.includes('Refresh token') ||
              err.message.includes('Chưa đăng nhập') ||
              err.message.includes('hết hạn')));

        if (isAuthError) {
          router.replace('/auth/login?next=/account/tickets');
          return;
        }
        if (!ignore) {
          setBookings([]);
          setErrorMessage(
            err instanceof Error && err.message.trim()
              ? err.message
              : 'Không thể tải danh sách vé. Vui lòng thử lại.',
          );
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    };

    void fetchBookings();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    isHydrated,
    activeQuery,
    retryKey,
    router,
    executeWithAuth,
    hasInitializedTab,
    referenceTime,
  ]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasAnyPendingBooking = useMemo(
    () => bookings.some((b) => b.status === 'CHO_THANH_TOAN'),
    [bookings],
  );

  useEffect(() => {
    if (!hasAnyPendingBooking) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasAnyPendingBooking]);

  const pendingPaymentBookings = useMemo(
    () => bookings.filter((b) => canResumeBookingPayment(b, nowMs)),
    [bookings, nowMs],
  );

  useEffect(() => {
    for (const b of bookings) {
      if (!canResumeBookingPayment(b, nowMs)) {
        markPaymentDraftsTerminalByOrder(
          {
            bookingId: b.bookingId,
            orderId: b.orderId,
            orderCode: b.orderCode,
          },
          b.status === 'DA_THANH_TOAN' || b.paymentStatus === 'DA_THANH_TOAN'
            ? 'paid'
            : 'cancelled',
        );
      }
    }
    if (
      pendingPaymentBookings.length > 0 &&
      !getLatestActivePaymentDraft(nowMs)
    ) {
      createPaymentDraftFromBooking(pendingPaymentBookings[0]);
    }
  }, [bookings, pendingPaymentBookings, nowMs]);

  const isUpcoming = useCallback(
    (b: BookingItem) => {
      if (
        ['DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(b.status) ||
        ['DA_HUY', 'HUY', 'HET_HAN', 'EXPIRED'].includes(b.paymentStatus ?? '')
      ) {
        return false;
      }
      if (
        b.status === 'CHO_THANH_TOAN' &&
        !canResumeBookingPayment(b, nowMs)
      ) {
        return false;
      }
      if (!b.departureTime) return true;
      try {
        return (
          new Date(b.departureTime).getTime() >=
          referenceTime - 2 * 60 * 60 * 1000
        );
      } catch {
        return true;
      }
    },
    [referenceTime, nowMs],
  );

  const upcomingBookings = useMemo(
    () => bookings.filter((b) => isUpcoming(b)),
    [bookings, isUpcoming],
  );
  const pastBookings = useMemo(
    () => bookings.filter((b) => !isUpcoming(b)),
    [bookings, isUpcoming],
  );

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
                    {t('pageTitle')}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">
                    {t('pageSubtitle')}
                  </p>
                </div>
                <Link
                  href={`/${locale}`}
                  className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-full text-sm font-black shadow-sm transition-colors shrink-0"
                >
                  {t('bookNew')}
                </Link>
              </div>

              {/* Banner nhắc đơn đặt vé chờ thanh toán */}
              {pendingPaymentBookings.length > 0 && (
                <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-amber-950 text-sm">
                        {t('pendingBannerTitle', { count: pendingPaymentBookings.length })}
                      </h3>
                      <p className="text-[12px] text-amber-800">
                        {t('pendingBannerDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-amber-200/80 border-t border-amber-200/80 pt-2">
                    {pendingPaymentBookings.map((target) => {
                      const countdownStr = formatCountdown(
                        target.paymentExpiresAt,
                        nowMs,
                      );
                      return (
                        <div
                          key={target.bookingId}
                          className="pt-2.5 pb-2.5 first:pt-1 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="text-xs sm:text-sm">
                            <div className="font-bold text-amber-950 flex flex-wrap items-center gap-2">
                              <span>
                                {t('bookingCode')} <strong>{target.bookingCode}</strong>
                              </span>
                              {countdownStr && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-200/80 text-amber-900">
                                  {t('expiresIn')} {countdownStr}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-amber-800 mt-1">
                              {target.route || t('tripRoute')}
                              {target.seatNumbers?.length
                                ? ` · ${t('seats')}: ${target.seatNumbers.join(', ')}`
                                : ''}
                              {' — '}{t('totalPrice')}:{' '}
                              <strong>{formatPrice(target.totalAmount, locale)}</strong>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const draft = createPaymentDraftFromBooking(target);
                              if (draft) {
                                router.push(
                                  `/${locale}/payment?draftId=${encodeURIComponent(draft.id)}`,
                                );
                              } else {
                                router.push(`/${locale}/invoice/${target.bookingId}`);
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-extrabold transition-colors shadow-sm cursor-pointer shrink-0"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{t('continuePayment')}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabs: Chuyến sắp đi | Lịch sử mua vé | Tất cả vé */}
              <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'upcoming'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t('tabUpcoming')}</span>
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
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'history'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t('tabPast')}</span>
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
                  className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'border-accent text-accent'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t('tabAll')}</span>
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

              {/* Bookings Filters */}
              <form
                onSubmit={handleSearch}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.1fr_1.2fr_1fr_auto] gap-3 sm:gap-4 mb-6"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('ticketCode')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('filterCode')}
                    value={codeFilter}
                    onChange={(e) => setCodeFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('time')}
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
                    {t('route')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('filterRoute')}
                    value={routeFilter}
                    onChange={(e) => setRouteFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('status')}
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent bg-white text-slate-500 transition-colors"
                  >
                    <option value="">{t('allStatuses')}</option>
                    <option value="DA_THANH_TOAN">{t('statusPaid')}</option>
                    <option value="CHO_THANH_TOAN">{t('statusPending')}</option>
                    <option value="DA_HUY">{t('statusCancelled')}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full lg:w-auto px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors h-[38px] cursor-pointer"
                  >
                    {t('filterButton')}
                  </button>
                </div>
              </form>

              {/* Bookings Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[700px] text-sm text-center">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {t('ticketCode')}
                      </th>
                      <th className="px-2 sm:px-3 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('ticketCount')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('route')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('date')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('totalPrice')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('payment')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('actions')}
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
                          {t('loadingTickets')}
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
                            {t('retry')}
                          </button>
                        </td>
                      </tr>
                    ) : viewState === 'empty' ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-14 text-center">
                          <div className="max-w-md mx-auto">
                            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                              <Ticket className="w-7 h-7" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1.5">
                              {t('emptyTitle')}
                            </h3>
                            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                              {t('emptyDesc')}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                              {activeTab === 'upcoming' ? (
                                <>
                                  <Link
                                    href={`/${locale}`}
                                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-black hover:bg-accent-hover transition-colors shadow-2xs"
                                  >
                                    <span>{t('findTripsNow')}</span>
                                  </Link>
                                  {pastBookings.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setActiveTab('history')}
                                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <span>
                                        {t('viewPurchaseHistory', { count: pastBookings.length })}
                                      </span>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <Link
                                  href={`/${locale}`}
                                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-black hover:bg-accent-hover transition-colors shadow-2xs"
                                >
                                  <span>{t('bookNew')}</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedBookings.map((row, idx) => {
                        const canPay = canResumeBookingPayment(row, nowMs);
                        const effectiveBadgeStatus =
                          row.status === 'CHO_THANH_TOAN' && !canPay
                            ? 'HET_HAN'
                            : row.paymentStatus || row.status;
                        const canReview =
                          !isUpcoming(row) &&
                          Boolean(row.tripId) &&
                          (row.paymentStatus === 'DA_THANH_TOAN' ||
                            row.paymentStatus === 'THANH_CONG' ||
                            row.status === 'DA_THANH_TOAN' ||
                            row.status === 'HOAN_TAT');
                        const isReviewed =
                          row.tripId != null &&
                          reviewedTripIds.includes(row.tripId);
                        const departureMs = row.departureTime
                          ? Date.parse(row.departureTime)
                          : 0;
                        const isWithin7Days =
                          departureMs > 0
                            ? nowMs - departureMs <= 7 * 24 * 60 * 60 * 1000
                            : true;

                        return (
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
                                href={`/${locale}/invoice/${row.bookingId}`}
                                className="hover:underline flex items-center justify-center gap-1"
                                title={t('viewTicket')}
                              >
                                {row.bookingCode}
                              </Link>
                            </td>
                            <td className="px-2 sm:px-3 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                              <span className="font-bold">
                                {row.ticketCount}
                              </span>
                              {row.seatNumbers &&
                                row.seatNumbers.length > 0 && (
                                  <span className="text-[11px] text-slate-500 block">
                                    {t('seats')}: {row.seatNumbers.join(', ')}
                                  </span>
                                )}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap text-left sm:text-center">
                              <span className="font-bold text-slate-900 block">
                                {row.route || '...'}
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
                              {formatPrice(row.totalAmount, locale)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium border-l border-slate-100 whitespace-nowrap">
                              {renderStatusBadge(effectiveBadgeStatus, t)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 border-l border-slate-100 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {canPay && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const draft =
                                        createPaymentDraftFromBooking(row);
                                      if (draft) {
                                        router.push(
                                          `/${locale}/payment?draftId=${encodeURIComponent(draft.id)}`,
                                        );
                                      } else {
                                        router.push(
                                          `/${locale}/invoice/${row.bookingId}`,
                                        );
                                      }
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                    title={t('continuePayment')}
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>{t('payNow')}</span>
                                  </button>
                                )}
                                <Link
                                  href={`/${locale}/invoice/${row.bookingId}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                  title={t('viewTicket')}
                                >
                                  <Ticket className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{t('viewTicket')}</span>
                                </Link>

                                {canReview &&
                                  (isReviewed ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const existing =
                                            customerReviews[row.tripId!];
                                          setViewingReview({
                                            id: existing?.id,
                                            tripId: row.tripId!,
                                            rating: existing?.rating || 5,
                                            comment: existing?.comment ?? null,
                                            createdAt: existing?.createdAt,
                                            isEdited: existing?.isEdited,
                                            isEditable: existing?.isEditable,
                                            routeName:
                                              row.route ||
                                              existing?.routeName ||
                                              'Chuyến xe đã đi',
                                            busBrand:
                                              row.busCompanyName || 'Nhà xe',
                                            date: formatDeparture(
                                              row.departureTime,
                                            ),
                                            reply: existing?.reply ?? null,
                                          });
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                                        title={t('viewReview')}
                                      >
                                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                        <span>
                                          {t('viewReview')}
                                          {customerReviews[row.tripId!]?.rating
                                            ? ` (${customerReviews[row.tripId!].rating}★)`
                                            : ''}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDeleteConfirmTripId(row.tripId!)
                                        }
                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shadow-2xs"
                                        title="Xóa đánh giá này để gửi lại"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : isWithin7Days ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReviewTarget({
                                          tripId: row.tripId!,
                                          route:
                                            row.route || 'Chuyến xe đã đi',
                                          date: formatDeparture(
                                            row.departureTime,
                                          ),
                                          busBrand:
                                            row.busCompanyName || 'Nhà xe',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-900 text-xs font-extrabold transition-colors shadow-2xs cursor-pointer"
                                      title={t('reviewTrip')}
                                    >
                                      <Star className="w-3.5 h-3.5 fill-slate-900 text-slate-900" />
                                      <span>{t('reviewTrip')}</span>
                                    </button>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-400 text-[11px] font-medium"
                                    >
                                      {t('reviewExpired')}
                                    </span>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
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
                  {t('totalTickets', { total: meta.totalItems })}
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
                  {Array.from(
                    { length: meta.totalPages || 1 },
                    (_, i) => i + 1,
                  )
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

      {/* Modal Đánh giá chuyến đi */}
      <ReviewDialog
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        tripId={reviewTarget?.tripId}
        tripInfo={
          reviewTarget
            ? {
                route: reviewTarget.route,
                date: reviewTarget.date,
                busBrand: reviewTarget.busBrand,
              }
            : undefined
        }
        onSuccess={() => {
          if (reviewTarget?.tripId) {
            setReviewedTripIds((prev) =>
              prev.includes(reviewTarget.tripId)
                ? prev
                : [...prev, reviewTarget.tripId],
            );
            executeWithAuth((token) => reviewsApi.getMyReviews(token))
              .then((revRes) => {
                if (revRes?.data?.reviews) {
                  const revMap: Record<number, MyReviewData> = {};
                  revRes.data.reviews.forEach((r) => {
                    if (r.tripId) {
                      revMap[r.tripId] = {
                        id: r.id,
                        tripId: r.tripId,
                        rating: r.rating,
                        comment: r.comment,
                        createdAt: r.createdAt,
                        routeName: r.routeName ?? undefined,
                        date: r.tripDate ?? undefined,
                        reply: r.reply || null,
                      };
                    }
                  });
                  setCustomerReviews(revMap);
                }
              })
              .catch(() => {});
          }
        }}
      />

      {/* Modal Xem lại & Chỉnh sửa / Xóa đánh giá */}
      <MyReviewModal
        isOpen={Boolean(viewingReview)}
        onClose={() => setViewingReview(null)}
        review={viewingReview}
        onUpdated={(updated) => {
          setCustomerReviews((prev) => ({
            ...prev,
            [updated.tripId]: {
              ...prev[updated.tripId],
              rating: updated.rating,
              comment: updated.comment,
            },
          }));
          if (viewingReview && viewingReview.tripId === updated.tripId) {
            setViewingReview((prev) =>
              prev
                ? {
                    ...prev,
                    rating: updated.rating,
                    comment: updated.comment,
                  }
                : null,
            );
          }
        }}
        onDeleted={(tripId) => {
          setReviewedTripIds((prev) => prev.filter((id) => id !== tripId));
          setCustomerReviews((prev) => {
            const next = { ...prev };
            delete next[tripId];
            return next;
          });
          setViewingReview(null);
        }}
      />

      {/* Modal xác nhận xóa đánh giá */}
      {deleteConfirmTripId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {t('deleteReview')}
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {t('deleteReviewConfirm')}
            </p>
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirmTripId(null)}
                disabled={isDeletingReview}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t('cancelFilter') || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteReview}
                disabled={isDeletingReview}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingReview ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('loading')}</span>
                  </>
                ) : (
                  <span>{t('deleteReview')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
