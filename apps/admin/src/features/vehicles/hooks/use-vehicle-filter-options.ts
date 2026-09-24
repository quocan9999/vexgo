import { useEffect, useState } from 'react';
import {
  getAllBusCompanyOptions,
  getAllVehicleTypeOptions,
} from '../services/vehicle-service';
import type { BusCompany } from '@/features/bus-companies/types/bus-company';
import type { VehicleType } from '@/features/vehicle-types/types/vehicle-type';

type LookupState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T[] };

type VehicleFilterOptions = {
  busCompanies: LookupState<BusCompany>;
  vehicleTypes: LookupState<VehicleType>;
};

function getRequestErrorMessage(error: unknown, subject: string) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử lại.';
  }
  return error instanceof Error
    ? error.message
    : `Không thể tải danh sách ${subject}.`;
}

export function useVehicleFilterOptions() {
  const [retryCount, setRetryCount] = useState(0);
  const [resolvedState, setResolvedState] = useState<{
    requestKey: number;
    state: VehicleFilterOptions;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      getAllBusCompanyOptions(controller.signal),
      getAllVehicleTypeOptions(controller.signal),
    ]).then(([busCompanyResult, vehicleTypeResult]) => {
      if (controller.signal.aborted) return;

      setResolvedState({
        requestKey: retryCount,
        state: {
          busCompanies:
            busCompanyResult.status === 'fulfilled'
              ? { status: 'success', data: busCompanyResult.value }
              : {
                  status: 'error',
                  message: getRequestErrorMessage(
                    busCompanyResult.reason,
                    'nhà xe',
                  ),
                },
          vehicleTypes:
            vehicleTypeResult.status === 'fulfilled'
              ? { status: 'success', data: vehicleTypeResult.value }
              : {
                  status: 'error',
                  message: getRequestErrorMessage(
                    vehicleTypeResult.reason,
                    'loại xe',
                  ),
                },
        },
      });
    });

    return () => controller.abort();
  }, [retryCount]);

  const state =
    resolvedState?.requestKey === retryCount
      ? resolvedState.state
      : {
          busCompanies: { status: 'loading' } as const,
          vehicleTypes: { status: 'loading' } as const,
        };

  function retry() {
    setRetryCount((count) => count + 1);
  }

  return { state, retry };
}
