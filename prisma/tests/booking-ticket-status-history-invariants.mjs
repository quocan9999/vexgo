export const UUID_V1_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BACKFILL_REASON = 'Khởi tạo lịch sử trạng thái từ dữ liệu hiện có';

export function assertHistoryCollectionValid(records, entityIdField, label) {
  const seen = new Set();

  for (const record of records) {
    if (!UUID_V1_PATTERN.test(record.maThaoTac)) {
      throw new Error(`${label} contains a non-UUID-v1 maThaoTac.`);
    }

    if (!['CUSTOMER', 'STAFF', 'SYSTEM'].includes(record.nguonThayDoi)) {
      throw new Error(`${label} contains an invalid nguonThayDoi.`);
    }

    if (
      (['CUSTOMER', 'STAFF'].includes(record.nguonThayDoi) &&
        record.taiKhoanId === null) ||
      (record.nguonThayDoi === 'SYSTEM' && record.taiKhoanId !== null)
    ) {
      throw new Error(`${label} has a taiKhoanId inconsistent with nguonThayDoi.`);
    }

    if (record.laOverride && record.nguonThayDoi !== 'STAFF') {
      throw new Error(`${label} has laOverride=true for a non-STAFF source.`);
    }

    if (
      record.trangThaiCu !== null &&
      record.trangThaiCu === record.trangThaiMoi
    ) {
      throw new Error(`${label} contains a transition with identical old and new status.`);
    }

    const key = `${record[entityIdField]}\u0000${record.maThaoTac}`;
    if (seen.has(key)) {
      throw new Error(`${label} repeats maThaoTac for the same entity.`);
    }
    seen.add(key);
  }
}

export function assertHistoryDataValid(bookingRecords, ticketRecords) {
  assertHistoryCollectionValid(
    bookingRecords,
    'phieuDatVeId',
    'LichSuTrangThaiPhieuDatVe',
  );
  assertHistoryCollectionValid(ticketRecords, 'veId', 'LichSuTrangThaiVe');
}

export function countBaselineShapedRecords(records) {
  return records.filter(
    (record) =>
      record.trangThaiCu === null &&
      record.nguonThayDoi === 'SYSTEM' &&
      record.taiKhoanId === null &&
      !record.laOverride &&
      record.lyDo === BACKFILL_REASON,
  ).length;
}
