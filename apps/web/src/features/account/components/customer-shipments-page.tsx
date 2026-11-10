'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@/lib/format';
import {
  Package,
  X,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { ProfileSidebar } from '@/features/account/components/profile-sidebar';
import { useAuthSession } from '@/features/auth/auth-session';
import type { PaginationMeta } from '@/features/account/services/bookings.api';
import {
  shipmentsApi,
  type CustomerShipmentListItem,
  type ShipmentResponseData,
} from '@/features/shipments/services/shipments.api';

function formatShortWaybillCode(code: string): string {
  if (!code || code.length <= 22) return code;
  return `${code.slice(0, 13)}...${code.slice(-6)}`;
}

function formatCategoryDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

function formatTimelineNote(note: string | null | undefined, t: (key: string) => string): string {
  if (!note) return '';
  if (note.trim() === 'Tạo phiếu gửi hàng độc lập') {
    return t('statusNew');
  }
  return note;
}

function formatDeparture(isoString: string | null, locale = 'vi') {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${hh}:${min} - ${dd}/${mm}/${yyyy}`;
  } catch {
    return isoString;
  }
}

function formatPrice(amount: string | number) {
  const num = Number(amount);
  if (isNaN(num)) return String(amount);
  return `${num.toLocaleString('vi-VN')} đ`;
}

function formatPaymentStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case 'DA_THANH_TOAN':
    case 'THANH_CONG':
      return t('paymentPaid');
    case 'CHO_THANH_TOAN':
      return t('paymentPending');
    case 'DA_HUY':
      return t('paymentCancelled');
    default:
      return status;
  }
}

function renderPaymentStatusBadge(status: string, t: (key: string) => string) {
  const label = formatPaymentStatusLabel(status, t);
  if (status === 'DA_THANH_TOAN' || status === 'THANH_CONG') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        {label}
      </span>
    );
  }
  if (status === 'DA_HUY') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
      {label}
    </span>
  );
}

function formatShipmentStatusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case 'MOI_TAO':
      return t('statusNew');
    case 'DA_TIEP_NHAN':
      return t('statusReceived');
    case 'DANG_VAN_CHUYEN':
      return t('statusInTransit');
    case 'DA_DEN_DIEM_NHAN':
      return t('statusArrived');
    case 'DA_GIAO':
      return t('statusDelivered');
    case 'DA_HUY':
      return t('statusCancelled');
    default:
      return status;
  }
}

function renderShipmentStatusBadge(status: string, t: (key: string) => string) {
  if (status === 'DA_GIAO') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 whitespace-nowrap">
        {formatShipmentStatusLabel(status, t)}
      </span>
    );
  }
  if (status === 'DA_HUY') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 whitespace-nowrap">
        {formatShipmentStatusLabel(status, t)}
      </span>
    );
  }
  if (status === 'DANG_VAN_CHUYEN' || status === 'DA_DEN_DIEM_NHAN') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700 whitespace-nowrap">
        {formatShipmentStatusLabel(status, t)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap">
      {formatShipmentStatusLabel(status, t)}
    </span>
  );
}

export default function CustomerShipmentsPage() {
  const router = useRouter();
  const t = useTranslations('shipments');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { accessToken, isHydrated, executeWithAuth } = useAuthSession();

  const [shipments, setShipments] = useState<CustomerShipmentListItem[]>([]);
  const [shipmentsMeta, setShipmentsMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });
  const [isLoadingShipments, setIsLoadingShipments] = useState(true);
  const [shipmentsError, setShipmentsError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  const [shipmentSearchFilter, setShipmentSearchFilter] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('');
  const [activeShipmentQuery, setActiveShipmentQuery] = useState({
    search: '',
    status: '',
    page: 1,
    pageSize: 10,
  });

  // Shipment Detail Modal state
  const [selectedShipmentDetail, setSelectedShipmentDetail] =
    useState<ShipmentResponseData | null>(null);
  const [isLoadingShipmentDetail, setIsLoadingShipmentDetail] = useState(false);
  const [shipmentDetailError, setShipmentDetailError] = useState('');
  const [copiedWaybillCode, setCopiedWaybillCode] = useState<string | null>(
    null,
  );
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState(
    'Đặt nhầm thông tin người gửi/nhận',
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const handleCopyWaybill = useCallback(
    (code: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        void navigator.clipboard.writeText(code);
        setCopiedWaybillCode(code);
        setTimeout(() => {
          setCopiedWaybillCode((prev) => (prev === code ? null : prev));
        }, 2000);
      }
    },
    [],
  );

  useEffect(() => {
    let ignore = false;
    if (!isHydrated) return;
    if (!accessToken) {
      router.replace('/auth/login?next=/account/shipments');
      return;
    }

    const fetchShipments = async () => {
      setIsLoadingShipments(true);
      setShipmentsError('');
      try {
        const res = await executeWithAuth((token) =>
          shipmentsApi.getCustomerShipments(token, {
            page: activeShipmentQuery.page,
            pageSize: activeShipmentQuery.pageSize,
            search: activeShipmentQuery.search || undefined,
            status: activeShipmentQuery.status || undefined,
          }),
        );
        if (!ignore && res) {
          setShipments(res.data || []);
          setShipmentsMeta(
            res.meta || {
              page: 1,
              pageSize: 10,
              totalItems: (res.data || []).length,
              totalPages: 1,
            },
          );
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
          router.replace('/auth/login?next=/account/shipments');
          return;
        }
        if (!ignore) {
          setShipments([]);
          setShipmentsError(
            err instanceof Error && err.message.trim()
              ? err.message
              : t('cannotLoadShipments'),
          );
        }
      } finally {
        if (!ignore) setIsLoadingShipments(false);
      }
    };

    void fetchShipments();

    return () => {
      ignore = true;
    };
  }, [
    accessToken,
    isHydrated,
    activeShipmentQuery,
    retryKey,
    router,
    executeWithAuth,
  ]);

  const handleOpenShipmentDetail = useCallback(
    async (shipmentId: number) => {
      setIsLoadingShipmentDetail(true);
      setShipmentDetailError('');
      setSelectedShipmentDetail(null);
      setShowCancelConfirm(false);
      setCancelError('');
      try {
        const res = await executeWithAuth((token) =>
          shipmentsApi.getShipmentDetail(shipmentId, token),
        );
        if (res?.data) {
          setSelectedShipmentDetail(res.data);
        }
      } catch (err: unknown) {
        setShipmentDetailError(
          err instanceof Error && err.message.trim()
            ? err.message
            : t('cannotLoadShipmentDetail'),
        );
      } finally {
        setIsLoadingShipmentDetail(false);
      }
    },
    [executeWithAuth],
  );

  const handleCancelShipment = async () => {
    if (!selectedShipmentDetail) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      const res = await executeWithAuth((token) =>
        shipmentsApi.cancelShipment(
          {
            waybillCode: selectedShipmentDetail.waybillCode,
            phoneNumber: selectedShipmentDetail.sender.phoneNumber,
            reason: cancelReason,
          },
          token,
        ),
      );
      if (res?.data) {
        setSelectedShipmentDetail((prev) =>
          prev
            ? {
                ...prev,
                status: 'DA_HUY',
                paymentStatus: 'DA_HUY',
                timeline: [
                  ...(prev.timeline || []),
                  {
                    id: Date.now(),
                    status: 'DA_HUY',
                    time: res.data.updatedAt,
                    note: cancelReason,
                  },
                ],
              }
            : prev,
        );
        setShipments((prev) =>
          prev.map((item) =>
            item.waybillCode === selectedShipmentDetail.waybillCode
              ? { ...item, status: 'DA_HUY', paymentStatus: 'DA_HUY' }
              : item,
          ),
        );
        setShowCancelConfirm(false);
      }
    } catch (err: unknown) {
      setCancelError(
        err instanceof Error && err.message.trim()
          ? err.message
          : t('cannotCancelShipment'),
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = () => {
    setIsLoadingShipments(true);
    setShipmentsError('');
    setRetryKey((current) => current + 1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveShipmentQuery((prev) => ({
      ...prev,
      search: shipmentSearchFilter.trim(),
      status: shipmentStatusFilter,
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > shipmentsMeta.totalPages) return;
    setActiveShipmentQuery((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value);
    setActiveShipmentQuery((prev) => ({
      ...prev,
      pageSize: newSize,
      page: 1,
    }));
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
                    {t('pageDesc')}
                  </p>
                </div>
                <Link
                  href="/send-freight"
                  className="bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-full text-sm font-black shadow-sm transition-colors shrink-0"
                >
                  {t('newShipmentBtn')}
                </Link>
              </div>

              {/* Shipments Filter */}
              <form
                onSubmit={handleSearch}
                className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_auto] gap-3 sm:gap-4 mb-6"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('filterSearchLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('filterSearchPlaceholder')}
                    value={shipmentSearchFilter}
                    onChange={(e) => setShipmentSearchFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t('filterStatusLabel')}
                  </label>
                  <select
                    value={shipmentStatusFilter}
                    onChange={(e) => setShipmentStatusFilter(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent bg-white text-slate-600 transition-colors"
                  >
                    <option value="">{t('allStatuses')}</option>
                    <option value="MOI_TAO">{t('statusNew')}</option>
                    <option value="DA_TIEP_NHAN">{t('statusReceived')}</option>
                    <option value="DANG_VAN_CHUYEN">{t('statusInTransit')}</option>
                    <option value="DA_GIAO">{t('statusDelivered')}</option>
                    <option value="DA_HUY">{t('statusCancelled')}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors h-[38px] cursor-pointer"
                  >
                    {t('searchBtn')}
                  </button>
                </div>
              </form>

              {/* Shipments Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[860px] text-sm text-center">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                        {t('colWaybill')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colRoute')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colReceiver')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colCreated')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colTotalFee')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colStatus')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colPayment')}
                      </th>
                      <th className="px-3 sm:px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">
                        {t('colActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingShipments ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-10 text-center text-slate-500 font-medium whitespace-nowrap"
                        >
                          <div className="w-7 h-7 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          {t('loadingList')}
                        </td>
                      </tr>
                    ) : shipmentsError ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center">
                          <p className="font-medium text-red-600">
                            {shipmentsError}
                          </p>
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="mt-3 rounded-full border border-red-200 px-5 py-2 text-sm font-bold text-red-700 transition-colors hover:bg-red-50 cursor-pointer"
                          >
                            {tCommon('retry')}
                          </button>
                        </td>
                      </tr>
                    ) : shipments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-14 text-center">
                          <div className="max-w-md mx-auto">
                            <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                              <Package className="w-7 h-7" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1.5">
                              {t('emptyTitle')}
                            </h3>
                            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                              {t('emptyDesc')}
                            </p>
                            <Link
                              href="/send-freight"
                              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-black hover:bg-accent-hover transition-colors shadow-2xs"
                            >
                              <span>{t('createNow')}</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      shipments.map((item, idx) => {
                        const isCopied = copiedWaybillCode === item.waybillCode;
                        return (
                          <tr
                            key={item.shipmentId}
                            className={
                              idx % 2 === 0
                                ? 'bg-white hover:bg-slate-50/70 transition-colors'
                                : 'bg-[#FFFBEB] hover:bg-amber-50/80 transition-colors'
                            }
                          >
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-bold text-accent whitespace-nowrap">
                              <div className="inline-flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenShipmentDetail(item.shipmentId)
                                  }
                                  title={item.waybillCode}
                                  className="hover:underline cursor-pointer font-mono text-xs sm:text-sm"
                                >
                                  {formatShortWaybillCode(item.waybillCode)}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopyWaybill(item.waybillCode, e)
                                  }
                                  title={t('copyWaybillCode')}
                                  aria-label={t('copyWaybillCodeAria', { code: item.waybillCode })}
                                  className="p-1 rounded-md text-slate-400 hover:text-accent hover:bg-orange-50 transition-colors cursor-pointer"
                                >
                                  {isCopied ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              <span className="block text-[11px] font-normal text-slate-400">
                                {t('packagesCount', { count: item.itemsCount })}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                              <span className="font-bold text-slate-900 block">
                                {item.trip.route}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {item.trip.busCompany}
                                {!item.trip.tripId && (
                                  <span className="block">
                                    {t('unassignedTrip')}
                                  </span>
                                )}
                                {item.dropoffDeadline && (
                                  <span className="block">
                                    {t('dropoffDeadlinePrefix')}
                                    {new Date(
                                      item.dropoffDeadline,
                                    ).toLocaleString('vi-VN')}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                              <span className="font-bold text-slate-800 block">
                                {item.receiver.fullName}
                              </span>
                              <span className="text-[11px] text-slate-500 block">
                                {item.receiver.phoneNumber}
                              </span>
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-medium text-slate-700 border-l border-slate-100 whitespace-nowrap">
                              {formatDeparture(item.sentAt, locale)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 font-bold text-slate-900 border-l border-slate-100 whitespace-nowrap">
                              {formatCurrency(Number(item.totalFee), locale)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 border-l border-slate-100 whitespace-nowrap">
                              {renderShipmentStatusBadge(item.status, t)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 border-l border-slate-100 whitespace-nowrap">
                              {renderPaymentStatusBadge(item.paymentStatus, t)}
                            </td>
                            <td className="px-3 sm:px-4 py-3 sm:py-3.5 border-l border-slate-100 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenShipmentDetail(item.shipmentId)
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{t('detailBtn')}</span>
                                </button>
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
                    value={activeShipmentQuery.pageSize}
                    onChange={handlePageSizeChange}
                    className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {t('totalCount', { count: shipmentsMeta.totalItems })}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handlePageChange(shipmentsMeta.page - 1)}
                    disabled={shipmentsMeta.page <= 1}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    &lt;
                  </button>
                  {Array.from(
                    { length: shipmentsMeta.totalPages || 1 },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === shipmentsMeta.totalPages ||
                        Math.abs(p - shipmentsMeta.page) <= 1,
                    )
                    .map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 flex items-center justify-center border rounded font-bold transition-colors ${
                          shipmentsMeta.page === pageNum
                            ? 'border-accent bg-accent text-white'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => handlePageChange(shipmentsMeta.page + 1)}
                    disabled={shipmentsMeta.page >= shipmentsMeta.totalPages}
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

      {/* Modal Chi tiết vận đơn gửi hàng */}
      {(isLoadingShipmentDetail ||
        shipmentDetailError ||
        selectedShipmentDetail) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => {
            setSelectedShipmentDetail(null);
            setShipmentDetailError('');
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto shadow-2xl border border-slate-100 p-5 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="min-w-0 pr-3">
                <h3 className="text-lg font-black text-slate-900">
                  {t('modalDetailTitle')}
                </h3>
                {selectedShipmentDetail && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <p className="text-xs font-bold text-accent font-mono break-all">
                      {t('colWaybill')}: {selectedShipmentDetail.waybillCode}
                    </p>
                    <button
                      type="button"
                      onClick={(e) =>
                        handleCopyWaybill(selectedShipmentDetail.waybillCode, e)
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[11px] font-bold text-accent transition-colors cursor-pointer shrink-0"
                    >
                      {copiedWaybillCode ===
                      selectedShipmentDetail.waybillCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{t('copyCode')}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShipmentDetail(null);
                  setShipmentDetailError('');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingShipmentDetail ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <div className="w-7 h-7 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                {t('loadingDetail')}
              </div>
            ) : shipmentDetailError ? (
              <div className="py-8 text-center text-red-600 text-sm font-semibold">
                {shipmentDetailError}
              </div>
            ) : selectedShipmentDetail ? (
              <div className="space-y-4 text-sm">
                {/* Tuyến & Nhà xe */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-slate-900">
                      {selectedShipmentDetail.trip.route.origin} →{' '}
                      {selectedShipmentDetail.trip.route.destination}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t('busCompanyPrefix')}{selectedShipmentDetail.trip.busCompany.name}
                      <div>
                        {selectedShipmentDetail.trip.tripId
                          ? `${t('tripPrefix')}${selectedShipmentDetail.trip.code}`
                          : t('unassignedTrip')}
                      </div>
                      {selectedShipmentDetail.dropoffDeadline && (
                        <div>
                          {t('dropoffDeadlineLabel')}{' '}
                          {new Date(
                            selectedShipmentDetail.dropoffDeadline,
                          ).toLocaleString('vi-VN')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderShipmentStatusBadge(selectedShipmentDetail.status, t)}
                    {renderPaymentStatusBadge(
                      selectedShipmentDetail.paymentStatus,
                      t,
                    )}
                  </div>
                </div>

                {/* Điểm gửi & Điểm nhận */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{t('pickupStation')}</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {selectedShipmentDetail.pickupPoint.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedShipmentDetail.pickupPoint.address}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      {t('senderPrefix')}{' '}
                      <strong>{selectedShipmentDetail.sender.fullName}</strong>{' '}
                      ({selectedShipmentDetail.sender.phoneNumber})
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200">
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('dropoffStation')}</span>
                    </div>
                    <div className="font-bold text-slate-900">
                      {selectedShipmentDetail.dropoffPoint.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedShipmentDetail.dropoffPoint.address}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      {t('receiverPrefix')}{' '}
                      <strong>
                        {selectedShipmentDetail.receiver.fullName}
                      </strong>{' '}
                      ({selectedShipmentDetail.receiver.phoneNumber})
                      {selectedShipmentDetail.receiver.cccd && (
                        <span className="block mt-0.5 font-mono text-[11px] text-slate-500">
                          CCCD: {selectedShipmentDetail.receiver.cccd}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Danh sách kiện hàng */}
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-xs font-bold text-slate-700 uppercase mb-2">
                    {t('itemsList')} ({selectedShipmentDetail.items.length})
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedShipmentDetail.items.map((itm) => (
                      <div
                        key={itm.id}
                        className="py-2 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800">
                            {itm.name}
                          </span>{' '}
                          <span className="text-slate-500">
                            ({formatCategoryDisplayName(itm.category)})
                          </span>
                          {itm.note && (
                            <span className="block text-slate-400">
                              {t('packageNotePrefix')}{itm.note}
                            </span>
                          )}
                        </div>
                        <div className="text-right font-semibold text-slate-700">
                          {t('itemsCount', { count: itm.quantity })} · {itm.weight} kg
                          {itm.dimensions ? ` (${itm.dimensions})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      {t('totalFee')}:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedShipmentDetail.status !== 'DA_HUY' &&
                        renderPaymentStatusBadge(
                          selectedShipmentDetail.paymentStatus,
                          t,
                        )}
                      <span className="text-base font-black text-accent">
                        {formatCurrency(Number(selectedShipmentDetail.pricing.totalFee), locale)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500 font-medium">
                    {selectedShipmentDetail.freightPayer === 'NGUOI_NHAN'
                      ? t('receiverPaysDesc')
                      : t('senderPaysDesc')}
                  </div>
                </div>

                {/* Lịch sử hành trình */}
                {selectedShipmentDetail.timeline &&
                  selectedShipmentDetail.timeline.length > 0 && (
                    <div className="rounded-xl border border-slate-200 p-3.5">
                      <div className="text-xs font-bold text-slate-700 uppercase mb-2 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t('timelineTitle')}</span>
                      </div>
                      <div className="space-y-2">
                        {selectedShipmentDetail.timeline.map((step) => {
                          const isCancelled = step.status === 'DA_HUY';
                          return (
                            <div
                              key={step.id}
                              className="flex items-start gap-2.5 text-xs"
                            >
                              {isCancelled ? (
                                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              )}
                              <div>
                                <span
                                  className={`font-bold ${
                                    isCancelled
                                      ? 'text-rose-600'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {formatShipmentStatusLabel(step.status, t)}
                                </span>{' '}
                                <span className="text-slate-400">
                                  · {formatDeparture(step.time, locale)}
                                </span>
                                {step.note && (
                                  <p className="text-slate-500 mt-0.5">
                                    {formatTimelineNote(step.note, t)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Hủy đơn gửi hàng khi còn ở trạng thái Mới tạo */}
                {selectedShipmentDetail.status === 'MOI_TAO' && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 space-y-3">
                    {!showCancelConfirm ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-800">{t('cancelOrderQuestion')}</strong>{' '}
                          {t('cancelOrderOnlineNotice')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelError('');
                            setShowCancelConfirm(true);
                          }}
                          className="px-3.5 py-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('cancelShipment')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="text-xs font-bold text-slate-800">
                          {t('cancelReasonLabel')}
                        </div>
                        <select
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
                        >
                          <option value="Đặt nhầm thông tin người gửi/nhận">
                            {t('cancelReasonWrongInfo')}
                          </option>
                          <option value="Thay đổi kế hoạch gửi hàng">
                            {t('cancelReasonChangePlan')}
                          </option>
                          <option value="Muốn đổi nhà xe hoặc điểm gửi khác">
                            {t('cancelReasonChangeCompany')}
                          </option>
                        </select>
                        {cancelError && (
                          <div className="text-xs font-medium text-rose-600">
                            {cancelError}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            disabled={isCancelling}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            {t('cancelBack')}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelShipment}
                            disabled={isCancelling}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
                          >
                            {isCancelling ? t('cancelling') : t('cancelConfirmBtn')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(selectedShipmentDetail.status === 'DA_TIEP_NHAN' ||
                  selectedShipmentDetail.status === 'DANG_VAN_CHUYEN') && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs text-slate-700">
                    <strong>{t('noticePrefix')}</strong> {t('cannotCancelStationNotice', { name: selectedShipmentDetail.trip.busCompany.name })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
