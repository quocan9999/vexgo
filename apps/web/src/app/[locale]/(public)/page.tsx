import { Suspense } from 'react';
import { HomePage } from '@/features/home/components/home-page';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const initialHasSearched = Boolean(query.origin || query.destination || query.date);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePage initialHasSearched={initialHasSearched} />
    </Suspense>
  );
}
