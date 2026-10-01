export type HomeTripType = 'one-way' | 'round-trip';

interface SearchParamsReader {
  get(name: string): string | null;
}

export interface HomeSearchState {
  selectedProvince: string;
  selectedDistrict: string;
  selectedPrice: string;
  tripType: HomeTripType;
  returnDate: string;
  hasSearched: boolean;
  shouldScroll: boolean;
}

interface HomeSearchQueryInput {
  tripType: HomeTripType;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
}

export function buildHomeSearchQuery(input: HomeSearchQueryInput): string {
  const query = new URLSearchParams({
    tripType: input.tripType,
    origin: input.origin,
    destination: input.destination,
    date: input.departureDate,
  });

  if (input.tripType === 'round-trip' && input.returnDate) {
    query.set('returnDate', input.returnDate);
  }

  return query.toString();
}

export function deriveHomeSearchState(
  searchParams: SearchParamsReader,
  initialHasSearched: boolean,
  today: string,
): HomeSearchState {
  const selectedProvince =
    searchParams.get('from') ?? searchParams.get('origin') ?? '';
  const selectedDistrict =
    searchParams.get('to') ?? searchParams.get('destination') ?? '';
  const departureDate =
    searchParams.get('departureDate') ?? searchParams.get('date') ?? '';
  const tripType: HomeTripType =
    searchParams.get('tripType') === 'round-trip' ? 'round-trip' : 'one-way';
  const hasSearchCriteria = Boolean(
    selectedProvince || selectedDistrict || departureDate,
  );

  return {
    selectedProvince,
    selectedDistrict,
    selectedPrice: departureDate || today,
    tripType,
    returnDate:
      tripType === 'round-trip' ? (searchParams.get('returnDate') ?? '') : '',
    hasSearched: initialHasSearched || hasSearchCriteria,
    shouldScroll: hasSearchCriteria,
  };
}
