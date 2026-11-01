import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeName,
  normalizeProvinceName,
  matchProvince,
  mapLoaiDiem,
  normalizePhone,
  formatAddress,
  deduplicateFixedPoints,
  generateRoutePointMaDiem,
  buildRouteTemplates,
} from '../lib/crawled-data.mjs';

test('normalizeName: strips accents, lowercases, collapses whitespace', () => {
  assert.equal(normalizeName('Bến Xe Miền Tây'), 'ben xe mien tay');
  assert.equal(normalizeName('  Đà   Lạt  '), 'da lat');
  assert.equal(normalizeName('Thành phố Hồ Chí Minh'), 'thanh pho ho chi minh');
});

test('normalizeProvinceName: handles "Bà Rịa-Vũng Tàu" and "Thừa Thiên Huế" -> "Huế"', () => {
  // Hyphen and spacing variations
  assert.equal(normalizeProvinceName('Bà Rịa-Vũng Tàu'), 'ba ria vung tau');
  assert.equal(normalizeProvinceName('Bà Rịa - Vũng Tàu'), 'ba ria vung tau');
  assert.equal(normalizeProvinceName('Tỉnh Bà Rịa - Vũng Tàu'), 'ba ria vung tau');

  // Thua Thien Hue -> matches hue
  assert.equal(normalizeProvinceName('Thừa Thiên Huế'), 'hue');
  assert.equal(normalizeProvinceName('Tỉnh Thừa Thiên Huế'), 'hue');
  assert.equal(normalizeProvinceName('Thành phố Huế'), 'hue');
  assert.equal(normalizeProvinceName('Huế'), 'hue');
});

test('matchProvince: maps by tinhThanh, fallbacks to quanHuyen when tinhThanh is null', () => {
  const provinceLookup = new Map([
    ['ho chi minh', { diaDiemId: 79, tenDiaDiem: 'Thành phố Hồ Chí Minh' }],
    ['dong thap', { diaDiemId: 87, tenDiaDiem: 'Tỉnh Đồng Tháp' }],
    ['ba ria vung tau', { diaDiemId: 77, tenDiaDiem: 'Tỉnh Bà Rịa - Vũng Tàu' }],
    ['hue', { diaDiemId: 46, tenDiaDiem: 'Thành phố Huế' }],
  ]);

  // Normal matching by tinhThanh
  const r1 = matchProvince('Hồ Chí Minh', 'Quận 1', provinceLookup);
  assert.equal(r1?.diaDiemId, 79);

  // tinhThanh is null, quanHuyen has province name "Đồng Tháp"
  const r2 = matchProvince(null, 'Đồng Tháp', provinceLookup);
  assert.equal(r2?.diaDiemId, 87);

  // Thừa Thiên Huế
  const r3 = matchProvince('Thừa Thiên Huế', 'Huế', provinceLookup);
  assert.equal(r3?.diaDiemId, 46);

  // Cannot map when both null or unknown
  const r4 = matchProvince(null, null, provinceLookup);
  assert.equal(r4, null);

  const r5 = matchProvince('Sao Hỏa', 'Vùng Đỏ', provinceLookup);
  assert.equal(r5, null);
});

test('mapLoaiDiem: maps source loaiDiem correctly', () => {
  assert.equal(mapLoaiDiem('BEN_XE'), 'BEN_XE');
  assert.equal(mapLoaiDiem('VAN_PHONG'), 'VAN_PHONG');
  assert.equal(mapLoaiDiem('DIEM_DON_TRA'), 'DIEM_DON_TRA');
  assert.equal(mapLoaiDiem('TRAM_DUNG'), 'TRAM_NGHI');
});

test('normalizePhone: extracts first phone before comma and enforces <= 20 chars', () => {
  assert.equal(normalizePhone('1900 6079'), '1900 6079');
  assert.equal(normalizePhone('1900 1026, 02923 699 777'), '1900 1026');
  assert.equal(normalizePhone('02838 333 999, 1900 6079'), '02838 333 999');
  assert.equal(normalizePhone(null), null);
});

test('formatAddress: appends quanHuyen and tinhThanh if missing, max <= 255 chars', () => {
  const addr1 = formatAddress('192 Nam Kỳ Khởi Nghĩa', 'Vũng Tàu', 'Bà Rịa-Vũng Tàu');
  assert.equal(addr1, '192 Nam Kỳ Khởi Nghĩa, Vũng Tàu, Bà Rịa-Vũng Tàu');

  const addr2 = formatAddress('266 Lê Hồng Phong, Quận 5, TP Hồ Chí Minh', 'Quận 5', 'Hồ Chí Minh');
  assert.equal(addr2, '266 Lê Hồng Phong, Quận 5, TP Hồ Chí Minh');
});

test('deduplicateFixedPoints: keeps item with smallest id when name and address match', () => {
  const points = [
    { id: '11271', maDiem: 'FUTA-BEN-XE-VUNG-TAU-11271', tenDiem: 'Bến xe Vũng Tàu', diaChi: '192 Nam Kỳ Khởi Nghĩa' },
    { id: '11270', maDiem: 'FUTA-BEN-XE-VUNG-TAU-11270', tenDiem: 'Bến xe Vũng Tàu', diaChi: '192 Nam Kỳ Khởi Nghĩa' },
    { id: '54294', maDiem: 'FUTA-VP-BEN-XE-HA-TIEN-54294', tenDiem: 'VP Bến Xe Hà Tiên', diaChi: 'Bến xe Hà Tiên, đường 2/9' },
    { id: '11274', maDiem: 'FUTA-VP-BEN-XE-HA-TIEN-11274', tenDiem: 'VP Bến Xe Hà Tiên', diaChi: 'Bến xe Hà Tiên, đường 2/9' },
    { id: '99999', maDiem: 'FUTA-DIFF-ADDR', tenDiem: 'Bến xe Vũng Tàu', diaChi: 'Khác địa chỉ hoàn toàn' },
  ];

  const { uniquePoints, duplicates } = deduplicateFixedPoints(points);
  assert.equal(uniquePoints.length, 3);
  assert.equal(duplicates.length, 2);

  // Kept smallest id for Vũng Tàu (11270)
  const vt = uniquePoints.find(p => p.tenDiem === 'Bến xe Vũng Tàu' && p.diaChi === '192 Nam Kỳ Khởi Nghĩa');
  assert.equal(vt.id, '11270');

  // Kept smallest id for Hà Tiên (11274)
  const ht = uniquePoints.find(p => p.tenDiem === 'VP Bến Xe Hà Tiên');
  assert.equal(ht.id, '11274');

  // Different address is preserved
  const diff = uniquePoints.find(p => p.maDiem === 'FUTA-DIFF-ADDR');
  assert.ok(diff);
});

test('generateRoutePointMaDiem: generates stable code <= 50 chars with slug and hash', () => {
  const code1 = generateRoutePointMaDiem('FUTA', 'Bệnh Viện Ung Bướu', 10.8078, 106.695);
  const code2 = generateRoutePointMaDiem('FUTA', 'Bệnh Viện Ung Bướu', 10.8078, 106.695);
  const code3 = generateRoutePointMaDiem('HM', 'Văn phòng Miền Đông', 10.8153495, 106.712779);

  assert.equal(code1, code2, 'Must be stable and idempotent for same inputs');
  assert.notEqual(code1, code3);
  assert.ok(code1.startsWith('FUTA-RP-'));
  assert.ok(code1.length <= 50, `Length must be <= 50, got ${code1.length}`);
});

test('buildRouteTemplates: preserves negative and positive minutes, sorts ascending, scopes maDiem by operator', () => {
  const routePoints = [
    {
      nhaXeThamChieu: 'Phương Trang',
      tuyenThamChieu: 'Sài Gòn - Cần Thơ / Tiền Giang',
      tenDiem: 'Bến xe Cần Thơ',
      vaiTroMacDinh: 'DIEM_TRA',
      khoangCachPhutSoVoiXuatBen: 210,
    },
    {
      nhaXeThamChieu: 'Phương Trang',
      tuyenThamChieu: 'Sài Gòn - Cần Thơ / Tiền Giang',
      tenDiem: 'Bệnh Viện Ung Bướu',
      vaiTroMacDinh: 'DIEM_DON',
      khoangCachPhutSoVoiXuatBen: -90,
    },
    {
      nhaXeThamChieu: 'Phương Trang',
      tuyenThamChieu: 'Sài Gòn - Cần Thơ / Tiền Giang',
      tenDiem: 'Bến xe Miền Tây',
      vaiTroMacDinh: 'DIEM_DON',
      khoangCachPhutSoVoiXuatBen: 0,
    },
    {
      nhaXeThamChieu: 'Hoa Mai',
      tuyenThamChieu: 'Sài Gòn - Vũng Tàu',
      tenDiem: 'Bến xe Vũng Tàu',
      vaiTroMacDinh: 'DIEM_TRA',
      khoangCachPhutSoVoiXuatBen: 102,
    },
  ];

  // Lookup scoped by operator
  const lookup = {
    FUTA: {
      'Bến xe Cần Thơ': 'FUTA-RP-BX-CT',
      'Bệnh Viện Ung Bướu': 'FUTA-RP-BV-UB',
      'Bến xe Miền Tây': 'BX-MT',
    },
    HM: {
      'Bến xe Vũng Tàu': 'BX-VT',
    },
  };

  const templates = buildRouteTemplates(routePoints, lookup);
  assert.equal(templates.length, 2);

  const t1 = templates.find(t => t.nhaXeCode === 'FUTA');
  assert.equal(t1.nhaXeCode, 'FUTA');
  assert.equal(t1.tuyenThamChieu, 'Sài Gòn - Cần Thơ / Tiền Giang');
  assert.equal(t1.stops.length, 3);

  // Sorted ascending by phutLech (-90, 0, 210)
  assert.equal(t1.stops[0].phutLech, -90);
  assert.equal(t1.stops[0].loaiDiem, 'DON');
  assert.equal(t1.stops[0].thuTu, 1);
  assert.equal(t1.stops[0].maDiem, 'FUTA-RP-BV-UB');

  assert.equal(t1.stops[1].phutLech, 0);
  assert.equal(t1.stops[1].loaiDiem, 'DON');
  assert.equal(t1.stops[1].thuTu, 2);
  assert.equal(t1.stops[1].maDiem, 'BX-MT');

  assert.equal(t1.stops[2].phutLech, 210);
  assert.equal(t1.stops[2].loaiDiem, 'TRA');
  assert.equal(t1.stops[2].thuTu, 3);
  assert.equal(t1.stops[2].maDiem, 'FUTA-RP-BX-CT');

  const t2 = templates.find(t => t.nhaXeCode === 'HM');
  assert.equal(t2.stops[0].maDiem, 'BX-VT');
});
