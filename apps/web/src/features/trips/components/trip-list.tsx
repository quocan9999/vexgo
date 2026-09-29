'use client';

import { useMemo, useState, useEffect } from 'react';
import { Filter, ChevronDown, MapPin } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { TripCard } from '@/features/trips/components/trip-card';
import type { Trip } from '@/types/customer';

function mapApiToTrip(item: any): Trip {
  const depDate = new Date(item.departureTime);
  const arrDate = new Date(item.arrivalTime);
  const hrs = Math.floor(item.route.durationMinutes / 60);
  const mins = item.route.durationMinutes % 60;
  return {
    id: String(item.id),
    operator: item.busCompany.name,
    origin: item.route.origin,
    destination: item.route.destination,
    departureTime: `${String(depDate.getHours()).padStart(2, '0')}:${String(depDate.getMinutes()).padStart(2, '0')}`,
    arrivalTime: `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}`,
    duration: mins > 0 ? `${hrs} giờ ${mins} phút` : `${hrs} giờ`,
    vehicleType: item.vehicle.type,
    price: item.price,
    availableSeats: item.availableSeats,
    totalSeats: item.vehicle.capacity,
    rating: item.busCompany.rating,
    image: item.busCompany.logo || '/images/route1.jpg',
    amenities: item.vehicle.amenities || [],
    status: item.availableSeats === 0 ? 'sold-out' : item.availableSeats <= 5 ? 'nearly-full' : 'open',
  };
}

async function fetchTripsByRoute(origin: string, destination: string, date: string): Promise<Trip[]> {
  if (!origin && !destination) return [];
  const res = await fetch(
    `http://localhost:4000/api/v1/trips/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${encodeURIComponent(date)}`
  );
  const json = await res.json();
  return (json.data || []).map(mapApiToTrip);
}

export function TripList() {
  const searchParams = useSearchParams();
  const [outboundTrips, setOutboundTrips] = useState<Trip[]>([]);
  const [returnTrips, setReturnTrips] = useState<Trip[]>([]);
  const [loadingOutbound, setLoadingOutbound] = useState(true);
  const [loadingReturn, setLoadingReturn] = useState(false);
  const [query, setQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('all');
  const [sort, setSort] = useState('departure');

  // Selected trips
  const [selectedOutbound, setSelectedOutbound] = useState<Trip | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<Trip | null>(null);

  // Active tab: 'outbound' | 'return'
  const [activeTab, setActiveTab] = useState<'outbound' | 'return'>('outbound');

  const origin = searchParams.get('origin') || searchParams.get('from') || '';
  const destination = searchParams.get('destination') || searchParams.get('to') || '';
  const date = searchParams.get('date') || '';
  const returnDate = searchParams.get('returnDate') || '';
  const tripType = searchParams.get('tripType') || '';
  // Round-trip nếu tripType=round-trip HOẶC có returnDate
  const isRoundTrip = tripType === 'round-trip' || !!returnDate;

  // Fetch outbound trips
  useEffect(() => {
    setLoadingOutbound(true);
    fetchTripsByRoute(origin, destination, date)
      .then(setOutboundTrips)
      .catch(console.error)
      .finally(() => setLoadingOutbound(false));
  }, [origin, destination, date]);

  // Fetch return trips if round-trip
  useEffect(() => {
    if (!isRoundTrip) return;
    setLoadingReturn(true);
    fetchTripsByRoute(destination, origin, returnDate)
      .then(setReturnTrips)
      .catch(console.error)
      .finally(() => setLoadingReturn(false));
  }, [destination, origin, returnDate, isRoundTrip]);

  const activeTrips = activeTab === 'outbound' ? outboundTrips : returnTrips;
  const loading = activeTab === 'outbound' ? loadingOutbound : loadingReturn;

  const filteredTrips = useMemo(() => {
    return activeTrips
      .filter((trip) => {
        const matchesQuery = `${trip.origin} ${trip.destination} ${trip.operator}`
          .toLowerCase().includes(query.toLowerCase());
        return matchesQuery && (vehicleType === 'all' || trip.vehicleType.includes(vehicleType));
      })
      .sort((a, b) => sort === 'price' ? a.price - b.price : a.departureTime.localeCompare(b.departureTime));
  }, [activeTrips, query, sort, vehicleType]);

  const totalResults = activeTab === 'outbound' ? outboundTrips.length : returnTrips.length;

  function handleSelectOutbound(trip: Trip) {
    setSelectedOutbound(trip);
  }

  function handleSelectReturn(trip: Trip) {
    setSelectedReturn(trip);
  }

  const handleSelect = activeTab === 'outbound' ? handleSelectOutbound : handleSelectReturn;
  const selectedForTab = activeTab === 'outbound' ? selectedOutbound : selectedReturn;

  // Mini trip summary for sidebar
  function TripSlot({ num, trip, label }: { num: number; trip: Trip | null; label: string }) {
    return (
      <div className={`flex gap-3 p-3 rounded-lg ${trip ? 'bg-orange-50' : 'bg-slate-50'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-sm ${trip ? 'bg-[#f05123]' : 'bg-slate-300'}`}>
          {num}
        </div>
        <div className="flex-1 min-w-0">
          {trip ? (
            <>
              <p className="text-[11px] text-slate-500 font-medium">{label}</p>
              <p className="text-[12px] font-bold text-slate-800 truncate">{trip.origin} - {trip.destination}</p>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-600">
                <span className="font-bold">{trip.departureTime}</span>
                <div className="w-1.5 h-1.5 rounded-full border border-[#00b14f]"></div>
                <div className="flex-1 border-t border-dotted border-slate-300"></div>
                <MapPin size={10} className="text-[#f05123]" fill="#f05123" />
                <span className="font-bold">{trip.arrivalTime}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-slate-400">Ngày đi chưa chọn</p>
              <p className="text-[12px] font-medium text-slate-500">{origin || '—'} - {destination || '—'}</p>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
                <span>--:--</span>
                <div className="flex-1 border-t border-dotted border-slate-200"></div>
                <span>--:--</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F5F5] min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white rounded-xl p-4 shadow-sm mb-6 gap-4 border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Chọn chuyến xe phù hợp</h1>
            <p className="text-sm text-slate-500 mt-1">So sánh giờ đi, loại xe, số ghế trống, giá vé và chính sách trước khi chọn chỗ.</p>
          </div>
          <div className="flex gap-2">
            <div className="bg-[#e8f6f3] text-[#00b14f] px-3 py-1.5 rounded-lg text-center border border-[#b2e8d3] min-w-[70px]">
              <p className="font-bold text-lg leading-tight">{totalResults}</p>
              <p className="text-[10px] uppercase font-bold">Kết quả</p>
            </div>
            <div className="bg-[#fff4e5] text-[#f05123] px-3 py-1.5 rounded-lg text-center border border-[#ffe0b2] min-w-[70px]">
              <p className="font-bold text-lg leading-tight">10p</p>
              <p className="text-[10px] uppercase font-bold">Giữ ghế</p>
            </div>
            <div className="border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-center bg-white min-w-[70px]">
              <p className="font-bold text-lg leading-tight">QR</p>
              <p className="text-[10px] uppercase font-bold">Vé điện tử</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* ===== LEFT SIDEBAR ===== */}
          <div className="space-y-4">

            {/* CHUYẾN ĐI CỦA BẠN */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 text-[13px] uppercase tracking-wide">CHUYẾN ĐI CỦA BẠN</h2>
              </div>

              {!selectedOutbound && !selectedReturn ? (
                /* Chưa chọn gì */
                <div className="p-5 text-center">
                  <div className="text-3xl mb-2">🚌</div>
                  <p className="text-[12px] text-slate-500">Chưa chọn chuyến đi</p>
                  <p className="text-[11px] text-slate-400 mt-1">Nhấn vào chuyến xe để thêm</p>
                </div>
              ) : (
                /* Đã có ít nhất 1 chuyến được chọn */
                <div className="p-3 space-y-2">
                  {selectedOutbound && (
                    <div className="relative">
                      <TripSlot num={1} trip={selectedOutbound} label="Chuyến đi" />
                      <button
                        onClick={() => setSelectedOutbound(null)}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 text-slate-400 text-[10px] flex items-center justify-center transition-colors"
                        title="Bỏ chọn"
                      >✕</button>
                    </div>
                  )}
                  {isRoundTrip && selectedReturn && (
                    <div className="relative">
                      <TripSlot num={2} trip={selectedReturn} label="Chuyến về" />
                      <button
                        onClick={() => setSelectedReturn(null)}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 text-slate-400 text-[10px] flex items-center justify-center transition-colors"
                        title="Bỏ chọn"
                      >✕</button>
                    </div>
                  )}
                  {/* Slot 2 chưa chọn (khứ hồi) */}
                  {isRoundTrip && selectedOutbound && !selectedReturn && (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-center">
                      <p className="text-[11px] text-slate-400">Chưa chọn chuyến về</p>
                      <button
                        onClick={() => setActiveTab('return')}
                        className="mt-1 text-[11px] text-[#f05123] font-medium hover:underline"
                      >
                        Chọn chuyến về →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* LỌC CHUYẾN */}
            <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-[13px] uppercase">
                  <Filter size={16} className="text-blue-600" />
                  LỌC CHUYẾN
                </h2>
                <button
                  onClick={() => { setQuery(''); setVehicleType('all'); }}
                  className="text-[11px] font-medium text-slate-500 hover:text-[#f05123] transition-colors"
                >
                  ↺ Đặt lại
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">Từ khóa tìm kiếm</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Điểm đi, điểm đến, loại xe..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">Loại xe / dịch vụ</label>
                  <div className="relative">
                    <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white">
                      <option value="all">Tất cả loại xe</option>
                      <option value="Limousine">Limousine</option>
                      <option value="Giường">Giường nằm</option>
                      <option value="Ghế">Ghế ngồi</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">Khung giờ</label>
                  <div className="relative">
                    <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white">
                      <option>Tất cả khung giờ</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">Khoảng giá</label>
                  <div className="relative">
                    <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white">
                      <option>Tất cả mức giá</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-2">Ghế trống / khối lượng</label>
                  <div className="relative">
                    <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#f05123] appearance-none bg-white">
                      <option>Tất cả tình trạng</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-600 block mb-3">Tiêu chí phổ biến</label>
                <div className="space-y-2.5">
                  {['Chọn trước chỗ ngồi', 'Có trung chuyển', 'Có mã giảm giá', 'Hủy vé linh hoạt'].map((label) => (
                    <label key={label} className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 accent-[#f05123]" />
                      <span className="text-xs font-medium text-slate-700 group-hover:text-[#f05123]">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ===== RIGHT CONTENT ===== */}
          <div className="flex flex-col gap-4">

            {/* Tabs (round-trip only) */}
            {isRoundTrip && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-2">
                  <button
                    onClick={() => setActiveTab('outbound')}
                    className={`py-3.5 text-[13px] font-bold text-center transition-colors ${
                      activeTab === 'outbound'
                        ? 'text-[#f05123] border-b-4 border-[#f05123]'
                        : 'text-slate-500 border-b border-slate-100 hover:text-slate-700'
                    }`}
                  >
                    CHUYẾN ĐI – NGÀY ĐI
                  </button>
                  <button
                    onClick={() => setActiveTab('return')}
                    className={`py-3.5 text-[13px] font-bold text-center transition-colors ${
                      activeTab === 'return'
                        ? 'text-[#f05123] border-b-4 border-[#f05123]'
                        : 'text-slate-500 border-b border-slate-100 hover:text-slate-700'
                    }`}
                  >
                    CHUYẾN VỀ – NGÀY VỀ
                  </button>
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white p-3 px-4 rounded-xl shadow-sm border border-slate-100">
              <p className="text-[13px] font-medium text-slate-600">
                Tìm thấy <span className="font-bold text-blue-600">{filteredTrips.length}</span> chuyến xe phù hợp
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-slate-500">⇅ Sắp xếp:</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}
                  className="text-[13px] font-medium text-slate-700 border border-slate-200 rounded-md px-3 py-1.5 outline-none bg-white">
                  <option value="departure">Mới cập nhật</option>
                  <option value="price">Giá thấp đến cao</option>
                </select>
              </div>
            </div>

            {/* Trip Cards */}
            <div className="flex flex-col gap-4">
              {loading ? (
                <div className="bg-white rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 border border-slate-100 shadow-sm">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f05123] mb-4"></div>
                  <p className="font-semibold text-sm">Đang tải dữ liệu chuyến xe...</p>
                </div>
              ) : filteredTrips.length > 0 ? (
                filteredTrips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    isSelected={selectedForTab?.id === trip.id}
                    onSelect={handleSelect}
                  />
                ))
              ) : (
                <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-slate-100 shadow-sm">
                  <div className="text-4xl mb-4">🚌</div>
                  <p className="font-semibold text-sm">Không tìm thấy chuyến xe nào phù hợp.</p>
                  <p className="text-xs mt-1">Vui lòng thay đổi bộ lọc hoặc chọn ngày khác.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {filteredTrips.length > 0 && (
              <div className="flex justify-center mt-4">
                <div className="flex items-center gap-2">
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">&lt;</button>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 text-white font-medium text-sm">1</button>
                  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">&gt;</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
