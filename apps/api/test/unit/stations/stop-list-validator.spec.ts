import { describe, expect, it } from 'vitest';
import {
  validateStopList,
  type StationValidationInfo,
  type StopListItemInput,
} from '../../../src/stations/stop-list-validator.js';

describe('validateStopList', () => {
  const nhaXeId = 1;

  const mockStations: Map<number, StationValidationInfo> = new Map([
    [
      10,
      {
        diemDonTraId: 10,
        tenDiem: 'Bến xe Miền Đông',
        loaiDiem: 'BEN_XE',
        trangThai: 'HOAT_DONG',
        nhaXeId,
        benTrungChuyenId: null,
      },
    ],
    [
      11,
      {
        diemDonTraId: 11,
        tenDiem: 'Bến xe Vũng Tàu',
        loaiDiem: 'BEN_XE',
        trangThai: 'HOAT_DONG',
        nhaXeId,
        benTrungChuyenId: null,
      },
    ],
    [
      20,
      {
        diemDonTraId: 20,
        tenDiem: 'Trạm dừng Long Thành',
        loaiDiem: 'TRAM_NGHI',
        trangThai: 'HOAT_DONG',
        nhaXeId,
        benTrungChuyenId: null,
      },
    ],
    [
      30,
      {
        diemDonTraId: 30,
        tenDiem: 'Điểm trung chuyển Hàng Xanh',
        loaiDiem: 'TRUNG_CHUYEN',
        trangThai: 'HOAT_DONG',
        nhaXeId,
        benTrungChuyenId: 10, // Trỏ về BX Miền Đông
      },
    ],
    [
      40,
      {
        diemDonTraId: 40,
        tenDiem: 'Bến xe ngưng hoạt động',
        loaiDiem: 'BEN_XE',
        trangThai: 'NGUNG_HOAT_DONG',
        nhaXeId,
        benTrungChuyenId: null,
      },
    ],
    [
      50,
      {
        diemDonTraId: 50,
        tenDiem: 'Bến xe nhà xe khác',
        loaiDiem: 'BEN_XE',
        trangThai: 'HOAT_DONG',
        nhaXeId: 999,
        benTrungChuyenId: null,
      },
    ],
  ]);

  it('passes when stop list is valid with negative/positive phutLech and normal stations', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: -30, thuTu: 1 },
      { diemDonTraId: 20, loaiDiem: 'NGHI', phutLech: 45, thuTu: 2 },
      { diemDonTraId: 11, loaiDiem: 'TRA', phutLech: 120, thuTu: 3 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors).toEqual([]);
  });

  it('allows pickup with positive phutLech and dropoff with negative/zero phutLech', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 15, thuTu: 1 },
      { diemDonTraId: 11, loaiDiem: 'TRA', phutLech: -5, thuTu: 2 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors).toEqual([]);
  });

  it('detects duplicate (diemDonTraId, loaiDiem)', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 0, thuTu: 1 },
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 10, thuTu: 2 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].code).toBe('DUPLICATE_STOP');
    expect(errors[0].index).toBe(1);
  });

  it('allows same station in both DON and TRA', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 0, thuTu: 1 },
      { diemDonTraId: 10, loaiDiem: 'TRA', phutLech: 180, thuTu: 2 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors).toEqual([]);
  });

  it('fails when NGHI role is used for a non-TRAM_NGHI station', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'NGHI', phutLech: 30, thuTu: 1 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'INVALID_REST_STOP_TYPE')).toBe(true);
  });

  it('fails when TRAM_NGHI station is used for DON or TRA', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 20, loaiDiem: 'DON', phutLech: 30, thuTu: 1 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'REST_STOP_CANNOT_BE_PICKUP_DROPOFF')).toBe(true);
  });

  it('fails when station belongs to another operator', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 50, loaiDiem: 'DON', phutLech: 0, thuTu: 1 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'STATION_TENANT_MISMATCH')).toBe(true);
  });

  it('fails when station is inactive', () => {
    const stops: StopListItemInput[] = [
      { diemDonTraId: 40, loaiDiem: 'DON', phutLech: 0, thuTu: 1 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'STATION_INACTIVE')).toBe(true);
  });

  it('validates transfer points: pickup transfer must have phutLech < target station pickup', () => {
    // Target is BX Miền Đông (10), at phutLech 0
    // Hàng Xanh (30) DON at phutLech -45 -> valid!
    const validStops: StopListItemInput[] = [
      { diemDonTraId: 30, loaiDiem: 'DON', phutLech: -45, thuTu: 1 },
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 0, thuTu: 2 },
    ];
    expect(validateStopList(validStops, mockStations, nhaXeId)).toEqual([]);

    // Hàng Xanh (30) DON at phutLech 10 (>= target 0) -> invalid!
    const invalidStops: StopListItemInput[] = [
      { diemDonTraId: 30, loaiDiem: 'DON', phutLech: 10, thuTu: 1 },
      { diemDonTraId: 10, loaiDiem: 'DON', phutLech: 0, thuTu: 2 },
    ];
    const errors = validateStopList(invalidStops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'TRANSFER_PICKUP_TIME_INVALID')).toBe(true);
  });

  it('validates transfer points: dropoff transfer must have phutLech > target station dropoff', () => {
    // Hàng Xanh (30) TRA at phutLech 150, target BX Miền Đông (10) TRA at 120 -> valid!
    const validStops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'TRA', phutLech: 120, thuTu: 1 },
      { diemDonTraId: 30, loaiDiem: 'TRA', phutLech: 150, thuTu: 2 },
    ];
    expect(validateStopList(validStops, mockStations, nhaXeId)).toEqual([]);

    // Hàng Xanh (30) TRA at phutLech 100 (<= target 120) -> invalid!
    const invalidStops: StopListItemInput[] = [
      { diemDonTraId: 10, loaiDiem: 'TRA', phutLech: 120, thuTu: 1 },
      { diemDonTraId: 30, loaiDiem: 'TRA', phutLech: 100, thuTu: 2 },
    ];
    const errors = validateStopList(invalidStops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'TRANSFER_DROPOFF_TIME_INVALID')).toBe(true);
  });

  it('fails when transfer point missing its target station in the same direction', () => {
    // Hàng Xanh (30) DON without BX Miền Đông (10) DON -> missing!
    const stops: StopListItemInput[] = [
      { diemDonTraId: 30, loaiDiem: 'DON', phutLech: -30, thuTu: 1 },
      { diemDonTraId: 11, loaiDiem: 'TRA', phutLech: 120, thuTu: 2 },
    ];

    const errors = validateStopList(stops, mockStations, nhaXeId);
    expect(errors.some((e) => e.code === 'TRANSFER_DESTINATION_MISSING')).toBe(true);
  });
});
