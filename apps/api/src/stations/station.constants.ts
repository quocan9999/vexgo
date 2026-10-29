export const STATION_STATUSES = ['HOAT_DONG', 'NGUNG_HOAT_DONG'] as const;
export type StationStatus = (typeof STATION_STATUSES)[number];

export const STATION_TYPES = ['BEN_XE', 'VAN_PHONG', 'DIEM_DON_TRA'] as const;
export type StationType = (typeof STATION_TYPES)[number];
