import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateUntouchedProfileField } from '../../../src/features/booking/utils/profile-hydration.ts';

test('profile hydration preserves a passenger value typed while the request is pending', () => {
  assert.equal(
    hydrateUntouchedProfileField('Tên khách vừa nhập', 'Tên trong hồ sơ'),
    'Tên khách vừa nhập',
  );
  assert.equal(
    hydrateUntouchedProfileField('0912345678', '0901234567'),
    '0912345678',
  );
});

test('profile hydration fills an untouched passenger field', () => {
  assert.equal(
    hydrateUntouchedProfileField(null, 'Tên trong hồ sơ'),
    'Tên trong hồ sơ',
  );
  assert.equal(hydrateUntouchedProfileField(null, null), null);
});
