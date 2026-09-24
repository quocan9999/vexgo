export const VEHICLE_STATUSES = ['HOAT_DONG', 'BAO_TRI'] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
