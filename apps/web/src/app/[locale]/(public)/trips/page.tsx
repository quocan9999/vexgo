import { TripSearchBanner } from '@/features/trips/components/trip-search-banner';
import { TripList } from '@/features/trips/components/trip-list';
import { Suspense } from 'react';

export default function TripsPage() {
  return (
    <>
      <Suspense fallback={<div className="h-[480px] bg-slate-900 w-full" />}>
        <TripSearchBanner />
      </Suspense>
      <Suspense fallback={<div className="p-12 text-center text-slate-500 font-medium">Đang tải dữ liệu chuyến xe...</div>}>
        <TripList />
      </Suspense>
    </>
  );
}
