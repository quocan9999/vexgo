'use client';

import React, { useState, useEffect } from 'react';
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
import { routesApi } from '@/features/routes/services/routes.api';
import { AlertModal } from '@/components/ui/alert-modal';
import { LocationCombobox } from './location-combobox';

const DEFAULT_ORIGINS = ['TP.HCM', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Vũng Tàu', 'Đà Lạt'];
const DEFAULT_DESTINATIONS = ['Đà Lạt', 'Nha Trang', 'Đà Nẵng', 'Huế', 'Cần Thơ', 'Vũng Tàu', 'TP.HCM'];

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
  const [originOptions, setOriginOptions] = useState<string[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<string[]>([]);
  const router = useRouter();
  const [returnDateAlert, setReturnDateAlert] = useState<{
    isOpen: boolean;
    title: string;
  }>({ isOpen: false, title: '' });

  const handleDepartureDateChange = (newDate: string) => {
    setSelectedPrice(newDate);
    if (tripType === 'round-trip' && returnDate && newDate > returnDate) {
      setReturnDate(newDate);
    }
  };

  const handleReturnDateChange = (newDate: string) => {
    if (selectedPrice && newDate && selectedPrice > newDate) {
      setReturnDateAlert({
        isOpen: true,
        title: 'Ngày đi không được lớn hơn ngày về',
      });
      setReturnDate(selectedPrice);
      return;
    }
    setReturnDate(newDate);
  };

  const handleSearchSubmit = (e?: React.MouseEvent) => {
    if (tripType === 'round-trip') {
      if (!returnDate) {
        if (e) e.preventDefault();
        setReturnDateAlert({ isOpen: true, title: 'Vui lòng chọn ngày về' });
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
      router.push(
        `/trips?needType=${activeSearchTab}&tripType=${tripType}&province=${selectedProvince}&district=${selectedDistrict}&type=${selectedType}&price=${selectedPrice}&returnDate=${returnDate}&tickets=${ticketCount}`,
      );
    }
  };

  useEffect(() => {
    async function fetchRoutes() {
      try {
        const { data: routes } = await routesApi.listRoutes({
          pageSize: 100,
          status: 'HOAT_DONG',
        });

        const origins = new Set<string>();
        const destinations = new Set<string>();

        routes.forEach((route) => {
          if (route.origin) origins.add(route.origin);
          if (route.destination) destinations.add(route.destination);
        });

        setOriginOptions(Array.from(origins));
        setDestinationOptions(Array.from(destinations));
      } catch (err) {
        console.warn('Failed to fetch routes', err);
      }
    }
    fetchRoutes();
  }, []);

  // Freight states
  const [freightDate, setFreightDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
      new Date(),
    ),
  );
  const [freightType, setFreightType] = useState('Hàng thường');
  const freightWeight = 'Dưới 5kg';

  const swapRoute = () => {
    const currentProvince = selectedProvince;
    setSelectedProvince(selectedDistrict);
    setSelectedDistrict(currentProvince);
  };

  const effectiveOrigins = originOptions.length > 0 ? originOptions : DEFAULT_ORIGINS;
  const effectiveDestinations = destinationOptions.length > 0 ? destinationOptions : DEFAULT_DESTINATIONS;

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
      <div className="w-full max-w-[1050px] px-4 sm:px-6 -mt-32 md:-mt-40 relative z-10">
        <div className="bg-white text-slate-900 rounded-lg border border-slate-200 shadow-xl p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveSearchTab('BUY')}
                className={`h-10 px-4 rounded-md text-sm font-extrabold flex items-center gap-2 ${
                  activeSearchTab === 'BUY'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bus className="w-4 h-4" />
                Đặt vé
              </button>
              <button
                type="button"
                onClick={() => setActiveSearchTab('RENT')}
                className={`h-10 px-4 rounded-md text-sm font-extrabold flex items-center gap-2 ${
                  activeSearchTab === 'RENT'
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                Gửi hàng
              </button>
            </div>

            {activeSearchTab === 'BUY' && (
              <div className="flex items-center gap-6 pr-2 md:pr-4 text-xs font-bold text-slate-500">
                <label className="inline-flex items-center gap-2 cursor-pointer hover:text-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="tripTypeSearch"
                    checked={tripType === 'one-way'}
                    onChange={() => {
                      setTripType('one-way');
                      setReturnDate('');
                    }}
                    className="accent-brand w-4 h-4 cursor-pointer"
                  />
                  Một chiều
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer hover:text-slate-700 transition-colors">
                  <input
                    type="radio"
                    name="tripTypeSearch"
                    checked={tripType === 'round-trip'}
                    onChange={() => setTripType('round-trip')}
                    className="accent-brand w-4 h-4 cursor-pointer"
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
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand" />
                      Điểm đi
                    </label>
                    <LocationCombobox
                      value={selectedProvince}
                      onChange={setSelectedProvince}
                      options={effectiveOrigins}
                      placeholder="Chọn điểm đi"
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
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      Điểm đến
                    </label>
                    <LocationCombobox
                      value={selectedDistrict}
                      onChange={setSelectedDistrict}
                      options={effectiveDestinations}
                      placeholder="Chọn điểm đến"
                    />
                  </div>
                </div>

                {/* Vùng Ngày & Số vé */}
                <div className="flex flex-col md:flex-row gap-3 lg:contents">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-brand" />
                      Ngày đi
                    </label>
                    <input
                      type="date"
                      min={new Intl.DateTimeFormat('en-CA', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                      }).format(new Date())}
                      value={selectedPrice}
                      onChange={(e) => handleDepartureDateChange(e.target.value)}
                      className="h-12 w-full border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                    />
                  </div>

                  {tripType === 'round-trip' && (
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-brand" />
                        Ngày về
                      </label>
                      <input
                        type="date"
                        min={
                          selectedPrice ||
                          new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                          }).format(new Date())
                        }
                        value={returnDate}
                        onChange={(e) => handleReturnDateChange(e.target.value)}
                        className="h-12 w-full border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                      />
                    </div>
                  )}

                  <div className="flex-1 md:w-28 md:flex-none lg:w-28 lg:flex-none space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand" />
                      Số vé
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={ticketCount}
                      onChange={(e) =>
                        setTicketCount(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="h-12 w-full bg-white border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link
                  href="#"
                  className="text-sm font-bold text-amber-500 hover:text-amber-600 hover:underline"
                >
                  Hướng dẫn đặt vé
                </Link>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full sm:w-[170px] h-12 px-7 rounded-lg bg-accent hover:bg-accent-hover text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-brand" />
                    Nơi gửi
                  </label>
                  <LocationCombobox
                    value={selectedProvince}
                    onChange={setSelectedProvince}
                    options={effectiveOrigins}
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
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    Nơi nhận
                  </label>
                  <LocationCombobox
                    value={selectedDistrict}
                    onChange={setSelectedDistrict}
                    options={effectiveDestinations}
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
                    value={freightDate}
                    onChange={(e) => setFreightDate(e.target.value)}
                    className="h-12 w-full border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-500 uppercase flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-brand" />
                    Loại hàng
                  </label>
                  <select
                    value={freightType}
                    onChange={(e) => setFreightType(e.target.value)}
                    className="h-12 w-full bg-white border border-slate-300 rounded-lg px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                  >
                    <option value="Hàng thường">Hàng thường</option>
                    <option value="Dễ vỡ">Dễ vỡ</option>
                    <option value="Giá trị cao">Giá trị cao</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link
                  href="#"
                  className="text-sm font-bold text-amber-500 hover:text-amber-600 hover:underline"
                >
                  Hướng dẫn gửi hàng
                </Link>
                <div>
                  <Link
                    href={`/shipments/new?origin=${selectedProvince}&destination=${selectedDistrict}&date=${freightDate}&type=${freightType}&weight=${freightWeight}`}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent px-7 text-sm font-black text-white shadow-sm hover:bg-accent-hover sm:w-[170px]"
                  >
                    <Search className="w-4 h-4 shrink-0" />
                    Tìm nhà xe
                  </Link>
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
    </section>
  );
};
