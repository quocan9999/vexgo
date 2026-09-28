// frontend/src/modules/client/pages/DetailPropertyPage.tsx
'use client';

import React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { DetailPropertyPost } from '../property/components/DetailPropertyPost';
import { RoundTripDetail } from '../property/components/RoundTripDetail';
import { MOCK_PROPERTY_DEMANDS } from '../property/models/property.data';

export const DetailPropertyPage: React.FC = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = (params?.id as string) || '1';
  const tripType = searchParams?.get('tripType');
  const outboundId = searchParams?.get('outboundId') || id;
  const returnId = searchParams?.get('returnId') || outboundId;

  const matchedPost = MOCK_PROPERTY_DEMANDS.find((p) => p.id === id) || MOCK_PROPERTY_DEMANDS[0];

  if (tripType === 'round-trip') {
    const outboundPost = MOCK_PROPERTY_DEMANDS.find((p) => p.id === outboundId) || matchedPost;
    const returnPost = MOCK_PROPERTY_DEMANDS.find((p) => p.id === returnId) || outboundPost;
    return (
      <RoundTripDetail
        outboundPost={outboundPost}
        returnPost={returnPost}
        departureDate={searchParams?.get('price') || ''}
        returnDate={searchParams?.get('returnDate') || ''}
      />
    );
  }

  return <DetailPropertyPost post={matchedPost} />;
};

export default DetailPropertyPage;
