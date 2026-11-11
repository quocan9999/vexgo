import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';

export type LuggagePackagePricing = {
  packageS: number;
  packageSMaxKg?: number;
  packageM: number;
  packageMMaxKg?: number;
  packageL: number;
  packageLMaxKg?: number;
  packageXL: number;
  packageXLMaxKg?: number;
  motorcycleWave?: number;
  motorcycleScooter?: number;
  motorcycleBig?: number;
  bicycle?: number;
  fragileSurcharge?: number;
  valuableSurcharge?: number;
  maxFreeWeightKg?: number;
};

export type RouteLuggageRateOverride = Partial<LuggagePackagePricing> & {
  inherit: boolean;
};

export type AvailableRouteItem = {
  routeId: number;
  code: string;
  origin: string;
  destination: string;
  hasOverride: boolean;
};

export type BusCompanyLuggageRatesData = {
  busCompanyId: number;
  busCompanyName: string;
  default: LuggagePackagePricing;
  routes: Record<string, RouteLuggageRateOverride>;
  availableRoutes: AvailableRouteItem[];
};

export const DEFAULT_VEXGO_LUGGAGE_RATES: LuggagePackagePricing = {
  packageS: 50_000,
  packageSMaxKg: 5,
  packageM: 80_000,
  packageMMaxKg: 10,
  packageL: 120_000,
  packageLMaxKg: 20,
  packageXL: 180_000,
  packageXLMaxKg: 35,
  motorcycleWave: 180_000,
  motorcycleScooter: 220_000,
  motorcycleBig: 250_000,
  bicycle: 80_000,
  fragileSurcharge: 20_000,
  valuableSurcharge: 50_000,
  maxFreeWeightKg: 7,
};

export async function getBusCompanyLuggageRates(
  signal?: AbortSignal,
): Promise<BusCompanyLuggageRatesData> {
  const url = `${getApiBaseUrl()}/api/v1/bus-companies/my/luggage-rates`;

  const response = await adminApiFetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    let msg = 'Unable to load luggage rate configuration.';
    try {
      const err = await response.json();
      if (err?.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }

  const json = await response.json();
  return json.data;
}

export async function updateBusCompanyLuggageRates(
  payload: {
    default: LuggagePackagePricing;
    routes?: Record<string, RouteLuggageRateOverride>;
  },
  signal?: AbortSignal,
): Promise<BusCompanyLuggageRatesData> {
  const url = `${getApiBaseUrl()}/api/v1/bus-companies/my/luggage-rates`;

  const response = await adminApiFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let msg = 'Unable to update luggage rate configuration.';
    try {
      const err = await response.json();
      if (err?.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }

  const json = await response.json();
  return json.data;
}
