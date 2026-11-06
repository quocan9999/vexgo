'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Bus,
  CalendarDays,
  MapPin,
  PackageCheck,
  Search,
  Users,
} from 'lucide-react';
import { AlertModal } from '@/components/ui/alert-modal';
import { LocationPicker } from '@/features/locations/components/location-picker';
import { BookingGuideModal } from '@/features/booking/components/booking-guide-modal';
import { ShipmentGuideModal } from '@/features/shipments/components/shipment-guide-modal';

export interface HeroSectionProps {
  activeSearchTab: 'BUY' | 'RENT';
  setActiveSearchTab: (tab: 'BUY' | 'RENT') => void;
  selectedProvince: string;
  setSelectedProvince: (val: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (val: string) => void;
  selectedType: string;
  setSelectedType: (val: string) => void;
  selectedPrice: string;
  setSelectedPrice: (val: string) => void;
  tripType?: 'one-way' | 'round-trip';
  setTripType?: (tripType: 'one-way' | 'round-trip') => void;
  returnDate?: string;
  setReturnDate?: (returnDate: string) => void;
  onSearch?: (criteria: {
    tripType: 'one-way' | 'round-trip';
    departureDate: string;
    returnDate: string;
  }) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  activeSearchTab,
  setActiveSearchTab,
  selectedProvince,
  setSelectedProvince,
  selectedDistrict,
  setSelectedDistrict,
  selectedType,
  selectedPrice,
  setSelectedPrice,
  tripType: controlledTripType,
  setTripType: setControlledTripType,
  returnDate: controlledReturnDate,
  setReturnDate: setControlledReturnDate,
  onSearch,
}) => {
  const [internalTripType, setInternalTripType] = useState<
    'one-way' | 'round-trip'
  >('one-way');
  const [internalReturnDate, setInternalReturnDate] = useState('');
  const tripType = controlledTripType ?? internalTripType;
  const setTripType = setControlledTripType ?? setInternalTripType;
  const returnDate = controlledReturnDate ?? internalReturnDate;
  const setReturnDate = setControlledReturnDate ?? setInternalReturnDate;
  const [ticketCount, setTicketCount] = useState(1);
  const router = useRouter();
  const [returnDateAlert, setReturnDateAlert] = useState<{
    isOpen: boolean;
    title: string;
  }>({ isOpen: false, title: '' });
  const [showBookingGuide, setShowBookingGuide] = useState(false);
  const [showShipmentGuide, setShowShipmentGuide] = useState(false);

  const todayStr = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date()),
    [],
  );

  const handleDepartureDateChange = (newDate: string) => {
    setSelectedPrice(newDate);
  };

  const handleDepartureDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && val < todayStr) {
      setReturnDateAlert({
        isOpen: true,
        title: 'Ngày đi không được nhỏ hơn ngày hiện tại',
      });
      setSelectedPrice(todayStr);
    }
  };

  const handleReturnDateChange = (newDate: string) => {
    setReturnDate(newDate);
  };

  const handleReturnDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const minAllowed =
      selectedPrice && selectedPrice >= todayStr ? selectedPrice : todayStr;
    if (val && val < todayStr) {
      setReturnDateAlert({
        isOpen: true,
        title: 'Ngày về không được nhỏ hơn ngày hiện tại',
      });
      setReturnDate(minAllowed);
      return;
    }
    if (selectedPrice && val && selectedPrice > val) {
      setReturnDateAlert({
        isOpen: true,
        title: 'Ngày đi không được lớn hơn ngày về',
      });
      setReturnDate(minAllowed);
    }
  };

  const handleFreightDateChange = (newDate: string) => {
    setFreightDate(newDate);
  };

  const handleSearchSubmit = (e?: React.MouseEvent) => {
    if (!selectedProvince && !selectedDistrict) {
      if (e) e.preventDefault();
      setReturnDateAlert({
        isOpen: true,
        title: 'Vui lòng chọn điểm đi và điểm đến để tìm chuyến xe',
      });
      return;
    }

    if (!selectedProvince) {
      if (e) e.preventDefault();
      setReturnDateAlert({
        isOpen: true,
        title: 'Vui lòng chọn điểm đi để tiếp tục',
      });
      return;
    }

    if (!selectedDistrict) {
      if (e) e.preventDefault();
      setReturnDateAlert({
        isOpen: true,
        title: 'Vui lòng chọn điểm đến để tiếp tục',
      });
      return;
    }

    if (selectedProvince && selectedDistrict && selectedProvince.trim().toLowerCase() === selectedDistrict.trim().toLowerCase()) {
      if (e) e.preventDefault();
      setReturnDateAlert({
        isOpen: true,
        title: 'Điểm đi và điểm đến không được trùng nhau',
      });
      return;
    }

    if (!selectedPrice || selectedPrice < todayStr) {
      if (e) e.preventDefault();
      setReturnDateAlert({
        isOpen: true,
        title: 'Ngày đi không được nhỏ hơn ngày hiện tại',
      });
      setSelectedPrice(todayStr);
      return;
    }

    if (tripType === 'round-trip') {
      if (!returnDate) {
        if (e) e.preventDefault();
        setReturnDateAlert({ isOpen: true, title: 'Vui lòng chọn ngày về' });
        return;
      }
      if (returnDate < todayStr) {
        if (e) e.preventDefault();
        setReturnDateAlert({
          isOpen: true,
          title: 'Ngày về không được nhỏ hơn ngày hiện tại',
        });
        setReturnDate(selectedPrice || todayStr);
        return;
      }
      if (selectedPrice && returnDate && selectedPrice > returnDate) {
        if (e) e.preventDefault();
        setReturnDateAlert({
          isOpen: true,
          title: 'Ngày đi không được lớn hơn ngày về',
        });
        return;
      }
    }

    if (onSearch) {
      onSearch({
        tripType,
        departureDate: selectedPrice,
        returnDate,
      });
    } else {
      const depDate = selectedPrice || todayStr;
      router.push(
        `/trips?needType=${activeSearchTab}&tripType=${tripType}&from=${encodeURIComponent(selectedProvince)}&to=${encodeURIComponent(selectedDistrict)}&origin=${encodeURIComponent(selectedProvince)}&destination=${encodeURIComponent(selectedDistrict)}&province=${encodeURIComponent(selectedProvince)}&district=${encodeURIComponent(selectedDistrict)}&departureDate=${depDate}&date=${depDate}&type=${selectedType}&price=${depDate}&returnDate=${returnDate}&tickets=${ticketCount}`,
      );
    }
  };

  // Freight states
  const [freightDate, setFreightDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    ),
  );

  const swapRoute = () => {
    const currentProvince = selectedProvince;
    setSelectedProvince(selectedDistrict);
    setSelectedDistrict(currentProvince);
  };

  return (
    <section className="relative w-full bg-[#F5F5F5] flex flex-col items-center pb-12">
      {/* Banner Background */}
      <div className="w-full h-[380px] md:h-[480px] relative">
        <div className="absolute inset-0 bg-[url('/images/promo2.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center pt-8 px-4 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-wider drop-shadow-lg shadow-black">
            <span className="text-accent">VỮNG TIN</span> & PHÁT TRIỂN
          </h1>
          <p className="mt-4 text-white/90 text-sm md:text-lg font-bold drop-shadow-md bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-sm">
            Chất lượng là danh dự - Hàng ngàn chuyến đi mỗi ngày
          </p>
        </div>
      </div>

      {/* Floating Search Form */}
      <div className="w-full max-w-[1100px] px-4 sm:px-6 -mt-32 md:-mt-40 relative z-10">
        <div className="bg-white text-slate-900 rounded-2xl border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveSearchTab('BUY')}
                className={`h-10 px-4 rounded-lg text-sm font-extrabold flex items-center gap-2 transition-all ${
                  activeSearchTab === 'BUY'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bus className="w-4 h-4" />
                Đặt vé
              </button>
              <button
                type="button"
                onClick={() => setActiveSearchTab('RENT')}
                className={`h-10 px-4 rounded-lg text-sm font-extrabold flex items-center gap-2 transition-all ${
                  activeSearchTab === 'RENT'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                Gửi hàng
              </button>
            </div>

            {activeSearchTab === 'BUY' && (
              <div className="flex items-center gap-6 pr-2 md:pr-4 text-xs font-bold text-slate-600">
                <label className="inline-flex items-center gap-2 cursor-pointer hover:text-slate-900 transition-colors">
                  <input
                    type="radio"
                    name="tripTypeSearch"
                    checked={tripType === 'one-way'}
                    onChange={() => {
                      setTripType('one-way');
                      setReturnDate('');
                    }}
                    className="accent-[#2563EB] w-4 h-4 cursor-pointer"
                  />
                  Một chiều
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer hover:text-slate-900 transition-colors">
                  <input
                    type="radio"
                    name="tripTypeSearch"
                    checked={tripType === 'round-trip'}
                    onChange={() => setTripType('round-trip')}
                    className="accent-[#2563EB] w-4 h-4 cursor-pointer"
                  />
                  Khứ hồi
                </label>
              </div>
            )}
          </div>

          {activeSearchTab === 'BUY' ? (
            <>
              <div className="flex flex-col lg:flex-row gap-3 pt-4">
                {/* Vùng Điểm đi & Điểm đến */}
                <div className="flex flex-col md:flex-row gap-3 lg:contents">
                  <div className="flex-1 space-y-1.5">
                    <label
                      htmlFor="hero-origin"
                      className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#2563EB]" />
                      Điểm đi
                    </label>
                    <LocationPicker
                      id="hero-origin"
                      value={selectedProvince}
                      onChange={setSelectedProvince}
                      placeholder="Chọn điểm đi"
                    />
                  </div>

                  <div className="hidden md:flex items-end pb-1 lg:shrink-0">
                    <button
                      type="button"
                      onClick={swapRoute}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#2563EB] flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs hover:scale-105"
                      title="Đổi chiều tuyến"
                    >
                      <ArrowRightLeft className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <label
                      htmlFor="hero-destination"
                      className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Điểm đến
                    </label>
                    <LocationPicker
                      id="hero-destination"
                      value={selectedDistrict}
                      onChange={setSelectedDistrict}
                      placeholder="Chọn điểm đến"
                    />
                  </div>
                </div>

                {/* Vùng Ngày & Số ghế */}
                <div className="flex flex-col md:flex-row gap-3 lg:contents">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-[#2563EB]" />
                      Ngày đi
                    </label>
                    <input
                      type="date"
                      min={todayStr}
                      value={selectedPrice || todayStr}
                      onChange={(e) =>
                        handleDepartureDateChange(e.target.value)
                      }
                      onBlur={handleDepartureDateBlur}
                      className="h-12 w-full border border-slate-200 rounded-xl px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                    />
                  </div>

                  {tripType === 'round-trip' && (
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-[#2563EB]" />
                        Ngày về
                      </label>
                      <input
                        type="date"
                        min={
                          selectedPrice && selectedPrice >= todayStr
                            ? selectedPrice
                            : todayStr
                        }
                        value={returnDate}
                        onChange={(e) => handleReturnDateChange(e.target.value)}
                        onBlur={handleReturnDateBlur}
                        className="h-12 w-full border border-slate-200 rounded-xl px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                      />
                    </div>
                  )}

                  <div className="flex-1 md:w-28 md:flex-none lg:w-28 lg:flex-none space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#2563EB]" />
                      Số ghế
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={ticketCount}
                      onChange={(e) =>
                        setTicketCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="h-12 w-full bg-white border border-slate-200 rounded-xl px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookingGuide(true)}
                  className="text-sm font-bold text-[#FF5722] hover:text-[#E64A19] hover:underline transition-colors cursor-pointer text-left"
                >
                  Hướng dẫn đặt vé
                </button>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full sm:w-[170px] h-12 px-7 rounded-xl bg-gradient-to-r from-[#FF5722] to-[#FF7043] hover:from-[#E64A19] hover:to-[#FF5722] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#FF5722]/25 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    Tìm chuyến
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col pt-4">
              {/* Row 1 */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 space-y-1.5">
                  <label
                    htmlFor="hero-origin"
                    className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    Nơi gửi
                  </label>
                  <LocationPicker
                    id="hero-origin"
                    value={selectedProvince}
                    onChange={setSelectedProvince}
                    placeholder="Chọn nơi gửi"
                  />
                </div>

                <div className="hidden md:flex items-end pb-1 lg:shrink-0">
                  <button
                    type="button"
                    onClick={swapRoute}
                    className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-brand flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Đổi chiều tuyến"
                  >
                    <ArrowRightLeft className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-1.5">
                  <label
                    htmlFor="hero-destination"
                    className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Nơi nhận
                  </label>
                  <LocationPicker
                    id="hero-destination"
                    value={selectedDistrict}
                    onChange={setSelectedDistrict}
                    placeholder="Chọn nơi nhận"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-brand" />
                    Ngày gửi
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={freightDate || todayStr}
                    onChange={(e) => handleFreightDateChange(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value < todayStr) {
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Ngày gửi không được nhỏ hơn ngày hiện tại',
                        });
                        setFreightDate(todayStr);
                      }
                    }}
                    onClick={(e) => {
                      try {
                        (e.target as HTMLInputElement).showPicker?.();
                      } catch {}
                    }}
                    className="h-12 w-full border border-slate-200 rounded-xl px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowShipmentGuide(true)}
                  className="text-sm font-bold text-[#FF5722] hover:text-[#E64A19] hover:underline transition-colors cursor-pointer text-left"
                >
                  Hướng dẫn gửi hàng
                </button>
                <div>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (!selectedProvince && !selectedDistrict) {
                        e.preventDefault();
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Vui lòng chọn điểm gửi và điểm nhận hàng',
                        });
                        return;
                      }
                      if (!selectedProvince) {
                        e.preventDefault();
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Vui lòng chọn điểm gửi hàng để tiếp tục',
                        });
                        return;
                      }
                      if (!selectedDistrict) {
                        e.preventDefault();
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Vui lòng chọn điểm nhận hàng để tiếp tục',
                        });
                        return;
                      }
                      if (
                        selectedProvince &&
                        selectedDistrict &&
                        selectedProvince.trim().toLowerCase() ===
                          selectedDistrict.trim().toLowerCase()
                      ) {
                        e.preventDefault();
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Điểm gửi và điểm nhận không được trùng nhau',
                        });
                        return;
                      }
                      if (!freightDate || freightDate < todayStr) {
                        e.preventDefault();
                        setReturnDateAlert({
                          isOpen: true,
                          title: 'Ngày gửi không được nhỏ hơn ngày hiện tại',
                        });
                        setFreightDate(todayStr);
                        return;
                      }
                      router.push(
                        `/shipments/new?origin=${selectedProvince}&destination=${selectedDistrict}&date=${freightDate}`,
                      );
                    }}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF5722] to-[#FF7043] px-7 text-sm font-black text-white shadow-md shadow-[#FF5722]/25 hover:from-[#E64A19] hover:to-[#FF5722] sm:w-[170px] cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    Tìm nhà xe
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AlertModal
        isOpen={returnDateAlert.isOpen}
        title={returnDateAlert.title}
        variant="warning"
        confirmText="Đã hiểu"
        onClose={() => setReturnDateAlert({ isOpen: false, title: '' })}
      />

      <BookingGuideModal
        isOpen={showBookingGuide}
        onClose={() => setShowBookingGuide(false)}
      />

      <ShipmentGuideModal
        isOpen={showShipmentGuide}
        onClose={() => setShowShipmentGuide(false)}
      />
    </section>
  );
};
