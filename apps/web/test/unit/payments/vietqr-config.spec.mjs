import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createVietQrImageUrl,
  readVietQrAccountConfig,
} from '../../../src/features/payments/services/vietqr-config.ts';

test('VietQR config is unavailable when a required value is missing or invalid', () => {
  assert.equal(
    readVietQrAccountConfig({
      bankId: undefined,
      accountNumber: '123456789',
      accountName: 'Nguyễn Văn A',
    }),
    null,
  );
  assert.equal(
    readVietQrAccountConfig({
      bankId: 'ACB',
      accountNumber: 'ACCT-12345',
      accountName: 'Nguyễn Văn A',
    }),
    null,
  );
  assert.equal(
    readVietQrAccountConfig({
      bankId: 'ACB',
      accountNumber: '12345678901234567890',
      accountName: 'Nguyễn Văn A',
    }),
    null,
  );
  assert.equal(
    readVietQrAccountConfig({
      bankId: 'ACB',
      accountNumber: '123456789',
      accountName: '   ',
    }),
    null,
  );
});

test('VietQR config accepts an alphanumeric virtual account identifier', () => {
  assert.deepEqual(
    readVietQrAccountConfig({
      bankId: 'ACB',
      accountNumber: 'VA123456',
      accountName: 'Nguyễn Văn A',
    }),
    {
      bankId: 'ACB',
      accountNumber: 'VA123456',
      accountName: 'Nguyễn Văn A',
    },
  );
});

test('VietQR config accepts a bank short name longer than a short bank code', () => {
  const config = readVietQrAccountConfig({
    bankId: 'LienVietPostBank',
    accountNumber: 'VA123456',
    accountName: 'Nguyễn Văn A',
  });

  assert.equal(config?.bankId, 'LienVietPostBank');
});

test('VietQR config trims values and builds the existing amount and transfer memo URL', () => {
  const config = readVietQrAccountConfig({
    bankId: ' ACB ',
    accountNumber: ' 123456789 ',
    accountName: ' Nguyễn Văn A ',
  });

  assert.deepEqual(config, {
    bankId: 'ACB',
    accountNumber: '123456789',
    accountName: 'Nguyễn Văn A',
  });

  const imageUrl = createVietQrImageUrl(config, 620000, 'VEXGO BK-123');
  assert.ok(imageUrl);

  const url = new URL(imageUrl);
  assert.equal(url.origin, 'https://img.vietqr.io');
  assert.equal(url.pathname, '/image/ACB-123456789-compact2.png');
  assert.equal(url.searchParams.get('amount'), '620000');
  assert.equal(url.searchParams.get('addInfo'), 'VEXGO BK-123');
  assert.equal(url.searchParams.get('accountName'), 'Nguyễn Văn A');
});

test('VietQR image URL is not created without validated account configuration', () => {
  assert.equal(createVietQrImageUrl(null, 250000, 'VEXGO BK-456'), null);
});
