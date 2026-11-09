// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import viMessages from '../src/messages/vi.json';
import enMessages from '../src/messages/en.json';

describe('Operations i18n dictionaries (Phase 2)', () => {
  describe('Routes namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.routes.routesTitle).toBe('Quản lý tuyến xe');
      expect(enMessages.routes.routesTitle).toBe('Route Management');

      expect(viMessages.routes.createRoute).toBe('Thêm tuyến');
      expect(enMessages.routes.createRoute).toBe('Add Route');

      expect(viMessages.routes.routeCode).toBe('Mã tuyến');
      expect(enMessages.routes.routeCode).toBe('Route Code');

      expect(viMessages.routes.active).toBe('Đang hoạt động');
      expect(enMessages.routes.active).toBe('In Service');

      expect(viMessages.routes.inactive).toBe('Tạm ngưng');
      expect(enMessages.routes.inactive).toBe('Suspended');
    });
  });

  describe('Stations namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.stations.stationsTitle).toBe('Bến bãi & Điểm đón trả');
      expect(enMessages.stations.stationsTitle).toBe('Stations & Stops');

      expect(viMessages.stations.createStation).toBe('Thêm bến xe');
      expect(enMessages.stations.createStation).toBe('Add Station');

      expect(viMessages.stations.addStop).toBe('Thêm điểm đón trả');
      expect(enMessages.stations.addStop).toBe('Add Stop Point');

      expect(viMessages.stations.stationName).toBe('Tên bến xe');
      expect(enMessages.stations.stationName).toBe('Station Name');
    });
  });

  describe('Trips namespace', () => {
    it('provides complete and matching keys in Vietnamese and English', () => {
      expect(viMessages.trips.tripsTitle).toBe('Quản lý chuyến xe');
      expect(enMessages.trips.tripsTitle).toBe('Trip Management');

      expect(viMessages.trips.createTrip).toBe('Thêm chuyến');
      expect(enMessages.trips.createTrip).toBe('Add Trip');

      expect(viMessages.trips.tripCode).toBe('Mã chuyến');
      expect(enMessages.trips.tripCode).toBe('Trip Code');

      expect(viMessages.trips.departureDate).toBe('Ngày khởi hành');
      expect(enMessages.trips.departureDate).toBe('Departure Date');

      expect(viMessages.trips.seatMap).toBe('Sơ đồ ghế');
      expect(enMessages.trips.seatMap).toBe('Seat Map');

      expect(viMessages.trips.manifest).toBe('Lệnh xuất bến & Danh sách hành khách');
      expect(enMessages.trips.manifest).toBe('Trip Manifest & Passenger List');
    });
  });
});
