'use client';

import { useEffect, useState } from 'react';
import {
  getBusCompanyFilterOptions,
  getVehicleTypeFilterOptions,
} from '../services/vehicle-service';
import type { VehicleFilterOption } from '../types/vehicle';

type OptionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; options: VehicleFilterOption[] };

function errorMessage(error: unknown, resource: string) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử tải lại.';
  }
  return error instanceof Error
    ? error.message
    : `Không thể tải tùy chọn ${resource}.`;
}

export function useVehicleFilterOptions() {
  const [busCompanies, setBusCompanies] = useState<OptionState>({
    status: 'loading',
  });
  const [vehicleTypes, setVehicleTypes] = useState<OptionState>({
    status: 'loading',
  });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getBusCompanyFilterOptions(controller.signal)
      .then((options) => {
        if (current) setBusCompanies({ status: 'success', options });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setBusCompanies({
            status: 'error',
            message: errorMessage(error, 'nhà xe'),
          });
        }
      });

    getVehicleTypeFilterOptions(controller.signal)
      .then((options) => {
        if (current) setVehicleTypes({ status: 'success', options });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setVehicleTypes({
            status: 'error',
            message: errorMessage(error, 'loại xe'),
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryCount]);

  function retry() {
    setBusCompanies({ status: 'loading' });
    setVehicleTypes({ status: 'loading' });
    setRetryCount((count) => count + 1);
  }

  return { busCompanies, vehicleTypes, retry };
}
