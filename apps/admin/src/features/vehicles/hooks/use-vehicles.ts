import { useEffect, useState } from 'react';
import { getVehicles } from '../services/vehicle-service';
import type { VehicleListQuery } from '../types/vehicle';

export type VehiclesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      result: Awaited<ReturnType<typeof getVehicles>>;
    };

type ResolvedVehiclesState = Exclude<VehiclesState, { status: 'loading' }>;

function getRequestErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error ? error.message : 'Không thể tải danh sách xe.';
}

export function useVehicles(query: VehicleListQuery) {
  const {
    page,
    pageSize,
    search,
    sortBy,
    sortDirection,
    status,
    busCompanyId,
    vehicleTypeId,
  } = query;
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedState, setResolvedState] = useState<{
    requestKey: string;
    state: ResolvedVehiclesState;
  } | null>(null);
  const requestKey = JSON.stringify([
    page,
    pageSize,
    search,
    sortBy,
    sortDirection,
    status,
    busCompanyId,
    vehicleTypeId,
    retryCount,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    getVehicles(
      {
        page,
        pageSize,
        search,
        sortBy,
        sortDirection,
        status,
        busCompanyId,
        vehicleTypeId,
      },
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
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setResolvedState({
            requestKey,
            state: { status: 'error', message: getRequestErrorMessage(error) },
          });
        }
      });

    return () => controller.abort();
  }, [
    page,
    pageSize,
    search,
    sortBy,
    sortDirection,
    status,
    busCompanyId,
    vehicleTypeId,
    requestKey,
  ]);

  const state: VehiclesState =
    resolvedState?.requestKey === requestKey
      ? resolvedState.state
      : { status: 'loading' };

  function refresh() {
    setRetryCount((count) => count + 1);
  }

  return { state, refresh };
}
