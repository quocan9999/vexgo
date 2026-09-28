// frontend/src/modules/client/pages/PostListClientPage.tsx
'use client';

import React, { useState } from 'react';
import { PropertyList } from '../property/components/PropertyList';
import { MOCK_PROPERTY_DEMANDS } from '../property/models/property.data';
import { HeroClient } from '../home/components/HeroClient';

export const PostListClientPage: React.FC = () => {
  const [activeSearchTab, setActiveSearchTab] = useState<'BUY' | 'RENT'>('BUY');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPrice, setSelectedPrice] = useState('');

  const [searchCriteria, setSearchCriteria] = useState<{
    tripType: 'one-way' | 'round-trip';
    departureDate: string;
    returnDate: string;
  }>({
    tripType: 'one-way',
    departureDate: '',
    returnDate: '',
  });

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
        onSearch={setSearchCriteria}
      />
      <PropertyList 
        initialPosts={MOCK_PROPERTY_DEMANDS} 
        hideSearchForm={true}
        searchCriteria={searchCriteria}
      />
    </div>
  );
};

export default PostListClientPage;
