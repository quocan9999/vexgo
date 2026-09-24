import { useEffect, useState } from 'react';
import { getVehicleTypes } from '../services/vehicle-type-service';
import type {
  PaginatedVehicleTypes,
  VehicleTypeListQuery,
} from '../types/vehicle-type';

export type VehicleTypesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: PaginatedVehicleTypes };

type ResolvedVehicleTypesState = Exclude<VehicleTypesState, { status: 'loading' }>;

export function useVehicleTypes(query: VehicleTypeListQuery) {
  const { page, pageSize, search, sortBy, sortDirection } = query;
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedState, setResolvedState] = useState<{
    requestKey: string;
    state: ResolvedVehicleTypesState;
  } | null>(null);
  const requestKey = JSON.stringify([
    page,
    pageSize,
    search,
    sortBy,
    sortDirection,
    retryCount,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    getVehicleTypes(
      { page, pageSize, search, sortBy, sortDirection },
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setResolvedState({
            requestKey,
            state: { status: 'success', result },
          });
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setResolvedState({
            requestKey,
            state: {
              status: 'error',
              message:
                requestError instanceof TypeError
                  ? 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.'
                  : requestError instanceof Error
                    ? requestError.message
                    : 'Không thể tải danh sách loại xe.',
            },
          });
        }
      });

    return () => controller.abort();
  }, [page, pageSize, search, sortBy, sortDirection, requestKey]);

  const state: VehicleTypesState =
    resolvedState?.requestKey === requestKey
      ? resolvedState.state
      : { status: 'loading' };

  function refresh() {
    setRetryCount((count) => count + 1);
  }

  return { state, refresh };
}
