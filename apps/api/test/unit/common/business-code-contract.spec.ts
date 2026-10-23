import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Reflector } from '@nestjs/core';
import { describe, it, expect } from 'vitest';
import { CreateRouteDto } from '../../../src/routes/dto/create-route.dto.js';
import { CreateTripDto } from '../../../src/trips/dto/create-trip.dto.js';
import { TripCodeQueryDto } from '../../../src/trips/dto/trip-code-query.dto.js';
import { RoutesController } from '../../../src/routes/routes.controller.js';
import { TripsController } from '../../../src/trips/trips.controller.js';
import { AuthorizationGuard } from '../../../src/auth/guards/authorization.guard.js';

describe('automatic code API contract', () => {
  it('accepts create requests without client-generated codes', () => {
    expect(validateSync(plainToInstance(CreateRouteDto, { origin: 'A', destination: 'B', durationMinutes: 60, busCompanyId: 3, status: 'HOAT_DONG' }))).toEqual([]);
    expect(validateSync(plainToInstance(CreateTripDto, { routeId: 1, vehicleId: 2, departureDate: '2026-10-23', departureTime: '08:00:00' }))).toEqual([]);
  });
  it.each(['2026-02-30', '2026-10-23T00:00:00Z', '23/10/2026', undefined])('rejects invalid preview date %s', (departureDate) => {
    expect(validateSync(plainToInstance(TripCodeQueryDto, { departureDate })).length).toBeGreaterThan(0);
  });
  it.each([
    { controller: RoutesController, permission: 'route:create' },
    { controller: TripsController, permission: 'trip:create' },
  ])('requires create permission and tenant role for $permission preview', ({ controller, permission }) => {
    function authorize(roles: string[], permissions: string[]) {
      return new AuthorizationGuard(new Reflector()).canActivate({
        getType: () => 'http',
        getHandler: () => controller.prototype.previewCode,
        getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => ({ user: { taiKhoanId: 1, nhanVienId: 2, sessionId: 'unit', nhaXeId: 3, roles, permissions } }) }),
      } as never);
    }
    expect(authorize(['NHA_XE_ADMIN'], [permission])).toBe(true);
    expect(() => authorize(['NHA_XE_ADMIN'], [])).toThrow();
    expect(() => authorize(['KHACH_HANG'], [permission])).toThrow();
  });
});
