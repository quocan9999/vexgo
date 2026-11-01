import crypto from 'node:crypto';

export function normalizeName(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProvinceName(str) {
  if (!str) return '';
  let norm = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?)\s+/i, '')
    .replace(/[-–—_]/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "Thừa Thiên Huế" matches "Huế" in DanhMucDiaDiem
  if (norm === 'thua thien hue') {
    return 'hue';
  }
  return norm;
}

export function matchProvince(tinhThanh, quanHuyen, provinceLookup) {
  if (tinhThanh) {
    const norm = normalizeProvinceName(tinhThanh);
    if (provinceLookup.has(norm)) {
      return provinceLookup.get(norm);
    }
  }
  if (quanHuyen) {
    const norm = normalizeProvinceName(quanHuyen);
    if (provinceLookup.has(norm)) {
      return provinceLookup.get(norm);
    }
  }
  return null;
}

export function mapLoaiDiem(rawLoaiDiem) {
  switch (rawLoaiDiem) {
    case 'BEN_XE':
      return 'BEN_XE';
    case 'VAN_PHONG':
      return 'VAN_PHONG';
    case 'DIEM_DON_TRA':
      return 'DIEM_DON_TRA';
    case 'TRAM_DUNG':
      return 'TRAM_NGHI';
    default:
      return rawLoaiDiem || 'DIEM_DON_TRA';
  }
}

export function normalizePhone(rawPhone) {
  if (!rawPhone) return null;
  const first = rawPhone.split(',')[0].trim();
  return first.slice(0, 20);
}

export function formatAddress(diaChi, quanHuyen, tinhThanh) {
  let res = (diaChi || '').trim();
  const lower = res.toLowerCase();
  const qh = (quanHuyen || '').trim();
  const tt = (tinhThanh || '').trim();

  if (qh && !lower.includes(qh.toLowerCase())) {
    res = res ? `${res}, ${qh}` : qh;
  }
  if (tt && !lower.includes(tt.toLowerCase())) {
    res = res ? `${res}, ${tt}` : tt;
  }
  return res.slice(0, 255);
}

export function deduplicateFixedPoints(points) {
  const groups = new Map();

  for (const point of points) {
    const key = `${normalizeName(point.tenDiem)}|||${normalizeName(point.diaChi)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(point);
  }

  const uniquePoints = [];
  const duplicates = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      uniquePoints.push(group[0]);
    } else {
      // Sort by numeric id ascending to keep smallest id
      group.sort((a, b) => Number(a.id) - Number(b.id));
      uniquePoints.push(group[0]);
      for (let i = 1; i < group.length; i++) {
        duplicates.push({
          kept: group[0],
          duplicate: group[i],
        });
      }
    }
  }

  return { uniquePoints, duplicates };
}

export function generateRoutePointMaDiem(nhaXeCode, tenDiem, viDo, kinhDo) {
  const norm = normalizeName(tenDiem);
  const slug = norm.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 26).replace(/-+$/, '');
  const hash = crypto
    .createHash('md5')
    .update(`${tenDiem}_${viDo ?? ''}_${kinhDo ?? ''}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();

  const code = `${nhaXeCode}-RP-${slug}-${hash}`;
  return code.slice(0, 50);
}

export function buildRouteTemplates(routePoints, resolvedMaDiemLookup, defaultNhaXeCode = 'FUTA') {
  const routeGroups = new Map();

  for (const p of routePoints) {
    const nhaXeCode = p.nhaXeThamChieu?.includes('Phương Trang')
      ? 'FUTA'
      : p.nhaXeThamChieu?.includes('Hoa Mai')
        ? 'HM'
        : defaultNhaXeCode;
    const tuyen = p.tuyenThamChieu;
    const key = `${nhaXeCode}|||${tuyen}`;

    if (!routeGroups.has(key)) {
      routeGroups.set(key, { nhaXeCode, tuyenThamChieu: tuyen, points: [] });
    }
    routeGroups.get(key).points.push(p);
  }

  const templates = [];

  for (const group of routeGroups.values()) {
    // Sort by khoangCachPhutSoVoiXuatBen ascending
    group.points.sort((a, b) => a.khoangCachPhutSoVoiXuatBen - b.khoangCachPhutSoVoiXuatBen);

    const opLookup = resolvedMaDiemLookup[group.nhaXeCode] || resolvedMaDiemLookup;

    const stops = group.points.map((p, idx) => {
      const normName = normalizeName(p.tenDiem);
      const maDiem =
        opLookup[p.tenDiem] ||
        opLookup[normName] ||
        generateRoutePointMaDiem(group.nhaXeCode, p.tenDiem, p.viDo, p.kinhDo);

      const loaiDiem = p.vaiTroMacDinh === 'DIEM_DON' ? 'DON' : 'TRA';

      return {
        maDiem,
        loaiDiem,
        phutLech: p.khoangCachPhutSoVoiXuatBen,
        thuTu: idx + 1,
      };
    });

    templates.push({
      nhaXeCode: group.nhaXeCode,
      tuyenThamChieu: group.tuyenThamChieu,
      stops,
    });
  }

  return templates;
}
