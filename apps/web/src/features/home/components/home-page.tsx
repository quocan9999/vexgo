'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EcosystemSection } from './ecosystem-section';
import { HeroSection } from './hero-section';
import { NewsSection } from './news-section';
import { PopularRoutesSection } from './popular-routes-section';
import { PromotionsSection } from './promotions-section';

export function HomePage() {
  const router = useRouter();
  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');

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
            departureDate,
          });
          if (returnDate) query.set('returnDate', returnDate);
          router.push(`/trips?${query.toString()}`);
        }}
      />
      <PromotionsSection />
      <PopularRoutesSection />
      <NewsSection />
      <EcosystemSection />
    </div>
  );
}

export default HomePage;
