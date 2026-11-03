import fs from 'fs';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Danh sách nhà xe ưu tiên theo yêu cầu
const OPERATOR_TARGETS = [
  { code: 'FUTA', name: 'Phương Trang', slug: 'xe-phuong-trang' },
  { code: 'TB', name: 'Thành Bưởi', slug: 'xe-thanh-buoi' },
  { code: 'HM', name: 'Hoa Mai', slug: 'xe-hoa-mai' },
  { code: 'DL', name: 'Điền Linh Limousine', slug: 'xe-dien-linh-limousine' },
  { code: 'PP', name: 'Phong Phú', slug: 'xe-phong-phu' },
  { code: 'TT', name: 'Thuận Tiến', slug: 'xe-thuan-tien' },
  { code: 'LH', name: 'Liên Hưng', slug: 'xe-lien-hung' },
  { code: 'TO', name: 'Tiến Oanh', slug: 'xe-tien-oanh' },
  { code: 'LV', name: 'Long Vân Limousine', slug: 'xe-long-van-limousine' },
  { code: 'TTH', name: 'Toàn Thắng', slug: 'xe-toan-thang' },
  { code: 'CT', name: 'Cúc Tùng', slug: 'xe-cuc-tung' },
  { code: 'HC', name: 'Hạnh Cafe', slug: 'xe-hanh-cafe' },
  { code: 'HA', name: 'Hải Âu', slug: 'xe-hai-au' },
  { code: 'SV', name: 'Sao Việt', slug: 'xe-sao-viet' },
  { code: 'HL', name: 'Hà Lan', slug: 'xe-ha-lan' },
  { code: 'TN', name: 'Tân Niên', slug: 'xe-tan-nien' },
  { code: 'TM', name: 'Trọng Minh', slug: 'xe-trong-minh' },
  { code: 'TUT', name: 'Tư Tiến', slug: 'xe-tu-tien' },
];

// Danh sách các tuyến phổ biến để cào điểm đón/trả dọc lộ trình (có GPS và mốc thời gian)
const ROUTE_TARGETS = [
  { from: 29, to: 13, name: 'Sài Gòn - Cần Thơ / Tiền Giang' },
  { from: 13, to: 29, name: 'Cần Thơ - Sài Gòn' },
  { from: 29, to: 457, name: 'Sài Gòn - Đà Lạt' },
  { from: 457, to: 29, name: 'Đà Lạt - Sài Gòn' },
  { from: 29, to: 76, name: 'Sài Gòn - Vũng Tàu' },
  { from: 76, to: 29, name: 'Vũng Tàu - Sài Gòn' },
  { from: 29, to: 417, name: 'Sài Gòn - Nha Trang' },
  { from: 29, to: 204, name: 'Sài Gòn - Buôn Ma Thuột' },
  { from: 24, to: 482, name: 'Hà Nội - Sa Pa' },
  { from: 24, to: 27, name: 'Hà Nội - Hải Phòng' },
  { from: 24, to: 2554, name: 'Hà Nội - Quảng Ninh' },
  { from: 15, to: 46, name: 'Đà Nẵng - Quy Nhơn' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateCode(prefix, name, id) {
  const cleanName = removeTones(name).replace(/\s+/g, '-').slice(0, 20).toUpperCase();
  return `${prefix}-${cleanName}-${id || Math.floor(Math.random() * 8999 + 1000)}`;
}

function determinePointType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('bến xe') || lower.includes('bx ')) return 'BEN_XE';
  if (lower.includes('văn phòng') || lower.includes('vp ') || lower.includes('chi nhánh') || lower.includes('bưu cục')) return 'VAN_PHONG';
  if (lower.includes('trạm dừng') || lower.includes('trạm')) return 'TRAM_DUNG';
  return 'DIEM_DON_TRA';
}

async function getVexereToken() {
  console.log('🔑 Đang lấy Bearer Token ẩn danh từ VeXeRe...');
  const res = await fetch('https://vexere.com/getToken', {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      'Referer': 'https://vexere.com/',
      'Origin': 'https://vexere.com'
    }
  });
  if (!res.ok) throw new Error(`Lỗi khi lấy token VeXeRe: HTTP ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

// 1. Cào bến xe, văn phòng, bưu cục theo từng nhà xe
async function crawlOperatorStations() {
  console.log('\n======================================================');
  console.log('📦 BƯỚC 1: CÀO BẾN XE, VĂN PHÒNG & BƯU CỤC GỬI HÀNG THEO NHÀ XE');
  console.log('======================================================');

  const operatorResults = [];

  for (const op of OPERATOR_TARGETS) {
    process.stdout.write(`Đang cào: [${op.code}] ${op.name}... `);
    try {
      const url = `https://vexere.com/vi-VN/${op.slug}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        console.log(`❌ Lỗi HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (!match) {
        console.log(`❌ Không tìm thấy __NEXT_DATA__`);
        continue;
      }
      const json = JSON.parse(match[1]);
      const busData = json.props?.initialState?.busOperator?.data;
      const contacts = busData?.contact || [];

      const normalizedContacts = contacts.map((c, index) => {
        const type = determinePointType(c.Name);
        return {
          id: c.Id || `op_${op.code}_${index + 1}`,
          maDiem: generateCode(op.code, c.Name, c.Id),
          tenDiem: c.Name.trim(),
          loaiDiem: type,
          diaChi: c.Address1 ? c.Address1.trim() : '',
          quanHuyen: c.City?.Name || null,
          tinhThanh: c.State?.Name || null,
          soDienThoai: c.PhoneNumber1 ? c.PhoneNumber1.trim() : null,
          soDienThoai2: c.PhoneNumber2 ? c.PhoneNumber2.trim() : null,
          soDienThoaiGuiHang: c.ConsignPhoneNumber ? c.ConsignPhoneNumber.trim() : (c.PhoneNumber1 ? c.PhoneNumber1.trim() : null),
          choDatVe: true,
          choGuiHang: true, // Văn phòng / Bến xe chính thức của nhà xe đều nhận gửi hàng bưu cục
          nhaXeCode: op.code,
          nhaXeName: op.name,
          nguon: 'VEXERE_OPERATOR_PAGE'
        };
      });

      console.log(`✅ Thu thập được ${normalizedContacts.length} điểm`);
      operatorResults.push({
        operatorCode: op.code,
        operatorName: op.name,
        slug: op.slug,
        totalPoints: normalizedContacts.length,
        points: normalizedContacts
      });
      await sleep(300);
    } catch (e) {
      console.log(`❌ Ngoại lệ: ${e.message}`);
    }
  }

  return operatorResults;
}

// 2. Cào điểm đón/trả chi tiết dọc tuyến theo chuyến (có GPS & mốc giờ)
async function crawlRoutePoints(token) {
  console.log('\n======================================================');
  console.log('📍 BƯỚC 2: CÀO ĐIỂM ĐÓN / TRẢ DỌC TUYẾN CHUYẾN XE (KÈM GPS & THỜI GIAN)');
  console.log('======================================================');

  const date = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10) + 'T00:00:00+07:00';
  const routeResults = [];
  const uniquePointsMap = new Map();

  for (const r of ROUTE_TARGETS) {
    process.stdout.write(`Đang cào tuyến: ${r.name}... `);
    try {
      const url = `https://internal-vroute-cmc.vexere.com/v2/route?filter[from]=${r.from}&filter[to]=${r.to}&filter[date]=${encodeURIComponent(date)}&page=1&pagesize=20&is_legacy_from=1&is_legacy_to=1`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `bearer ${token}`,
          'User-Agent': USER_AGENT,
          'Referer': 'https://vexere.com/'
        }
      });
      if (!res.ok) {
        console.log(`❌ Lỗi HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const trips = json.data || [];

      let pickupCount = 0;
      let dropoffCount = 0;

      for (const trip of trips) {
        const companyName = trip.company?.name || 'Nhà xe đối tác';
        const companyUrl = trip.company?.url_info || '';
        
        // Pickups
        for (const p of (trip.route?.pickup_points || [])) {
          pickupCount++;
          const key = `${p.name}_${p.district || ''}_${p.location?.lat || ''}`;
          if (!uniquePointsMap.has(key)) {
            uniquePointsMap.set(key, {
              tenDiem: p.name.trim(),
              loaiDiem: determinePointType(p.name),
              vaiTroMacDinh: 'DIEM_DON',
              diaChi: p.display_name_vex || p.name,
              phuongXa: p.region_ward_name || null,
              quanHuyen: p.district || null,
              tinhThanh: trip.route?.from?.city_name || null,
              viDo: p.location?.lat ? parseFloat(p.location.lat.toFixed(7)) : null,
              kinhDo: p.location?.lon ? parseFloat(p.location.lon.toFixed(7)) : null,
              khoangCachPhutSoVoiXuatBen: p.duration ?? 0,
              choDatVe: true,
              choGuiHang: false,
              nhaXeThamChieu: companyName,
              tuyenThamChieu: r.name,
              nguon: 'VEXERE_ROUTE_API'
            });
          }
        }

        // Dropoffs
        for (const p of (trip.route?.dropoff_points || [])) {
          dropoffCount++;
          const key = `${p.name}_${p.district || ''}_${p.location?.lat || ''}`;
          if (!uniquePointsMap.has(key)) {
            uniquePointsMap.set(key, {
              tenDiem: p.name.trim(),
              loaiDiem: determinePointType(p.name),
              vaiTroMacDinh: 'DIEM_TRA',
              diaChi: p.display_name_vex || p.name,
              phuongXa: p.region_ward_name || null,
              quanHuyen: p.district || null,
              tinhThanh: trip.route?.to?.city_name || null,
              viDo: p.location?.lat ? parseFloat(p.location.lat.toFixed(7)) : null,
              kinhDo: p.location?.lon ? parseFloat(p.location.lon.toFixed(7)) : null,
              khoangCachPhutSoVoiXuatBen: p.duration ?? 0,
              choDatVe: true,
              choGuiHang: false,
              nhaXeThamChieu: companyName,
              tuyenThamChieu: r.name,
              nguon: 'VEXERE_ROUTE_API'
            });
          }
        }
      }

      console.log(`✅ ${trips.length} chuyến (thu thập ${pickupCount} đón, ${dropoffCount} trả)`);
      routeResults.push({
        routeName: r.name,
        fromId: r.from,
        toId: r.to,
        tripsCount: trips.length
      });
      await sleep(350);
    } catch (e) {
      console.log(`❌ Ngoại lệ: ${e.message}`);
    }
  }

  return {
    routes: routeResults,
    uniquePoints: Array.from(uniquePointsMap.values())
  };
}

async function main() {
  const outputDir = path.resolve('prisma', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚀 BẮT ĐẦU CÀO DỮ LIỆU ĐIỂM ĐÓN/TRẢ, BẾN XE, VĂN PHÒNG, BƯU CỤC...');
  const startTime = Date.now();

  const token = await getVexereToken();

  // 1. Cào bến xe, văn phòng, bưu cục theo nhà xe
  const operatorData = await crawlOperatorStations();
  const operatorPointsAll = operatorData.flatMap(op => op.points);

  // 2. Cào điểm đón/trả tuyến đường
  const routeData = await crawlRoutePoints(token);

  // 3. Tạo Catalog tổng hợp hợp nhất
  console.log('\n======================================================');
  console.log('🗂️ BƯỚC 3: TỔNG HỢP VÀ CHUẨN HOÁ DANH MỤC MASTER DATA');
  console.log('======================================================');

  const masterCatalog = [
    ...operatorPointsAll.map(p => ({
      ...p,
      nhom: 'BEN_XE_VAN_PHONG_BUU_CUC'
    })),
    ...routeData.uniquePoints.map((p, idx) => ({
      id: `route_pt_${idx + 1}`,
      maDiem: generateCode('PT', p.tenDiem, idx + 1),
      ...p,
      nhom: 'DIEM_DON_TRA_DOC_TUYEN'
    }))
  ];

  // Ghi các file JSON
  const file1 = path.join(outputDir, 'crawled-stations-offices.json');
  fs.writeFileSync(file1, JSON.stringify(operatorData, null, 2), 'utf8');

  const file2 = path.join(outputDir, 'crawled-route-points.json');
  fs.writeFileSync(file2, JSON.stringify(routeData.uniquePoints, null, 2), 'utf8');

  const file3 = path.join(outputDir, 'crawled-catalog.json');
  fs.writeFileSync(file3, JSON.stringify(masterCatalog, null, 2), 'utf8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 HOÀN THÀNH TRONG ${durationSec} GIÂY!`);
  console.log(`📁 1. Bến xe/Văn phòng/Bưu cục: ${file1} (${operatorPointsAll.length} điểm)`);
  console.log(`📁 2. Điểm đón/trả dọc tuyến (GPS): ${file2} (${routeData.uniquePoints.length} điểm)`);
  console.log(`📁 3. Toàn bộ danh mục Master: ${file3} (${masterCatalog.length} điểm)`);
}

main().catch(err => {
  console.error('Lỗi khi chạy crawler:', err);
  process.exit(1);
});
