/* eslint-disable */
'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Bus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Info,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Ticket,
  User,
  X,
} from 'lucide-react';
import type { Post } from '@/features/posts/types/post';
import { LuggageStep } from './luggage/luggage-step';
import { LuggageSummary } from './luggage/luggage-summary';
import type { ILuggageItem } from './luggage/luggage-item';
import {
  canPayForOneWayBooking,
  formatTripDateTime,
  buildOneWayPaymentQuery,
} from '../utils/one-way-booking';
import { useAuthSession } from '@/features/auth/auth-session';
import type { ApiTripSeat } from '@/features/trips/services/trips.api';

export interface OneWayBookingProps {
  post: Post;
  tripSeats: ApiTripSeat[];
}

export const OneWayBooking: React.FC<OneWayBookingProps> = ({
  post,
  tripSeats,
}) => {
  const router = useRouter();
  const { user } = useAuthSession();
  const isTicket = post.needType === 'BUY';
  const [userNameOverride, setUserNameOverride] = useState<string | null>(null);
  const [userPhoneOverride, setUserPhoneOverride] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupOverride, setPickupOverride] = useState<string | null>(null);
  const [dropoffOverride, setDropoffOverride] = useState<string | null>(null);

  const customerName =
    userNameOverride !== null ? userNameOverride : user?.fullName || '';
  const customerPhone =
    userPhoneOverride !== null ? userPhoneOverride : user?.phoneNumber || '';
  const pickup = pickupOverride !== null ? pickupOverride : post.province;
  const dropoff = dropoffOverride !== null ? dropoffOverride : post.district;

  const departureDateTimeText = formatTripDateTime(
    post.createdAt,
    post.timeAgo,
  );

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [showTripInfoModal, setShowTripInfoModal] = useState(false);
  const [isAcceptedTerms, setIsAcceptedTerms] = useState(false);
  const descriptionLines = post.description
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);
  const checklist = descriptionLines
    .filter((line: string) => line.startsWith('-'))
    .map((line: string) => line.slice(1).trim());
  const paragraphs = descriptionLines.filter(
    (line: string) =>
      !line.startsWith('-') &&
      !line.toLowerCase().includes('yêu cầu nghiệp vụ'),
  );
  const seatGroups = Object.entries(
    tripSeats.reduce<Record<string, string[]>>((groups, seat) => {
      const label = seat.position?.trim() || 'Sơ đồ ghế';
      (groups[label] ??= []).push(seat.seatNumber);
      return groups;
    }, {}),
  );
  const bookedSeats = new Set(
    tripSeats
      .filter((seat) => seat.status !== 'TRONG')
      .map((seat) => seat.seatNumber),
  );
  const [luggageFee, setLuggageFee] = useState(0);
  const [luggageWeight, setLuggageWeight] = useState(0);
  const [luggageItems, setLuggageItems] = useState<ILuggageItem[]>([]);

  const handleLuggageChange = useCallback(
    (fee: number, weight: number, items: ILuggageItem[]) => {
      setLuggageFee(fee);
      setLuggageWeight(weight);
      setLuggageItems(items);
    },
    [],
  );

  const selectedSeatText = selectedSeats.join(', ');
  const baseFare = post.price.split(' - ')[0];
  const baseFareNumber = Number(baseFare.replace(/[^\d]/g, '')) || 0;
  const totalFare = baseFareNumber * selectedSeats.length + luggageFee;
  const totalFareText = totalFare.toLocaleString('vi-VN');
  const canPay = canPayForOneWayBooking(selectedSeats, isAcceptedTerms);

  const toggleSeat = (seat: string) => {
    if (bookedSeats.has(seat)) return;
    setSelectedSeats((prev) =>
      prev.includes(seat)
        ? prev.filter((item) => item !== seat)
        : [...prev, seat],
    );
  };

  const SeatIcon = ({
    className = 'w-[34px] h-[42px]',
  }: {
    className?: string;
  }) => (
    <svg
      viewBox="0 0 40 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g strokeWidth="2.5">
        <rect x="1" y="14" width="10" height="20" rx="3" />
        <rect x="29" y="14" width="10" height="20" rx="3" />
        <rect x="10" y="34" width="20" height="12" rx="3" />
        <rect x="6" y="2" width="28" height="38" rx="5" />
      </g>
    </svg>
  );

  const SeatButton = ({ seat }: { seat: string }) => {
    const isBooked = bookedSeats.has(seat);
    const isSelected = selectedSeats.includes(seat);

    let seatClass = '';
    let textClass = '';

    if (isBooked) {
      seatClass = 'fill-slate-200 stroke-slate-300';
      textClass = 'text-slate-400';
    } else if (isSelected) {
      seatClass = 'fill-[#F5A623] stroke-[#D98A12]';
      textClass = 'text-white';
    } else {
      seatClass =
        'fill-sky-100 stroke-sky-300 group-hover:fill-sky-200 group-hover:stroke-sky-400 transition-colors';
      textClass = 'text-sky-600';
    }

    return (
      <button
        type="button"
        disabled={isBooked}
        aria-label={`${seat}${isBooked ? ' đã bán' : isSelected ? ' đang chọn' : ' còn trống'}`}
        aria-pressed={isSelected}
        className="group relative min-h-11 min-w-11 inline-flex flex-col items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:active:scale-100 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onClick={() => toggleSeat(seat)}
      >
        <SeatIcon className={`w-[36px] h-[44px] ${seatClass}`} />
        <span
          className={`absolute top-[10px] text-[10px] font-bold ${textClass}`}
        >
          {seat}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans pb-12">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[15px] font-medium text-slate-700 hover:text-[#F05929] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Quay lại
          </button>
        </div>
      </div>

      <main className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-200">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-6">
                    <h2 className="text-xl font-black text-slate-950">
                      Chọn ghế
                    </h2>
                    <button
                      type="button"
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      Thông tin xe
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] font-bold text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-slate-200 stroke-slate-300" />{' '}
                    Đã bán
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-sky-100 stroke-sky-300" />{' '}
                    Còn trống
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <SeatIcon className="w-4 h-5 fill-[#F5A623] stroke-[#D98A12]" />{' '}
                    Đang chọn
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                {seatGroups.map(([label, seats]) => (
                  <div key={label}>
                    <h3 className="text-xs font-black text-slate-700 text-center mb-3">
                      {label}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 max-w-[230px] mx-auto">
                      {seats.map((seat) => (
                        <SeatButton key={seat} seat={seat} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-slate-200">
              <div className="p-4 md:p-5 border-b lg:border-b-0 lg:border-r border-slate-200">
                <h2 className="text-base font-black text-slate-950 mb-4">
                  Thông tin khách hàng
                </h2>
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Họ và tên <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent"
                        value={customerName}
                        onChange={(e) => setUserNameOverride(e.target.value)}
                        placeholder="Nhập họ và tên"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Số điện thoại <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent"
                        value={customerPhone}
                        onChange={(e) => setUserPhoneOverride(e.target.value)}
                        placeholder="Nhập số điện thoại"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">
                      Email <span className="text-red-500">*</span>
                    </span>
                    <div className="mt-1.5 relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-accent"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="Nhập email"
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 md:p-5">
                <h2 className="text-base font-black text-accent mb-4">
                  Điều khoản & lưu ý
                </h2>
                <div className="space-y-3 text-xs font-semibold text-slate-700 leading-relaxed">
                  <p className="text-accent font-black">
                    Quý khách vui lòng đăng nhập tài khoản để nhận chương trình
                    khuyến mãi và tích điểm.
                  </p>
                  <p>
                    Quý khách vui lòng có mặt tại bến xuất phát trước ít nhất 20
                    phút. Vé điện tử sẽ được gửi qua email hoặc SMS sau khi
                    thanh toán thành công.
                  </p>
                  <p>
                    Nếu có nhu cầu trung chuyển, vui lòng liên hệ tổng đài{' '}
                    <strong className="text-accent">1900 6789</strong> để được
                    hỗ trợ.
                  </p>
                  {paragraphs.slice(0, 1).map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 md:p-5 border-b border-slate-200">
              <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                Thông đón trả
                <Info className="w-4 h-4 text-accent" />
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase">
                    Điểm đón
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                    <label className="inline-flex items-center gap-1.5 text-accent">
                      <input
                        type="radio"
                        name="pickup"
                        defaultChecked
                        className="accent-[#EF5222]"
                      />
                      Bến xe/VP
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="pickup"
                        className="accent-[#EF5222]"
                      />
                      Trung chuyển
                    </label>
                  </div>
                  <select
                    value={pickup}
                    onChange={(e) => setPickupOverride(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                  >
                    <option value={post.province}>{post.province}</option>
                    <option value={`Bến xe ${post.province}`}>
                      Bến xe {post.province}
                    </option>
                  </select>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Quý khách vui lòng có mặt tại điểm đón trước giờ khởi hành
                    tối thiểu 20 phút.
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-700 uppercase">
                    Điểm trả
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
                    <label className="inline-flex items-center gap-1.5 text-accent">
                      <input
                        type="radio"
                        name="dropoff"
                        defaultChecked
                        className="accent-[#EF5222]"
                      />
                      Bến xe/VP
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name="dropoff"
                        className="accent-[#EF5222]"
                      />
                      Trung chuyển
                    </label>
                  </div>
                  <select
                    value={dropoff}
                    onChange={(e) => setDropoffOverride(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-accent"
                  >
                    <option value={post.district}>{post.district}</option>
                    <option value={`Bến xe ${post.district}`}>
                      Bến xe {post.district}
                    </option>
                  </select>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Điểm trả cụ thể sẽ được xác nhận lại trong vé điện tử sau
                    thanh toán.
                  </p>
                </div>
              </div>
            </div>

            <LuggageStep
              route={`${post.province} - ${post.district}`}
              time={departureDateTimeText}
              seat={selectedSeatText}
              passenger={customerName || 'Khách hàng'}
              onFeeChange={handleLuggageChange}
            />

            <div className="p-4 md:p-5 border-b border-slate-200 flex items-center justify-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${isAcceptedTerms ? 'bg-accent border-accent' : 'bg-white border-slate-300'}`}
                >
                  {isAcceptedTerms && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-3.5 h-3.5 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isAcceptedTerms}
                  onChange={(e) => setIsAcceptedTerms(e.target.checked)}
                />
                <span className="text-[13px] md:text-sm text-slate-800">
                  <span className="text-accent font-bold underline underline-offset-2">
                    Chấp nhận điều khoản
                  </span>{' '}
                  đặt vé & chính sách bảo mật thông tin của VexGo
                </span>
              </label>
            </div>

            <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 rounded-md bg-brand text-white text-[10px] font-black">
                    VEXGO
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Tổng tiền
                  </span>
                </div>
                <p className="text-2xl font-black text-red-600">
                  {totalFareText}đ
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-11 px-8 rounded-full border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!canPay}
                  onClick={() => {
                    if (selectedSeats.length === 0) {
                      alert('Vui lòng chọn ít nhất một ghế để tiếp tục.');
                      return;
                    }
                    if (!isAcceptedTerms) {
                      alert(
                        'Vui lòng chấp nhận điều khoản đặt vé & chính sách bảo mật để tiếp tục.',
                      );
                      return;
                    }
                    const query = buildOneWayPaymentQuery({
                      post,
                      selectedSeats,
                      baseFare: baseFareNumber,
                      totalFare,
                      customerName: customerName.trim(),
                      customerPhone: customerPhone.trim(),
                      customerEmail: customerEmail.trim(),
                      pickup: pickup || post.province,
                      dropoff: dropoff || post.district,
                      luggageFee,
                      luggageWeight,
                      luggageInfo:
                        luggageItems.length > 0
                          ? JSON.stringify({
                              count: luggageItems.length,
                              weight: luggageWeight,
                              fee: luggageFee,
                              category: luggageItems[0]?.category || 'normal',
                            })
                          : null,
                    });
                    router.push(`/payment?${query.toString()}`);
                  }}
                  className="h-11 px-8 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi
                </h2>
                <button
                  type="button"
                  onClick={() => setShowTripInfoModal(true)}
                  className="text-xs font-black text-accent hover:underline"
                >
                  Chi tiết
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Tuyến xe</span>
                  <strong className="text-slate-950 text-right">
                    {post.province} - {post.district}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Thời gian xuất bến
                  </span>
                  <strong className="text-emerald-600">
                    {departureDateTimeText}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Số lượng ghế
                  </span>
                  <strong className="text-slate-950">
                    {selectedSeats.length} ghế
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Số ghế</span>
                  <strong className="text-slate-950 text-right">
                    {selectedSeatText || 'Chưa chọn'}
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Tổng tiền lượt đi
                  </span>
                  <strong className="text-red-600">{totalFareText}đ</strong>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-1.5">
                Chi tiết giá
                <Info className="w-5 h-5 text-accent" />
              </h2>
              <div className="space-y-3 text-sm pb-4 border-b border-slate-100">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Giá vé lượt đi
                  </span>
                  <strong className="text-red-600">{baseFare}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">
                    Phí thanh toán
                  </span>
                  <strong className="text-slate-950">0đ</strong>
                </div>
                <LuggageSummary fee={luggageFee} totalWeight={luggageWeight} />
              </div>
              <div className="pt-4 flex justify-between gap-3 text-sm">
                <span className="text-slate-500 font-black">Tổng tiền</span>
                <strong className="text-red-600 text-base">
                  {totalFareText}đ
                </strong>
              </div>
            </section>
          </aside>
        </div>
      </main>

      {showTripInfoModal && (
        <div
          className="fixed inset-0 z-[80] bg-black/45 px-4 py-6 flex items-start justify-center"
          onClick={() => setShowTripInfoModal(false)}
        >
          <section
            className="w-full max-w-[340px] rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-950">
                  Thông tin chuyến đi (1)
                </h2>
                <span className="w-5 h-5 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-black text-[10px]">
                  i
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTripInfoModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                aria-label="Đóng chi tiết chuyến đi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Tuyến xe</span>
                  <strong className="text-right text-slate-950">
                    {post.province} - {post.district}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Xuất bến</span>
                  <strong className="text-right text-emerald-600">
                    {departureDateTimeText}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số lượng ghế</span>
                  <strong className="text-right text-slate-950">
                    {selectedSeats.length}
                  </strong>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-500">Số ghế</span>
                  <strong className="text-right text-slate-950">
                    {selectedSeatText || 'Chưa chọn'}
                  </strong>
                </div>

                <div className="flex justify-between gap-2 pt-2.5 border-t border-slate-200 mt-0.5">
                  <span className="font-black text-slate-700">Tổng tiền</span>
                  <strong className="text-right text-red-600 text-sm">
                    {totalFareText}đ
                  </strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
