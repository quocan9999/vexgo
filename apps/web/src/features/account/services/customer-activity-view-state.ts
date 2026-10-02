export type CustomerActivityViewState = 'loading' | 'error' | 'empty' | 'data';

export function resolveCustomerActivityViewState(
  isLoading: boolean,
  errorMessage: string,
  itemCount: number,
): CustomerActivityViewState {
  if (isLoading) return 'loading';
  if (errorMessage) return 'error';
  return itemCount === 0 ? 'empty' : 'data';
}
