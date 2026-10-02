import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapTripToBookingPost } from '../../../src/features/trips/services/trip-booking-adapter.ts';

test('maps real trip fields into the existing booking UI model without fixture defaults', () => {
  const post = mapTripToBookingPost({
    id: 21,
    code: 'CX-21',
    status: 'CHUA_KHOI_HANH',
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
      capacity: 34,
      amenities: [],
    },
    price: 300000,
    availableSeats: 12,
  });

  assert.deepEqual(post, {
    id: '21',
    title: 'TP.HCM - Đà Lạt',
    needType: 'BUY',
    propertyType: 'Giường nằm',
    price: '300.000 đ',
    minPriceNum: 300000,
    maxPriceNum: 300000,
    area: '',
    location: 'TP.HCM - Đà Lạt',
    province: 'TP.HCM',
    district: 'Đà Lạt',
    description: '',
    timeAgo: '15/10/2026, 22:00',
    createdAt: '2026-10-15T22:00:00.000Z',
    authorName: 'Nhà xe A',
    authorCode: 'CX-21',
    authorPhone: '',
    isVerified: true,
  });
});

test('shows unavailable fare honestly instead of inventing a fallback amount', () => {
  const post = mapTripToBookingPost({
    id: 22,
    code: 'CX-22',
    status: 'CHUA_KHOI_HANH',
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
      capacity: 34,
      amenities: [],
    },
    price: null,
    availableSeats: 12,
  });

  assert.equal(post.price, 'Liên hệ');
  assert.equal(post.minPriceNum, undefined);
  assert.equal(post.maxPriceNum, undefined);
});
