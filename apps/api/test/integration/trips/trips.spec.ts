import { type INestApplication, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsModule } from '../../../src/trips/trips.module.js';
import { TripsService } from '../../../src/trips/trips.service.js';

describe('Trips HTTP contract (mocked service)', () => {
  let app: INestApplication;
  const service = { search: vi.fn(), getDetails: vi.fn(), getSeats: vi.fn() };
  const trip = {
    id: 21,
    code: 'CX-21',
    status: 'MO_BAN',
    busCompany: {
      id: 3,
      name: 'Nhà xe A',
      logo: null,
      rating: null,
      reviewsCount: null,
    },
    route: {
      id: 8,
      code: 'SG-DL',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
      distance: null,
      durationMinutes: null,
    },
    departureTime: '2026-10-15T22:00:00.000Z',
    arrivalTime: null,
    vehicle: {
      id: 4,
      typeId: 2,
      type: 'Giường nằm',
      licensePlate: '51B-12345',
      capacity: 2,
      amenities: [],
    },
    price: 300000,
    availableSeats: 1,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TripsModule],
      providers: [
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    })
      .overrideProvider(TripsService)
      .useValue(service)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    service.search.mockResolvedValue({
      data: [trip],
      meta: { page: 2, pageSize: 5, totalItems: 6, totalPages: 2 },
    });
    service.getDetails.mockResolvedValue(trip);
  });

  it('passes the documented search query with transformed numeric fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/trips/search')
      .query({
        from: 'TP.HCM',
        to: 'Đà Lạt',
        departureDate: '2026-10-15',
        busCompanyId: '3',
        vehicleTypeId: '2',
        minPrice: '100000',
        maxPrice: '500000',
        page: '2',
        pageSize: '5',
        sortBy: 'price',
        sortDirection: 'desc',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: [trip],
      meta: { page: 2, pageSize: 5, totalItems: 6, totalPages: 2 },
    });
    expect(service.search).toHaveBeenCalledWith({
      from: 'TP.HCM',
      to: 'Đà Lạt',
      departureDate: '2026-10-15',
      busCompanyId: 3,
      vehicleTypeId: 2,
      minPrice: 100000,
      maxPrice: 500000,
      page: 2,
      pageSize: 5,
      sortBy: 'price',
      sortDirection: 'desc',
    });
  });

  it.each([
    ['departureDate', '15-10-2026'],
    ['busCompanyId', '0'],
    ['vehicleTypeId', 'abc'],
    ['minPrice', '-1'],
    ['maxPrice', '1e6'],
    ['page', '0'],
    ['pageSize', '101'],
    ['sortBy', 'rating'],
    ['sortDirection', 'up'],
    ['unknown', 'value'],
  ])('rejects invalid %s=%s before searching', async (field, value) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/trips/search')
      .query({ [field]: value })
      .expect(400);

    expect(response.body.error).toBe('VALIDATION_ERROR');
    expect(service.search).not.toHaveBeenCalled();
  });

  it('returns trip detail through the common data envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/trips/21')
      .expect(200);

    expect(response.body).toEqual({ data: trip });
    expect(service.getDetails).toHaveBeenCalledWith(21);
  });

  it('keeps the documented trip-not-found error', async () => {
    service.getDetails.mockRejectedValueOnce(
      new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/trips/999')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'TRIP_NOT_FOUND',
      message: 'Không tìm thấy chuyến xe.',
    });
  });
});
