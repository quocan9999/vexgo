'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HeroSection } from '@/features/home/components/hero-section';

export function TripSearchBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState(searchParams.get('origin') || searchParams.get('from') || '');
  const [selectedDistrict, setSelectedDistrict] = useState(searchParams.get('destination') || searchParams.get('to') || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');

  // Sync state if URL changes
  useEffect(() => {
    setSelectedProvince(searchParams.get('origin') || searchParams.get('from') || '');
    setSelectedDistrict(searchParams.get('destination') || searchParams.get('to') || '');
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
      onSearch={({ tripType, departureDate, returnDate }) => {
        const query = new URLSearchParams({
          origin: selectedProvince,
          destination: selectedDistrict,
          date: departureDate || '',
        });
        if (returnDate) query.set('returnDate', returnDate);
        router.push(`/trips?${query.toString()}`);
      }}
    />
  );
}
