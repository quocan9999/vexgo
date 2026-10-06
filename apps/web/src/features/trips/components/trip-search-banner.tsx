'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HeroSection } from '@/features/home/components/hero-section';

export function TripSearchBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState(
    searchParams.get('from') || searchParams.get('origin') || '',
  );
  const [selectedDistrict, setSelectedDistrict] = useState(
    searchParams.get('to') || searchParams.get('destination') || '',
  );
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState(
    searchParams.get('departureDate') || searchParams.get('date') || '',
  );
  const [tripType, setTripType] = useState<'one-way' | 'round-trip'>(
    searchParams.get('tripType') === 'round-trip' || !!searchParams.get('returnDate')
      ? 'round-trip'
      : 'one-way',
  );
  const [returnDate, setReturnDate] = useState(
    searchParams.get('returnDate') || '',
  );

  // Sync state if URL changes
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setSelectedProvince(
        searchParams.get('from') || searchParams.get('origin') || '',
      );
      setSelectedDistrict(
        searchParams.get('to') || searchParams.get('destination') || '',
      );
      setSelectedPrice(
        searchParams.get('departureDate') || searchParams.get('date') || '',
      );
      setTripType(
        searchParams.get('tripType') === 'round-trip' || !!searchParams.get('returnDate')
          ? 'round-trip'
          : 'one-way',
      );
      setReturnDate(searchParams.get('returnDate') || '');
    });
    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
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
        const query = new URLSearchParams({
          from: selectedProvince,
          to: selectedDistrict,
          departureDate: departureDate || '',
          tripType,
        });
        if (returnDate) query.set('returnDate', returnDate);
        router.push(`/trips?${query.toString()}`);
      }}
    />
  );
}
