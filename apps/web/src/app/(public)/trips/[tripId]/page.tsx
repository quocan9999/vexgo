import { OneWayBooking } from '@/features/booking/components/one-way-booking';
import { RoundTripBooking } from '@/features/booking/components/round-trip-booking';
import { POST_FIXTURES } from '@/features/posts/data/post-fixtures';

export default async function TripDetailPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ tripId: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { tripId } = await params;
  const sp = await searchParams;
  
  const tripType = typeof sp?.tripType === 'string' ? sp.tripType : 'one-way';
  const outboundId = typeof sp?.outboundId === 'string' ? sp.outboundId : tripId;
  const returnId = typeof sp?.returnId === 'string' ? sp.returnId : outboundId;
  
  const matchedPost = POST_FIXTURES.find((p) => p.id === tripId) || POST_FIXTURES[0];

  if (tripType === 'round-trip') {
    const outboundPost = POST_FIXTURES.find((p) => p.id === outboundId) || matchedPost;
    const returnPost = POST_FIXTURES.find((p) => p.id === returnId) || outboundPost;
    return (
      <RoundTripBooking
        outboundPost={outboundPost}
        returnPost={returnPost}
        departureDate={typeof sp?.price === 'string' ? sp.price : ''}
        returnDate={typeof sp?.returnDate === 'string' ? sp.returnDate : ''}
      />
    );
  }

  return <OneWayBooking post={matchedPost} />;
}
