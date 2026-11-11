import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCustomerActivityViewState } from '../../../src/features/account/services/customer-activity-view-state.ts';

test('customer activity shows loading while the request is pending', () => {
  assert.equal(resolveCustomerActivityViewState(true, '', 0), 'loading');
});

test('customer activity shows an error instead of an empty state when loading fails', () => {
  assert.equal(
    resolveCustomerActivityViewState(false, 'Không thể tải lịch sử.', 0),
    'error',
  );
});

test('customer activity shows empty only after a successful empty response', () => {
  assert.equal(resolveCustomerActivityViewState(false, '', 0), 'empty');
});

test('customer activity shows data after a successful non-empty response', () => {
  assert.equal(resolveCustomerActivityViewState(false, '', 2), 'data');
});
