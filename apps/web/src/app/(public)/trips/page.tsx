import { TripSearchForm } from '@/features/trips/components/trip-search-form';
import { TripList } from '@/features/trips/components/trip-list';

export default function TripsPage() {
  return <><div className="bg-slate-50 px-4 pb-2 pt-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><TripSearchForm compact /></div></div><TripList /></>;
}
