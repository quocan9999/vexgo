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

function getTodayDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

export function HomePage({ initialHasSearched = false }: { initialHasSearched?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlOrigin = searchParams.get('from') || searchParams.get('origin') || '';
  const urlDestination = searchParams.get('to') || searchParams.get('destination') || '';
  const urlDate = searchParams.get('departureDate') || searchParams.get('date') || '';

  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState(urlOrigin);
  const [selectedDistrict, setSelectedDistrict] = useState(urlDestination);
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(urlDate || getTodayDate());
  
  const [hasSearched, setHasSearched] = useState(
    initialHasSearched || Boolean(urlOrigin || urlDestination || urlDate),
  );
  const [searchCriteria, setSearchCriteria] = useState<{tripType?: 'one-way' | 'round-trip'; departureDate?: string; returnDate?: string}>({});

  useEffect(() => {
    let scrollTimer: NodeJS.Timeout | null = null;
    if (urlOrigin || urlDestination || urlDate) {
      setSelectedProvince(urlOrigin);
      setSelectedDistrict(urlDestination);
      setSelectedPrice(urlDate || getTodayDate());
      setHasSearched(true);
      scrollTimer = setTimeout(() => {
        window.scrollTo({ top: 450, behavior: 'smooth' });
      }, 150);
    } else {
      setSelectedProvince('');
      setSelectedDistrict('');
      setSelectedPrice(getTodayDate());
      setHasSearched(initialHasSearched);
      setSearchCriteria({});
    }

    return () => {
      if (scrollTimer) {
        clearTimeout(scrollTimer);
      }
    };
  }, [urlOrigin, urlDestination, urlDate, initialHasSearched]);

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
        onSearch={({ tripType, departureDate, returnDate }) => {
          const query = new URLSearchParams({
            tripType,
            origin: selectedProvince,
            destination: selectedDistrict,
            date: departureDate || '',
          });
          if (returnDate) query.set('returnDate', returnDate);
          router.push(`/?${query.toString()}`, { scroll: false });
          
          setSearchCriteria({ tripType, departureDate, returnDate });
          setHasSearched(true);
          
          setTimeout(() => {
            window.scrollTo({ top: 450, behavior: 'smooth' });
          }, 100);
        }}
      />
      {hasSearched ? (
        <div className="py-4">
          <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải chuyến xe...</div>}>
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
