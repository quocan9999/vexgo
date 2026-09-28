'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HeroClient } from './HeroClient';
import { PromotionsClient } from './PromotionsClient';
import { PopularRoutesClient } from './PopularRoutesClient';
import { NewsClient } from './NewsClient';
import { EcosystemClient } from './EcosystemClient';
import { PropertyList } from '../../property/components/PropertyList';
import { PropertyDemand } from '../../property/models/property.model';
import { MOCK_PROPERTY_DEMANDS } from '../../property/models/property.data';

export const HomeClient: React.FC = () => {
  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');
  const router = useRouter();

  const handleSearch = (criteria: any) => {
    router.push('/posts');
  };

  // In a real app this would come from a server component or an API hook.
  const initialPosts: PropertyDemand[] = MOCK_PROPERTY_DEMANDS;

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <HeroClient
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
        onSearch={handleSearch}
      />

      <PromotionsClient />
      <PopularRoutesClient />
      <NewsClient />
      <EcosystemClient />
    </div>
  );
};

export default HomeClient;
