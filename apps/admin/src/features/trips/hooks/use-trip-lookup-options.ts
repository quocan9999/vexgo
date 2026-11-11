'use client';

import { useEffect, useState } from 'react';
import {
  getTripRouteOptions,
  getTripVehicleOptions,
} from '../services/trip-service';
import type { TripLookupOptionsState } from '../types/trip';

function errorMessage(error: unknown, resource: string) {
  if (error instanceof TypeError) {
    return 'Không thể kết nối đến máy chủ API. Vui lòng thử tải lại.';
  }
  return error instanceof Error
    ? error.message
    : `Không thể tải tùy chọn ${resource}.`;
}

export function useTripLookupOptions() {
  const [routeOptions, setRouteOptions] = useState<TripLookupOptionsState>({
    status: 'loading',
  });
  const [vehicleOptions, setVehicleOptions] = useState<TripLookupOptionsState>({
    status: 'loading',
  });
  const [retryRoutesCount, setRetryRoutesCount] = useState(0);
  const [retryVehiclesCount, setRetryVehiclesCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getTripRouteOptions(controller.signal)
      .then((options) => {
        if (current) setRouteOptions({ status: 'success', options });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setRouteOptions({
            status: 'error',
            message: errorMessage(error, 'tuyến xe'),
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryRoutesCount]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;

    getTripVehicleOptions(controller.signal)
      .then((options) => {
        if (current) setVehicleOptions({ status: 'success', options });
      })
      .catch((error: unknown) => {
        if (current && !controller.signal.aborted) {
          setVehicleOptions({
            status: 'error',
            message: errorMessage(error, 'phương tiện'),
          });
        }
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [retryVehiclesCount]);

  function retryRoutes() {
    setRouteOptions({ status: 'loading' });
    setRetryRoutesCount((c) => c + 1);
  }

  function retryVehicles() {
    setVehicleOptions({ status: 'loading' });
    setRetryVehiclesCount((c) => c + 1);
  }

  function retryAll() {
    retryRoutes();
    retryVehicles();
  }

  return {
    routeOptions,
    vehicleOptions,
    retryRoutes,
    retryVehicles,
    retryAll,
  };
}
