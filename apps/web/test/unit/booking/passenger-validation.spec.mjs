import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validatePassengerInfo,
} from '../../../src/features/booking/utils/passenger-validation.ts';
import {
  canPayForOneWayBooking,
} from '../../../src/features/booking/utils/one-way-booking.ts';
import {
  canPayForRoundTripBooking,
} from '../../../src/features/booking/utils/round-trip-booking.ts';

test('passenger validation rejects empty or whitespace-only name', () => {
  const result = validatePassengerInfo({
    fullName: '   ',
    phoneNumber: '0901234567',
    email: 'test@example.com',
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.fullName, 'Vui lòng nhập họ và tên');
});

test('passenger validation rejects empty phone number', () => {
  const result = validatePassengerInfo({
    fullName: 'Nguyễn Văn A',
    phoneNumber: '',
    email: 'test@example.com',
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.phoneNumber, 'Vui lòng nhập số điện thoại');
});

test('passenger validation rejects invalid phone numbers', () => {
  const invalidPhones = ['12345', 'abcdefghijk', '012345678901', '0201234567'];

  for (const phone of invalidPhones) {
    const result = validatePassengerInfo({
      fullName: 'Nguyễn Văn A',
      phoneNumber: phone,
      email: 'test@example.com',
    });

    assert.equal(result.isValid, false, `Expected ${phone} to be rejected`);
    assert.equal(result.errors.phoneNumber, 'Số điện thoại không hợp lệ');
  }
});

test('passenger validation accepts valid Vietnamese phone numbers', () => {
  const validPhones = ['0901234567', '0381234567', '+84901234567', '0912 345 678'];

  for (const phone of validPhones) {
    const result = validatePassengerInfo({
      fullName: 'Nguyễn Văn A',
      phoneNumber: phone,
      email: 'test@example.com',
    });

    assert.equal(result.isValid, true, `Expected ${phone} to be accepted`);
    assert.equal(result.errors.phoneNumber, undefined);
  }
});

test('passenger validation rejects empty or invalid email', () => {
  const emptyResult = validatePassengerInfo({
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0901234567',
    email: '',
  });
  assert.equal(emptyResult.isValid, false);
  assert.equal(emptyResult.errors.email, 'Vui lòng nhập email');

  const invalidEmails = ['invalid', 'test@', 'test@example', '@example.com'];
  for (const email of invalidEmails) {
    const result = validatePassengerInfo({
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0901234567',
      email,
    });
    assert.equal(result.isValid, false, `Expected ${email} to be rejected`);
    assert.equal(result.errors.email, 'Email không hợp lệ');
  }
});

test('passenger validation passes when all fields are valid', () => {
  const result = validatePassengerInfo({
    fullName: 'Nguyễn Văn An',
    phoneNumber: '0901234567',
    email: 'an.nguyen@example.com',
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test('canPayForOneWayBooking respects passenger validation when passengerInfo is provided', () => {
  assert.equal(
    canPayForOneWayBooking(['A01'], true, {
      fullName: '',
      phoneNumber: '0901234567',
      email: 'valid@example.com',
    }),
    false,
    'Should not allow pay when name is missing',
  );

  assert.equal(
    canPayForOneWayBooking(['A01'], true, {
      fullName: 'Nguyễn Văn A',
      phoneNumber: 'invalid-phone',
      email: 'valid@example.com',
    }),
    false,
    'Should not allow pay when phone is invalid',
  );

  assert.equal(
    canPayForOneWayBooking(['A01'], true, {
      fullName: 'Nguyễn Văn A',
      phoneNumber: '0901234567',
      email: 'valid@example.com',
    }),
    true,
    'Should allow pay when all conditions and passenger info are valid',
  );
});

test('canPayForRoundTripBooking requires both outbound and return seats, accepted terms, and valid passenger info', () => {
  const validPassenger = {
    fullName: 'Nguyễn Văn A',
    phoneNumber: '0901234567',
    email: 'valid@example.com',
  };

  assert.equal(canPayForRoundTripBooking([], ['B01'], true, validPassenger), false);
  assert.equal(canPayForRoundTripBooking(['A01'], [], true, validPassenger), false);
  assert.equal(canPayForRoundTripBooking(['A01'], ['B01'], false, validPassenger), false);
  assert.equal(
    canPayForRoundTripBooking(['A01'], ['B01'], true, {
      fullName: '',
      phoneNumber: '0901234567',
      email: 'valid@example.com',
    }),
    false,
  );
  assert.equal(canPayForRoundTripBooking(['A01'], ['B01'], true, validPassenger), true);
});
