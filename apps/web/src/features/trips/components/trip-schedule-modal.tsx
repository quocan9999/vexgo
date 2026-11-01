'use client';

import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  Coffee,
  Info,
  MapPin,
  Navigation,
  ShieldAlert,
  Truck,
  X,
} from 'lucide-react';
import type { Trip } from '@/types/customer';
import type { ApiTripStopPoint } from '../services/trips.api';

interface TripScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: Trip;
}

export function TripScheduleModal({
  isOpen,
  onClose,
  trip,
}: TripScheduleModalProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'transfer'>(
    'timeline',
  );

  if (!isOpen) return null;

  // Lấy danh sách điểm dừng từ stops, hoặc gộp pickupPoints + dropoffPoints
  const allStops: ApiTripStopPoint[] =
    trip.stops && trip.stops.length > 0
      ? trip.stops
      : [
          ...(trip.pickupPoints || []),
          ...(trip.dropoffPoints || []),
        ];

  // Các điểm trung chuyển
  const transferPoints = allStops.filter(
    (s) => s.type === 'transfer' || Boolean(s.benTrungChuyen),
  );
  const transferPickups = transferPoints.filter((s) => s.role === 'DON');
  const transferDropoffs = transferPoints.filter((s) => s.role === 'TRA');

  const formatCurrency = (amount?: number) => {
    if (!amount || amount <= 0) return 'Miễn phí';
    return `+${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lịch trình chuyến xe
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                {trip.operator}
              </span>
            </div>
            <h2
              id="schedule-modal-title"
              className="text-lg sm:text-xl font-black text-slate-900 mt-1"
            >
              {trip.origin} → {trip.destination}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
              <span>{trip.vehicleType}</span>
              <span>•</span>
              <span>Thời gian dự kiến: {trip.duration}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-[#f05123] text-[#f05123]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock size={16} />
            Lộ trình chi tiết ({allStops.length > 0 ? allStops.length : 2})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'transfer'
                ? 'border-[#f05123] text-[#f05123]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck size={16} />
            Điểm trung chuyển ({transferPoints.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {allStops.length > 0 ? (
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-2.5 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {allStops.map((stop, index) => {
                    const isDon = stop.role === 'DON';
                    const isTra = stop.role === 'TRA';
                    const isNghi = stop.role === 'NGHI';
                    const isTransfer =
                      stop.type === 'transfer' || Boolean(stop.benTrungChuyen);

                    const dotColor = isDon
                      ? 'bg-[#00b14f] border-[#00b14f]'
                      : isNghi
                        ? 'bg-amber-500 border-amber-500'
                        : 'bg-[#f05123] border-[#f05123]';

                    return (
                      <div key={stop.id || index} className="relative group">
                        {/* Dot indicator */}
                        <div
                          className={`absolute -left-[19px] sm:-left-[25px] top-1.5 size-3 sm:size-3.5 rounded-full border-2 ${dotColor} bg-white ring-4 ring-white`}
                        />

                        {/* Stop details */}
                        <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-3.5 rounded-xl border border-slate-200/80">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm sm:text-base font-black text-slate-900">
                                {stop.time}
                              </span>

                              {/* Role Badge */}
                              {isDon && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-green-100 text-green-800 border border-green-200">
                                  Đón khách
                                </span>
                              )}
                              {isNghi && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  <Coffee size={12} /> Trạm nghỉ
                                </span>
                              )}
                              {isTra && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                                  Trả khách
                                </span>
                              )}

                              {isTransfer && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <Truck size={12} /> Trung chuyển
                                </span>
                              )}
                            </div>

                            {/* Extra badge / surcharge */}
                            {typeof stop.phuPhi === 'number' &&
                              stop.phuPhi > 0 && (
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Phụ phí {formatCurrency(stop.phuPhi)}
                                </span>
                              )}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-slate-800 mt-1">
                            {stop.name}
                          </h3>

                          {stop.address && (
                            <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                              <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
                              <span>{stop.address}</span>
                            </p>
                          )}

                          {/* Bến trung chuyển liên kết */}
                          {stop.benTrungChuyen && (
                            <div className="mt-2 text-xs text-blue-700 bg-blue-50/80 p-2 rounded-lg border border-blue-100 flex items-center gap-1.5">
                              <Navigation size={13} className="shrink-0" />
                              <span>
                                {isDon ? 'Trung chuyển đưa đến: ' : 'Xe trung chuyển đón từ: '}
                                <strong className="font-bold">
                                  {stop.benTrungChuyen.name}
                                </strong>
                              </span>
                            </div>
                          )}

                          {/* Ghi chú hoặc thời gian có mặt */}
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500 font-medium">
                            {stop.phutCoMatTruoc && isDon && (
                              <span className="text-orange-700 font-semibold">
                                • Vui lòng có mặt trước {stop.phutCoMatTruoc} phút
                              </span>
                            )}
                            {stop.ghiChu && (
                              <span className="italic">
                                Ghi chú: {stop.ghiChu}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback nếu chuyến xe chưa cấu hình chi tiết */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {trip.departureTime}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-green-100 text-green-800">
                        Đón khách
                      </span>
                    </div>
                    <p className="font-bold text-slate-800 mt-1">
                      {trip.pickupPoint || trip.origin}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.pickupAddress || 'Bến xe / Văn phòng xuất phát'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900">
                        {trip.arrivalTime}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                        Trả khách
                      </span>
                    </div>
                    <p className="font-bold text-slate-800 mt-1">
                      {trip.dropoffPoint || trip.destination}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {trip.dropoffAddress || 'Bến xe / Văn phòng đến nơi'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="space-y-5">
              {transferPoints.length > 0 ? (
                <>
                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                    <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Chính sách xe trung chuyển</p>
                      <p className="mt-0.5 text-blue-800 leading-relaxed">
                        Hành khách chọn điểm hẹn trung chuyển sẽ được xe đón đưa
                        đến bến xuất phát hoặc đón từ bến kết nối về điểm hẹn. Vui
                        lòng giữ điện thoại để tài xế trung chuyển liên hệ trước
                        khi đón.
                      </p>
                    </div>
                  </div>

                  {/* Nhóm Đón trung chuyển */}
                  {transferPickups.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-green-500" />
                        Điểm đón trung chuyển ({transferPickups.length})
                      </h3>
                      <div className="grid gap-2.5">
                        {transferPickups.map((point) => (
                          <div
                            key={point.id}
                            className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {point.name}
                                </p>
                                {point.address && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {point.address}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-bold text-[#00b14f] bg-green-50 px-2.5 py-1 rounded-md border border-green-200 shrink-0">
                                {formatCurrency(point.phuPhi)}
                              </span>
                            </div>
                            {point.benTrungChuyen && (
                              <p className="text-xs text-blue-600 mt-2 font-medium">
                                → Xe đưa khách đến:{' '}
                                <strong className="font-bold">
                                  {point.benTrungChuyen.name}
                                </strong>
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 mt-1">
                              Giờ đón dự kiến: <strong>{point.time}</strong>
                              {point.phutCoMatTruoc && (
                                <span> (có mặt trước {point.phutCoMatTruoc}p)</span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nhóm Trả trung chuyển */}
                  {transferDropoffs.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-red-500" />
                        Điểm trả trung chuyển ({transferDropoffs.length})
                      </h3>
                      <div className="grid gap-2.5">
                        {transferDropoffs.map((point) => (
                          <div
                            key={point.id}
                            className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {point.name}
                                </p>
                                {point.address && (
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {point.address}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs font-bold text-[#00b14f] bg-green-50 px-2.5 py-1 rounded-md border border-green-200 shrink-0">
                                {formatCurrency(point.phuPhi)}
                              </span>
                            </div>
                            {point.benTrungChuyen && (
                              <p className="text-xs text-blue-600 mt-2 font-medium">
                                → Xe trung chuyển đón từ bến:{' '}
                                <strong className="font-bold">
                                  {point.benTrungChuyen.name}
                                </strong>
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 mt-1">
                              Giờ trả dự kiến: <strong>{point.time}</strong>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
                    <Truck size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">
                    Chưa có điểm trung chuyển riêng
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    Chuyến xe này đón và trả khách tại các văn phòng/bến xe cố
                    định theo danh sách lộ trình. Quý khách vui lòng đến trực
                    tiếp bến xe trước giờ khởi hành.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
