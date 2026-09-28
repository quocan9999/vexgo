'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Info,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import type { Post } from '@/features/posts/types/post';

export interface RoundTripBookingProps {
  outboundPost: Post;
  returnPost: Post;
  departureDate: string;
  returnDate: string;
}

const OUTBOUND_BOOKED = new Set(['A01', 'A03', 'A06', 'A09', 'A11', 'B01', 'B02', 'B03']);
const RETURN_BOOKED = new Set(['A02', 'A05', 'B04', 'B07', 'B10']);
const LOWER_SEATS = ['A01', 'A03', 'A06', 'A09', 'A12', 'A15', 'A02', 'A05', 'A07', 'A08', 'A10', 'A13', 'A16', 'A11', 'A14', 'A17'];
const UPPER_SEATS = ['B01', 'B03', 'B06', 'B09', 'B12', 'B15', 'B02', 'B05', 'B07', 'B08', 'B10', 'B13', 'B16', 'B11', 'B14', 'B17'];

const SeatIcon = ({ className = 'w-[30px] h-[38px]' }: { className?: string }) => (
  <svg viewBox="0 0 40 48" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g strokeWidth="2.5">
      <rect x="1" y="14" width="10" height="20" rx="3" />
      <rect x="29" y="14" width="10" height="20" rx="3" />
      <rect x="10" y="34" width="20" height="12" rx="3" />
      <rect x="6" y="2" width="28" height="38" rx="5" />
    </g>
  </svg>
);

interface SeatButtonProps {
  seat: string;
  booked: boolean;
  selected: boolean;
  onToggle: (seat: string) => void;
}

const SeatButton = ({ seat, booked, selected, onToggle }: SeatButtonProps) => {
  const seatClass = booked
    ? 'fill-slate-200 stroke-slate-300'
    : selected
      ? 'fill-[#F5A623] stroke-[#D98A12]'
      : 'fill-sky-100 stroke-sky-300 group-hover:fill-sky-200 group-hover:stroke-sky-400';
  const textClass = booked ? 'text-slate-400' : selected ? 'text-white' : 'text-sky-600';

  return (
    <button
      type="button"
      disabled={booked}
      aria-label={`${seat}${booked ? ' đã bán' : selected ? ' đang chọn' : ' còn trống'}`}
      aria-pressed={selected}
      onClick={() => onToggle(seat)}
      className="group relative min-h-11 min-w-11 inline-flex items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <SeatIcon className={`w-7 h-9 transition-colors ${seatClass}`} />
      <span className={`absolute text-[9px] font-bold ${textClass}`}>{seat}</span>
    </button>
  );
};

interface SeatGridProps {
  title: string;
  date: string;
  bookedSeats: Set<string>;
  selectedSeats: string[];
  onToggle: (seat: string) => void;
}

const SeatGrid = ({ title, date, bookedSeats, selectedSeats, onToggle }: SeatGridProps) => (
  <div className="min-w-0 flex-1 p-4 md:p-5">
    <div className="flex items-start justify-between gap-3 mb-5">
      <div>
        <h2 className="text-lg font-black text-slate-950">Chọn ghế</h2>
        <p className="text-xs font-bold text-slate-500 mt-1">{title} - {date}</p>
      </div>
      <button type="button" className="min-h-11 px-2 text-xs font-bold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-md">
        Thông tin xe
      </button>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      {[
        { label: 'Tầng dưới', seats: LOWER_SEATS },
        { label: 'Tầng trên', seats: UPPER_SEATS },
      ].map((floor) => (
        <div key={floor.label} className="min-w-0">
          <h3 className="text-[11px] font-black text-slate-700 text-center mb-3 uppercase">{floor.label}</h3>
          <div className="grid grid-cols-3 gap-1 sm:gap-2 justify-items-center">
            {floor.seats.map((seat) => (
              <SeatButton
                key={seat}
                seat={seat}
                booked={bookedSeats.has(seat)}
                selected={selectedSeats.includes(seat)}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const RoundTripBooking: React.FC<RoundTripBookingProps> = ({
  outboundPost,
  returnPost,
  departureDate,
  returnDate,
}) => {
  const router = useRouter();
  const [outboundSeats, setOutboundSeats] = useState<string[]>([]);
  const [returnSeats, setReturnSeats] = useState<string[]>([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const toggleOutboundSeat = (seat: string) => {
    if (OUTBOUND_BOOKED.has(seat)) return;
    setOutboundSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat]);
  };
  const toggleReturnSeat = (seat: string) => {
    if (RETURN_BOOKED.has(seat)) return;
    setReturnSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat]);
  };

  const outboundUnitFare = (outboundPost.minPriceNum || 200) * 1000;
  const returnUnitFare = (returnPost.minPriceNum || 200) * 1000;
  const outboundFare = outboundUnitFare * outboundSeats.length;
  const returnFare = returnUnitFare * returnSeats.length;
  const totalFare = outboundFare + returnFare;
  const departureDateLabel = departureDate ? departureDate.split('-').reverse().join('/') : outboundPost.createdAt;
  const returnDateLabel = returnDate ? returnDate.split('-').reverse().join('/') : returnPost.createdAt;
  const departureLabel = departureDate
    ? `${new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date(`${departureDate}T00:00:00`))}, ${departureDateLabel}`
    : departureDateLabel;
  const returnLabel = returnDate
    ? `${new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date(`${returnDate}T00:00:00`))}, ${returnDateLabel}`
    : returnDateLabel;
  const outboundRoute = `${outboundPost.province} - ${outboundPost.district}`;
  const returnRoute = `${returnPost.district} - ${returnPost.province}`;
  const canPay = outboundSeats.length > 0 && returnSeats.length > 0 && acceptedTerms;

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-sans pb-12">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-brand">Trang chủ</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <Link href="/posts" className="hover:text-brand">Khứ hồi</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-900 font-bold">Đặt vé 2 chiều</span>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Chọn ghế 2 chiều */}
            <div className="flex flex-col md:flex-row border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <SeatGrid
                title="Chuyến đi"
                date={departureLabel}
                bookedSeats={OUTBOUND_BOOKED}
                selectedSeats={outboundSeats}
                onToggle={toggleOutboundSeat}
              />
              <SeatGrid
                title="Chuyến về"
                date={returnLabel}
                bookedSeats={RETURN_BOOKED}
                selectedSeats={returnSeats}
                onToggle={toggleReturnSeat}
              />
            </div>

            {/* Chú giải */}
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-center gap-8 text-[11px] font-bold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-slate-200 stroke-slate-300" /> Đã bán
              </span>
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-sky-100 stroke-sky-300" /> Còn trống
              </span>
              <span className="inline-flex items-center gap-2">
                <SeatIcon className="w-4 h-5 fill-[#F5A623] stroke-[#D98A12]" /> Đang chọn
              </span>
            </div>

            {/* Thông tin khách hàng & Điều khoản */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4">Thông tin khách hàng</h2>
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Họ và tên <span className="text-red-500">*</span></span>
                    <div className="mt-1.5 relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand" defaultValue="Nguyễn Văn Hùng" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Số điện thoại <span className="text-red-500">*</span></span>
                    <div className="mt-1.5 relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand" defaultValue="0912345678" />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-slate-700">Email <span className="text-red-500">*</span></span>
                    <div className="mt-1.5 relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input className="h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-semibold outline-none focus:border-brand" defaultValue="hungnguyen@gmail.com" />
                    </div>
                  </label>
                </div>
              </div>

              <div className="p-4 md:p-5">
                <h2 className="text-base font-black text-accent mb-4 uppercase">Điều khoản & Lưu ý</h2>
                <div className="space-y-3 text-[11px] font-semibold text-slate-700 leading-relaxed">
                  <p className="text-accent font-black">
                    Quý khách vui lòng đăng nhập tài khoản để nhận chương trình khuyến mãi.
                  </p>
                  <p>
                    (*) Quý khách vui lòng có mặt tại bến xuất phát của xe trước ít nhất 30 phút giờ xe khởi hành, mang theo thông báo đã thanh toán vé thành công. Vui lòng liên hệ Trung tâm tổng đài <strong className="text-accent">1900 6067</strong> để được hỗ trợ.
                  </p>
                  <p>
                    (*) Nếu quý khách có nhu cầu trung chuyển, vui lòng liên hệ Tổng đài trung chuyển <strong className="text-accent">1900 6918</strong> trước khi đặt vé. Chúng tôi không đón/trung chuyển tại những điểm xe trung chuyển không thể tới được.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border-b border-slate-200">
              <label className="flex items-start gap-2 cursor-pointer group w-fit">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-brand"
                />
                <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900 leading-relaxed">
                  <span className="text-accent underline underline-offset-2">Chấp nhận điều khoản</span> đặt vé & chính sách bảo mật thông tin của BusWay
                </span>
              </label>
            </div>

            {/* Thông tin đón trả 2 chiều */}
            <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="flex-1 p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                  Thông tin đón trả <Info className="w-4 h-4 text-accent" />
                </h2>
                <p className="text-xs font-bold text-slate-500 mb-4 capitalize">Chuyến đi - {departureLabel}</p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">Điểm đón</h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent"><input type="radio" name="pickupOut" defaultChecked className="accent-accent" /> Bến xe/VP</label>
                      <label className="inline-flex items-center gap-1.5"><input type="radio" name="pickupOut" className="accent-accent" /> Trung chuyển</label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{outboundPost.province}</option>
                    </select>
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón <strong className="text-accent">trước {outboundPost.direction || '20:00'} ngày {departureDateLabel}</strong> để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">Điểm trả</h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent"><input type="radio" name="dropoffOut" defaultChecked className="accent-accent" /> Bến xe/VP</label>
                      <label className="inline-flex items-center gap-1.5"><input type="radio" name="dropoffOut" className="accent-accent" /> Trung chuyển</label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{outboundPost.district}</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-4 md:p-5">
                <h2 className="text-base font-black text-slate-950 mb-4 flex items-center gap-2">
                  Thông tin đón trả <Info className="w-4 h-4 text-accent" />
                </h2>
                <p className="text-xs font-bold text-slate-500 mb-4 capitalize">Chuyến về - {returnLabel}</p>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">Điểm đón</h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent"><input type="radio" name="pickupIn" defaultChecked className="accent-accent" /> Bến xe/VP</label>
                      <label className="inline-flex items-center gap-1.5"><input type="radio" name="pickupIn" className="accent-accent" /> Trung chuyển</label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{returnPost.district}</option>
                    </select>
                    <p className="text-[11px] font-semibold text-slate-600 mt-2">
                      Quý khách vui lòng có mặt tại điểm đón <strong className="text-accent">trước {returnPost.direction || '00:45'} ngày {returnDateLabel}</strong> để kiểm tra thông tin trước khi lên xe.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-black text-slate-700 uppercase mb-3">Điểm trả</h3>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-600 mb-2">
                      <label className="inline-flex items-center gap-1.5 text-accent"><input type="radio" name="dropoffIn" defaultChecked className="accent-accent" /> Bến xe/VP</label>
                      <label className="inline-flex items-center gap-1.5"><input type="radio" name="dropoffIn" className="accent-accent" /> Trung chuyển</label>
                    </div>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold outline-none focus:border-brand">
                      <option>{returnPost.province}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Thanh toán Footer */}
            <div className="p-4 md:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex px-2 py-1 rounded-md bg-brand text-white text-[10px] font-black">BUSWAY</span>
                  <span className="text-xs font-bold text-slate-500">Tổng tiền</span>
                </div>
                <span className="text-2xl font-black text-red-600">{totalFare.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="min-h-11 px-6 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!canPay}
                  onClick={() => {
                    const paymentParams = new URLSearchParams({
                      tripType: 'round-trip',
                      totalFare: totalFare.toString(),
                      outboundSeats: outboundSeats.join(','),
                      returnSeats: returnSeats.join(','),
                      outboundRoute,
                      returnRoute,
                    });
                    router.push(`/payment?${paymentParams.toString()}`);
                  }}
                  className="min-h-11 px-6 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover shadow-sm disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Thanh toán
                </button>
              </div>
            </div>
          </section>

          {/* Sidebar */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-sm">Thông tin chuyến đi</h3>
                <button type="button" className="min-h-11 px-2 text-xs font-bold text-accent hover:underline">Chi tiết</button>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tuyến xe</span><span className="text-right text-slate-900">{outboundRoute}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Thời gian xuất bến</span><span className="text-emerald-600 font-black text-right">{outboundPost.direction || '20:00'} {departureDateLabel}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số lượng ghế</span><span className="text-slate-900">{outboundSeats.length} Ghế</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số ghế</span><span className="text-brand font-bold">{outboundSeats.join(', ') || '-'}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500 font-bold">Tổng tiền lượt đi</span><span className="text-accent font-black">{outboundFare.toLocaleString('vi-VN')}đ</span></div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-900 text-sm">Thông tin chuyến về</h3>
                <button type="button" className="min-h-11 px-2 text-xs font-bold text-accent hover:underline">Chi tiết</button>
              </div>
              <div className="space-y-2 text-xs font-semibold text-slate-600">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Tuyến xe</span><span className="text-right text-slate-900">{returnRoute}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Thời gian xuất bến</span><span className="text-emerald-600 font-black text-right">{returnPost.direction || '00:45'} {returnDateLabel}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số lượng ghế</span><span className="text-slate-900">{returnSeats.length} Ghế</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số ghế</span><span className="text-brand font-bold">{returnSeats.join(', ') || '-'}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500 font-bold">Tổng tiền lượt về</span><span className="text-accent font-black">{returnFare.toLocaleString('vi-VN')}đ</span></div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
              <h3 className="font-black text-slate-900 text-sm mb-4 flex items-center gap-1.5">Chi tiết giá <Info className="w-3.5 h-3.5 text-accent" /></h3>
              <div className="space-y-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between"><span>Giá vé lượt đi</span><span>{outboundFare.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Giá vé lượt về</span><span>{returnFare.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Phí thanh toán</span><span>0đ</span></div>
                <div className="flex justify-between pt-3 border-t border-slate-200"><span className="text-sm font-bold text-slate-900">Tổng tiền</span><span className="text-sm font-black text-accent">{totalFare.toLocaleString('vi-VN')}đ</span></div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};
