import assert from 'node:assert/strict';
import test from 'node:test';
import { assertHistoryDataValid } from './booking-ticket-status-history-invariants.mjs';

const baseline = (entityId, operation, overrides = {}) => ({
  phieuDatVeId: entityId,
  veId: entityId,
  maThaoTac: operation,
  trangThaiCu: null,
  trangThaiMoi: 'CHO_THANH_TOAN',
  nguonThayDoi: 'SYSTEM',
  taiKhoanId: null,
  laOverride: false,
  lyDo: 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có',
  ...overrides,
});

const transition = (entityId, operation, overrides = {}) => ({
  phieuDatVeId: entityId,
  veId: entityId,
  maThaoTac: operation,
  trangThaiCu: 'CHO_THANH_TOAN',
  trangThaiMoi: 'DA_XAC_NHAN',
  nguonThayDoi: 'STAFF',
  taiKhoanId: 7,
  laOverride: false,
  lyDo: 'Xác nhận nghiệp vụ',
  ...overrides,
});

const ids = {
  baselineBooking: 'f47ac10b-58cc-11cf-a447-001122334455',
  baselineTicket1: 'a7c12d90-7a11-11ef-8abc-0242ac120002',
  baselineTicket2: 'b3c81234-8abc-11ef-9def-001122334455',
  sharedTransition: 'd7c12d90-7a11-11ef-8abc-0242ac120002',
};

test('accepts baselines, multiple transitions per entity, and an operation shared across entities', () => {
  assert.doesNotThrow(() =>
    assertHistoryDataValid(
      [
        baseline(10, ids.baselineBooking),
        transition(10, ids.sharedTransition),
      ],
      [
        baseline(20, ids.baselineTicket1),
        transition(20, ids.sharedTransition),
        baseline(21, ids.baselineTicket2),
        transition(21, ids.sharedTransition),
      ],
    ),
  );
});

test('rejects UUID v4 operation identifiers', () => {
  const invalid = transition(10, '550e8400-e29b-41d4-a716-446655440000');
  assert.throws(() => assertHistoryDataValid([invalid], []), /non-UUID-v1/);
});

test('rejects invalid source and source/account combinations', () => {
  assert.throws(
    () =>
      assertHistoryDataValid(
        [transition(10, ids.sharedTransition, { nguonThayDoi: 'ROBOT' })],
        [],
      ),
    /invalid nguonThayDoi/,
  );
  assert.throws(
    () =>
      assertHistoryDataValid(
        [transition(10, ids.sharedTransition, { taiKhoanId: null })],
        [],
      ),
    /taiKhoanId inconsistent/,
  );
  assert.throws(
    () =>
      assertHistoryDataValid(
        [],
        [
          baseline(20, ids.baselineTicket1, {
            nguonThayDoi: 'SYSTEM',
            taiKhoanId: 7,
          }),
        ],
      ),
    /taiKhoanId inconsistent/,
  );
});

test('rejects override except for STAFF', () => {
  assert.throws(
    () =>
      assertHistoryDataValid(
        [
          transition(10, ids.sharedTransition, {
            nguonThayDoi: 'CUSTOMER',
            laOverride: true,
          }),
        ],
        [],
      ),
    /laOverride=true/,
  );
});

test('rejects a transition whose old and new status are equal', () => {
  assert.throws(
    () =>
      assertHistoryDataValid(
        [
          transition(10, ids.sharedTransition, {
            trangThaiMoi: 'CHO_THANH_TOAN',
          }),
        ],
        [],
      ),
    /identical old and new status/,
  );
});

test('enforces operation uniqueness within each booking and ticket only', () => {
  assert.throws(
    () =>
      assertHistoryDataValid(
        [baseline(10, ids.baselineBooking), transition(10, ids.baselineBooking)],
        [],
      ),
    /repeats maThaoTac for the same entity/,
  );
  assert.throws(
    () =>
      assertHistoryDataValid(
        [],
        [
          baseline(20, ids.baselineTicket1),
          transition(20, ids.baselineTicket1),
        ],
      ),
    /repeats maThaoTac for the same entity/,
  );
});
