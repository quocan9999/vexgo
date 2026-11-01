export const STATION_STATUSES = ['HOAT_DONG', 'NGUNG_HOAT_DONG'] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

export const STATION_TYPES = [
  'BEN_XE',
  'VAN_PHONG',
  'DIEM_DON_TRA',
  'TRUNG_CHUYEN',
  'TRAM_NGHI',
] as const;
export type StationType = (typeof STATION_TYPES)[number];

export const POINT_ROLES = ['DON', 'TRA', 'NGHI'] as const;
export type PointRole = (typeof POINT_ROLES)[number];

export const POINT_CUTOFF_MINUTES = 30;
export const DEFAULT_PRESENCE_MINUTES = 15;
