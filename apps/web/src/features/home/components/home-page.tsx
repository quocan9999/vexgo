/* eslint-disable */
'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EcosystemSection } from './ecosystem-section';
import { HeroSection } from './hero-section';
import { NewsSection } from './news-section';
import { PopularRoutesSection } from './popular-routes-section';
import { PromotionsSection } from './promotions-section';
import { TripList } from '@/features/trips/components/trip-list';
import {
  buildHomeSearchQuery,
  deriveHomeSearchState,
} from '../services/home-search-state';

function getTodayDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}

export function HomePage({
  initialHasSearched = false,
}: {
  initialHasSearched?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const homeSearchState = deriveHomeSearchState(
    searchParams,
    initialHasSearched,
    getTodayDate(),
  );

  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState(
    homeSearchState.selectedProvince,
  );
  const [selectedDistrict, setSelectedDistrict] = useState(
    homeSearchState.selectedDistrict,
  );
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(
    homeSearchState.selectedPrice,
  );
  const [tripType, setTripType] = useState(homeSearchState.tripType);
  const [returnDate, setReturnDate] = useState(homeSearchState.returnDate);
  const [hasSearched, setHasSearched] = useState(homeSearchState.hasSearched);

  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | null = null;
    setSelectedProvince(homeSearchState.selectedProvince);
    setSelectedDistrict(homeSearchState.selectedDistrict);
    setSelectedPrice(homeSearchState.selectedPrice);
    setTripType(homeSearchState.tripType);
    setReturnDate(homeSearchState.returnDate);
    setHasSearched(homeSearchState.hasSearched);

    if (homeSearchState.shouldScroll) {
      scrollTimer = setTimeout(() => {
        window.scrollTo({ top: 450, behavior: 'smooth' });
      }, 150);
    }

    return () => {
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, [
    homeSearchState.selectedProvince,
    homeSearchState.selectedDistrict,
    homeSearchState.selectedPrice,
    homeSearchState.tripType,
    homeSearchState.returnDate,
    homeSearchState.hasSearched,
    homeSearchState.shouldScroll,
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F5F5]">
      <HeroSection
        activeSearchTab={activeSearchTab}
        setActiveSearchTab={setActiveSearchTab}
        selectedProvince={selectedProvince}
        setSelectedProvince={setSelectedProvince}
        selectedDistrict={selectedDistrict}
        setSelectedDistrict={setSelectedDistrict}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        selectedPrice={selectedPrice}
        setSelectedPrice={setSelectedPrice}
        tripType={tripType}
        setTripType={setTripType}
        returnDate={returnDate}
        setReturnDate={setReturnDate}
        onSearch={({ tripType, departureDate, returnDate }) => {
          const query = buildHomeSearchQuery({
            tripType,
            origin: selectedProvince,
            destination: selectedDistrict,
            departureDate,
            returnDate,
          });
          router.push(`/?${query}`, { scroll: false });

          setHasSearched(true);
        }}
      />
      {hasSearched ? (
        <div className="py-4">
          <Suspense
            fallback={
              <div className="p-8 text-center text-slate-500">
                Đang tải chuyến xe...
              </div>
            }
          >
            <TripList />
          </Suspense>
        </div>
      ) : (
        <>
          <PromotionsSection />
          <PopularRoutesSection />
          <NewsSection />
          <EcosystemSection />
        </>
      )}
    </div>
  );
}

export default HomePage;
