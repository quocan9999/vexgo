import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaMariaDb } from '../apps/api/node_modules/@prisma/adapter-mariadb/dist/index.js';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

const TZ = 'Asia/Ho_Chi_Minh';
const PASSWORD = 'VexGo@123';
const IMAGE_URLS = {
  dienTu:
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=640&q=80',
  thucPham:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=640&q=80',
  quanAo:
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=640&q=80',
};

const operatorDefs = [
  { code: 'FUTA', name: 'Phương Trang', prefix: '30F', city: 'TP.HCM' },
  { code: 'TB', name: 'Thành Bưởi', prefix: '51B', city: 'Đà Lạt' },
  { code: 'HM', name: 'Hoa Mai', prefix: '29A', city: 'Vũng Tàu' },
];

const routeDefsByOperator = {
  FUTA: [
    ['TP.HCM', 'Đà Lạt', 'HOAT_DONG'],
    ['Đà Lạt', 'TP.HCM', 'HOAT_DONG'],
    ['TP.HCM', 'Nha Trang', 'TAM_NGUNG'],
  ],
  TB: [
    ['Đà Lạt', 'TP.HCM', 'HOAT_DONG'],
    ['TP.HCM', 'Đà Lạt', 'HOAT_DONG'],
    ['Đà Lạt', 'Nha Trang', 'TAM_NGUNG'],
  ],
  HM: [
    ['Vũng Tàu', 'TP.HCM', 'HOAT_DONG'],
    ['TP.HCM', 'Vũng Tàu', 'HOAT_DONG'],
    ['Vũng Tàu', 'Đà Lạt', 'TAM_NGUNG'],
  ],
};

const branchDefsByOperator = {
  FUTA: [
    { diaChi: '12 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Quận 1', phuongXa: 'Phường Bến Nghé' },
    { diaChi: '45 Đường Trần Phú, Phường 4, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 4' },
    { diaChi: '128 Đường Điện Biên Phủ, Phường 17, Bình Thạnh, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Bình Thạnh', phuongXa: 'Phường 17' },
    { diaChi: '18 Đường Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 2' },
    { diaChi: '77 Đường Lê Lợi, Phường 1, Vũng Tàu, Bà Rịa - Vũng Tàu', tinhThanh: 'Bà Rịa - Vũng Tàu', quanHuyen: 'Vũng Tàu', phuongXa: 'Phường 1' },
  ],
  TB: [
    { diaChi: '45 Đường Trần Phú, Phường 4, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 4' },
    { diaChi: '91 Đường Võ Văn Tần, Phường 6, Quận 3, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Quận 3', phuongXa: 'Phường 6' },
    { diaChi: '31 Đường Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 2' },
    { diaChi: '128 Đường Điện Biên Phủ, Phường 17, Bình Thạnh, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Bình Thạnh', phuongXa: 'Phường 17' },
    { diaChi: '16 Đường Thái Phiên, Phường 12, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 12' },
  ],
  HM: [
    { diaChi: '12 Đường Trần Hưng Đạo, Phường 1, Vũng Tàu, Bà Rịa - Vũng Tàu', tinhThanh: 'Bà Rịa - Vũng Tàu', quanHuyen: 'Vũng Tàu', phuongXa: 'Phường 1' },
    { diaChi: '25 Đường Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Quận 1', phuongXa: 'Phường Bến Nghé' },
    { diaChi: '88 Đường Hoàng Hoa Thám, Phường 2, Vũng Tàu, Bà Rịa - Vũng Tàu', tinhThanh: 'Bà Rịa - Vũng Tàu', quanHuyen: 'Vũng Tàu', phuongXa: 'Phường 2' },
    { diaChi: '31 Đường Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng', tinhThanh: 'Lâm Đồng', quanHuyen: 'Đà Lạt', phuongXa: 'Phường 2' },
    { diaChi: '91 Đường Võ Văn Tần, Phường 6, Quận 3, TP.HCM', tinhThanh: 'TP.HCM', quanHuyen: 'Quận 3', phuongXa: 'Phường 6' },
  ],
};

const roleDefs = [
  ['SUPER_ADMIN', 'Quản trị hệ thống'],
  ['NHA_XE_ADMIN', 'Quản trị nhà xe'],
  ['NHAN_VIEN_BAN_VE', 'Nhân viên bán vé'],
  ['NHAN_VIEN_CSKH', 'Nhân viên chăm sóc khách hàng'],
  ['NHAN_VIEN_PHU_XE', 'Nhân viên phụ xe'],
  ['NHAN_VIEN_KINH_DOANH', 'Nhân viên kinh doanh'],
  ['KHACH_HANG', 'Khách hàng'],
];

const vehicleTypeDefs = [
  ['GHẾ NGỒI', 'Xe ghế ngồi tiêu chuẩn'],
  ['GIƯỜNG NẰM', 'Xe giường nằm đường dài'],
  ['LIMOUSINE', 'Xe limousine tiện nghi'],
];

const cargoTypeDefs = [
  ['BƯU PHẨM', 'Bưu phẩm đóng gói thông thường'],
  ['THỰC PHẨM', 'Thực phẩm khô, đóng gói kín'],
  ['THƯ TÍN', 'Thư từ và hồ sơ'],
  ['HẢI SẢN', 'Hải sản được đóng gói phù hợp'],
  ['ĐIỆN TỬ', 'Thiết bị điện tử'],
  ['QUẦN ÁO', 'Quần áo và phụ kiện'],
  ['HÀNG GIA DỤNG', 'Đồ dùng gia đình'],
];

const customerNames = [
  'Nguyễn Minh Anh',
  'Trần Quốc Huy',
  'Lê Hoàng Phúc',
  'Phạm Ngọc Mai',
  'Võ Thanh Tùng',
  'Đặng Khánh Linh',
  'Bùi Gia Bảo',
  'Đỗ Thùy Dương',
  'Hồ Nhật Nam',
  'Nguyễn Thảo Vy',
  'Trần Đức Minh',
  'Lý Quỳnh Như',
  'Phan Anh Khoa',
  'Huỳnh Kim Chi',
  'Mai Thành Đạt',
  'Dương Ngọc Trâm',
  'Vũ Hoàng Long',
  'Đinh Tú Anh',
  'Cao Minh Quân',
  'Tạ Bảo Châu',
];

const employeeNames = [
  'Nguyễn Văn An',
  'Trần Thị Bình',
  'Lê Minh Cường',
  'Phạm Thị Duyên',
  'Võ Quốc Em',
  'Đặng Gia Hân',
  'Bùi Thành Khang',
];

function localDate(year, month, day, hour = 0, minute = 0) {
  // Store the fixed UTC instant corresponding to Asia/Ho_Chi_Minh local time.
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
}

function tripDepartureDate(trip) {
  const date = new Date(trip.ngayKhoiHanh);
  const time = new Date(trip.gioKhoiHanh);
  return localDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), time.getUTCHours(), time.getUTCMinutes());
}

function selectTripAfter(trips, preferredIndex, minimumDeparture, excludedTripId = null, inclusive = false) {
  const candidates = trips.filter((trip) => {
    const departure = tripDepartureDate(trip).getTime();
    const minimum = minimumDeparture.getTime();
    return trip.chuyenXeId !== excludedTripId && (inclusive ? departure >= minimum : departure > minimum);
  });
  if (!candidates.length) return null;
  return candidates[preferredIndex % candidates.length];
}

function dateOnly(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function timeOnly(hour, minute = 0) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

function money(value) {
  return String(Math.round(value));
}

function decimal(value) {
  return String(value);
}

function seatCode(index) {
  const section = String.fromCharCode(65 + Math.floor(index / 20));
  return `${section}${pad((index % 20) + 1, 2)}`;
}

async function passwordHash(password) {
  return bcrypt.hash(password, 10);
}

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required for seed');
  const url = new URL(raw);
  if (url.protocol !== 'mysql:') throw new Error('Seed URL must use mysql: protocol');
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });
const counts = new Map();
const scenarios = [];

function count(model, action = 'upsert') {
  const key = `${model}:${action}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

async function upsertBy(db, model, where, create, update = {}) {
  const record = await db[model].upsert({ where, create, update });
  count(model, 'upsert');
  return record;
}

async function findOrCreate(db, model, where, create, update = {}) {
  const existing = await db[model].findFirst({ where });
  if (existing) {
    const keys = Object.keys(update);
    if (keys.length) {
      const updated = await db[model].update({ where: { [`${model[0].toLowerCase()}${model.slice(1)}Id`]: existing[`${model[0].toLowerCase()}${model.slice(1)}Id`] }, data: update });
      count(model, 'update');
      return updated;
    }
    count(model, 'existing');
    return existing;
  }
  const created = await db[model].create({ data: create });
  count(model, 'create');
  return created;
}

function byId(model, id) {
  const primaryKeys = { HinhAnhHangHoa: 'hinhAnhId' };
  return { [primaryKeys[model] ?? `${model[0].toLowerCase()}${model.slice(1)}Id`]: id };
}

async function seedOperators(db) {
  const result = {};
  for (const definition of operatorDefs) {
    result[definition.code] = await upsertBy(
      db,
      'NhaXe',
      { maNhaXe: definition.code },
      {
        maNhaXe: definition.code,
        tenNhaXe: definition.name,
        thongTinLienHe: `Tổng đài demo ${definition.code}: +84900000${definition.code === 'FUTA' ? '001' : definition.code === 'TB' ? '002' : '003'}`,
        chinhSachDoiHuy: 'Dữ liệu demo: hỗ trợ đổi/hủy theo chính sách nhà xe.',
        trangThai: 'HOAT_DONG',
      },
      { tenNhaXe: definition.name, trangThai: 'HOAT_DONG' },
    );
  }
  return result;
}

async function seedVehicleTypes(db) {
  const result = {};
  for (const [name, description] of vehicleTypeDefs) {
    result[name] = await upsertBy(
      db,
      'LoaiXe',
      { tenLoai: name },
      { tenLoai: name, moTa: description },
      { moTa: description },
    );
  }
  return result;
}

async function seedRoles(db) {
  const result = {};
  for (const [name, description] of roleDefs) {
    result[name] = await upsertBy(
      db,
      'VaiTro',
      { tenVaiTro: name },
      { tenVaiTro: name, moTa: description },
      { moTa: description },
    );
  }
  return result;
}

async function seedAccounts(db, operators, roles) {
  const accounts = { customers: [], employees: [], superAdmin: null };
  const hash = await passwordHash(PASSWORD);
  const superAccount = await upsertBy(
    db,
    'TaiKhoan',
    { soDienThoai: '+84900000000' },
    {
      hoTen: 'Quản trị viên VexGo',
      soDienThoai: '+84900000000',
      matKhau: hash,
      ngaySinh: dateOnly(1988, 1, 1),
      cccd: '000000000000',
      email: 'superadmin@vexgo.test',
      daXacThucSoDienThoai: true,
      trangThai: 'HOAT_DONG',
    },
    { hoTen: 'Quản trị viên VexGo', matKhau: hash, trangThai: 'HOAT_DONG' },
  );
  accounts.superAdmin = superAccount;
  await upsertBy(
    db,
    'TaiKhoanVaiTro',
    { taiKhoanId_vaiTroId: { taiKhoanId: superAccount.taiKhoanId, vaiTroId: roles.SUPER_ADMIN.vaiTroId } },
    { taiKhoanId: superAccount.taiKhoanId, vaiTroId: roles.SUPER_ADMIN.vaiTroId },
  );

  for (let opIndex = 0; opIndex < operatorDefs.length; opIndex += 1) {
    const definition = operatorDefs[opIndex];
    const operator = operators[definition.code];
    const employeeRoles = [
      'NHA_XE_ADMIN',
      'NHAN_VIEN_BAN_VE',
      'NHAN_VIEN_BAN_VE',
      'NHAN_VIEN_CSKH',
      'NHAN_VIEN_PHU_XE',
      'NHAN_VIEN_KINH_DOANH',
      'NHAN_VIEN_BAN_VE',
    ];
    for (let employeeIndex = 0; employeeIndex < employeeRoles.length; employeeIndex += 1) {
      const employeeCode = `${definition.code}-NV-${pad(employeeIndex + 1, 4)}`;
      const phone = `+8491${pad(opIndex * 100 + employeeIndex + 1, 7)}`;
      const roleName = employeeRoles[employeeIndex];
      const isFormer = employeeIndex === 6;
      const account = await upsertBy(
        db,
        'TaiKhoan',
        { soDienThoai: phone },
        {
          hoTen: employeeNames[employeeIndex],
          soDienThoai: phone,
          matKhau: hash,
          ngaySinh: dateOnly(1985 + employeeIndex, 2 + opIndex, 3 + employeeIndex),
          cccd: `00000000${pad(opIndex * 10 + employeeIndex + 1, 4)}`,
          email: `${employeeCode.toLowerCase()}@vexgo.test`,
          daXacThucSoDienThoai: !isFormer,
          trangThai: isFormer ? 'TAM_KHOA' : 'HOAT_DONG',
        },
        { hoTen: employeeNames[employeeIndex], matKhau: hash, trangThai: isFormer ? 'TAM_KHOA' : 'HOAT_DONG' },
      );
      const employee = await upsertBy(
        db,
        'NhanVien',
        { nhaXeId_maNhanVien: { nhaXeId: operator.nhaXeId, maNhanVien: employeeCode } },
        {
          maNhanVien: employeeCode,
          trangThaiLamViec: isFormer ? 'DA_NGHI_VIEC' : 'DANG_LAM_VIEC',
          nhaXeId: operator.nhaXeId,
          taiKhoanId: account.taiKhoanId,
        },
        { trangThaiLamViec: isFormer ? 'DA_NGHI_VIEC' : 'DANG_LAM_VIEC', taiKhoanId: account.taiKhoanId },
      );
      await upsertBy(
        db,
        'TaiKhoanVaiTro',
        { taiKhoanId_vaiTroId: { taiKhoanId: account.taiKhoanId, vaiTroId: roles[roleName].vaiTroId } },
        { taiKhoanId: account.taiKhoanId, vaiTroId: roles[roleName].vaiTroId },
      );
      accounts.employees.push({ ...employee, account, roleName, operatorCode: definition.code });
    }
  }

  for (let index = 0; index < customerNames.length; index += 1) {
    const code = `KH-${pad(index + 1, 6)}`;
    const phone = `+8492${pad(index + 1, 7)}`;
    const existingCustomer = await db.KhachHang.findUnique({ where: { maKhachHang: code }, include: { taiKhoan: true } });
    const accountData = {
      hoTen: customerNames[index],
      soDienThoai: phone,
      matKhau: hash,
      ngaySinh: dateOnly(1970 + (index % 25), 1 + (index % 12), 1 + (index % 26)),
      cccd: `000000${pad(index + 1, 6)}`,
      email: `kh${pad(index + 1, 6)}@vexgo.test`,
      daXacThucSoDienThoai: index !== 19,
      trangThai: index === 18 ? 'TAM_KHOA' : 'HOAT_DONG',
    };
    const account = existingCustomer
      ? await db.TaiKhoan.update({ where: byId('TaiKhoan', existingCustomer.taiKhoanId), data: accountData })
      : await upsertBy(db, 'TaiKhoan', { soDienThoai: phone }, accountData, { hoTen: accountData.hoTen, matKhau: accountData.matKhau, ngaySinh: accountData.ngaySinh, cccd: accountData.cccd, email: accountData.email, daXacThucSoDienThoai: accountData.daXacThucSoDienThoai, trangThai: accountData.trangThai });
    count('TaiKhoan', existingCustomer ? 'update' : 'upsert');
    const customer = await upsertBy(
      db,
      'KhachHang',
      { maKhachHang: code },
      { maKhachHang: code, diemTichLuy: index * 10, taiKhoanId: account.taiKhoanId },
      { diemTichLuy: index * 10, taiKhoanId: account.taiKhoanId },
    );
    await upsertBy(
      db,
      'TaiKhoanVaiTro',
      { taiKhoanId_vaiTroId: { taiKhoanId: account.taiKhoanId, vaiTroId: roles.KHACH_HANG.vaiTroId } },
      { taiKhoanId: account.taiKhoanId, vaiTroId: roles.KHACH_HANG.vaiTroId },
    );
    accounts.customers.push({ ...customer, account, initialName: customerNames[index], initialPhone: phone });
  }
  return accounts;
}

async function seedVehiclesAndRoutes(db, operators, vehicleTypes) {
  const vehicleConfigs = [
    { type: 'GHẾ NGỒI', seats: 29, status: 'HOAT_DONG' },
    { type: 'GIƯỜNG NẰM', seats: 22, status: 'HOAT_DONG' },
    { type: 'LIMOUSINE', seats: 16, status: 'HOAT_DONG' },
    { type: 'GHẾ NGỒI', seats: 45, status: 'HOAT_DONG' },
    { type: 'GIƯỜNG NẰM', seats: 34, status: 'HOAT_DONG' },
    { type: 'LIMOUSINE', seats: 20, status: 'BAO_TRI' },
  ];
  const vehicles = {};
  const routes = {};
  const trips = {};
  for (const definition of operatorDefs) {
    const operator = operators[definition.code];
    vehicles[definition.code] = [];
    for (let index = 0; index < vehicleConfigs.length; index += 1) {
      const config = vehicleConfigs[index];
      const plate = `${definition.prefix}-${pad(123 + index, 3)}.${pad(index + 45, 2)}`;
      const vehicle = await upsertBy(
        db,
        'Xe',
        { bienSoXe: plate },
        { bienSoXe: plate, trangThai: config.status, nhaXeId: operator.nhaXeId, loaiXeId: vehicleTypes[config.type].loaiXeId },
        { trangThai: config.status, nhaXeId: operator.nhaXeId, loaiXeId: vehicleTypes[config.type].loaiXeId },
      );
      const seats = [];
      for (let seatIndex = 0; seatIndex < config.seats; seatIndex += 1) {
        const code = seatCode(seatIndex);
        const seat = await findOrCreate(
          db,
          'Ghe',
          { xeId: vehicle.xeId, soGhe: code },
          { soGhe: code, viTri: config.type === 'GIƯỜNG NẰM' ? (seatIndex < config.seats / 2 ? 'Tầng dưới' : 'Tầng trên') : seatIndex % 2 === 0 ? 'Dãy trái' : 'Dãy phải', xeId: vehicle.xeId },
          { viTri: config.type === 'GIƯỜNG NẰM' ? (seatIndex < config.seats / 2 ? 'Tầng dưới' : 'Tầng trên') : seatIndex % 2 === 0 ? 'Dãy trái' : 'Dãy phải' },
        );
        seats.push(seat);
      }
      vehicles[definition.code].push({ ...vehicle, seats, type: config.type });
    }

    const routeDefs = routeDefsByOperator[definition.code];
    routes[definition.code] = [];
    for (let routeIndex = 0; routeIndex < routeDefs.length; routeIndex += 1) {
      const [from, to, status] = routeDefs[routeIndex];
      const code = `${definition.code}-TX-${pad(routeIndex + 1, 4)}`;
      const route = await findOrCreate(
        db,
        'TuyenXe',
        { nhaXeId: operator.nhaXeId, maTuyenXe: code },
        { maTuyenXe: code, diemDi: from, diemDen: to, trangThai: status, nhaXeId: operator.nhaXeId },
        { diemDi: from, diemDen: to, trangThai: status },
      );
      routes[definition.code].push(route);
    }

    trips[definition.code] = [];
    for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
      const day = 22 + dayOffset;
      let sequence = 1;
      for (let routeIndex = 0; routeIndex < 2; routeIndex += 1) {
        for (const hour of [7, 13]) {
          const vehicle = vehicles[definition.code][(dayOffset + routeIndex + (hour === 13 ? 1 : 0)) % 5];
          const route = routes[definition.code][routeIndex];
          const code = `${definition.code}-CX-${pad(day, 2)}092026-${pad(sequence, 4)}`;
          sequence += 1;
          const trip = await upsertBy(
            db,
            'ChuyenXe',
            { maChuyenXe: code },
            { maChuyenXe: code, ngayKhoiHanh: dateOnly(2026, 9, day), gioKhoiHanh: timeOnly(hour), trangThai: 'MO_BAN', tuyenXeId: route.tuyenXeId, xeId: vehicle.xeId },
            { ngayKhoiHanh: dateOnly(2026, 9, day), gioKhoiHanh: timeOnly(hour), trangThai: 'MO_BAN', tuyenXeId: route.tuyenXeId, xeId: vehicle.xeId },
          );
          const tripSeats = [];
          for (const seat of vehicle.seats) {
            const tripSeat = await upsertBy(
              db,
              'GheChuyenXe',
              { chuyenXeId_gheId: { chuyenXeId: trip.chuyenXeId, gheId: seat.gheId } },
              { trangThai: 'TRONG', chuyenXeId: trip.chuyenXeId, gheId: seat.gheId },
              { trangThai: 'TRONG' },
            );
            tripSeats.push(tripSeat);
          }
          trips[definition.code].push({ ...trip, vehicle, route, tripSeats });
        }
      }
    }
  }
  return { vehicles, routes, trips };
}

async function seedPrices(db, routes, vehicleTypes) {
  const prices = new Map();
  const typeDelta = { 'GHẾ NGỒI': 0, 'GIƯỜNG NẰM': 70000, LIMOUSINE: 140000 };
  for (const definition of operatorDefs) {
    for (let routeIndex = 0; routeIndex < routes[definition.code].length; routeIndex += 1) {
      const route = routes[definition.code][routeIndex];
      for (const [typeName, type] of Object.entries(vehicleTypes)) {
        const amount = 180000 + routeIndex * 20000 + typeDelta[typeName];
        const price = await findOrCreate(
          db,
          'BangGia',
          { tuyenXeId: route.tuyenXeId, loaiXeId: type.loaiXeId, tuNgay: dateOnly(2026, 9, 1), denNgay: null },
          { giaNiemYet: decimal(amount), tuNgay: dateOnly(2026, 9, 1), denNgay: null, trangThai: 'DANG_AP_DUNG', tuyenXeId: route.tuyenXeId, loaiXeId: type.loaiXeId },
          { giaNiemYet: decimal(amount), trangThai: 'DANG_AP_DUNG' },
        );
        prices.set(`${route.tuyenXeId}:${type.loaiXeId}`, price);
      }
    }
  }
  return prices;
}

async function seedBranchesRatesCargo(db, operators, cargoTypes) {
  const branches = {};
  const branchesById = new Map();
  const rates = new Map();
  const weightRanges = [
    [0, 1, 30000],
    [1.01, 5, 50000],
    [5.01, 10, 80000],
    [10.01, 20, 120000],
    [20.01, 50, 180000],
    [50.01, null, 250000],
  ];
  const combos = [
    ['NHAN_TAN_NOI', 'GIAO_TAN_NOI', 1.35],
    ['NHAN_TAN_NOI', 'GIAO_TAI_BUU_CUC', 1.2],
    ['GUI_TAI_BUU_CUC', 'GIAO_TAN_NOI', 1.15],
    ['GUI_TAI_BUU_CUC', 'GIAO_TAI_BUU_CUC', 1],
  ];
  for (const definition of operatorDefs) {
    const operator = operators[definition.code];
    branches[definition.code] = [];
    for (let index = 0; index < 5; index += 1) {
      const code = `${definition.code}-BC-${pad(index + 1, 3)}`;
      const location = branchDefsByOperator[definition.code][index];
      const branchData = { maBuuCuc: code, tenBuuCuc: `${definition.name} ${index + 1}`, ...location, trangThai: index === 4 ? 'TAM_NGUNG' : 'HOAT_DONG', nhaXeId: operator.nhaXeId };
      const branch = await findOrCreate(
        db,
        'BuuCuc',
        { nhaXeId: operator.nhaXeId, maBuuCuc: code },
        branchData,
        branchData,
        );
        branches[definition.code].push(branch);
        branchesById.set(branch.buuCucId, branch);
      }
    const sender = branches[definition.code][0];
    const receiver = branches[definition.code][1];
    for (const [fromMethod, toMethod, multiplier] of combos) {
      for (const [fromWeight, toWeight, base] of weightRanges) {
        const rateWhere = { buuCucGuiId: sender.buuCucId, buuCucPhatId: receiver.buuCucId, khoiLuongTu: decimal(fromWeight), khoiLuongDen: toWeight === null ? null : decimal(toWeight), hinhThucLayHang: fromMethod, hinhThucGiaoHang: toMethod, tuNgay: dateOnly(2026, 9, 1), denNgay: null };
        const rate = await findOrCreate(
          db,
          'BangCuocGuiHang',
          rateWhere,
          { ...rateWhere, mucCuoc: decimal(Math.round((base * multiplier) / 5000) * 5000), trangThai: 'DANG_AP_DUNG' },
          { mucCuoc: decimal(Math.round((base * multiplier) / 5000) * 5000), trangThai: 'DANG_AP_DUNG' },
        );
        rates.set(`${definition.code}:${fromWeight}:${toWeight}:${fromMethod}:${toMethod}`, rate);
      }
    }
  }
  const cargo = {};
  for (const [name, description] of cargoTypeDefs) {
    cargo[name] = await upsertBy(db, 'LoaiHangHoa', { tenLoai: name }, { tenLoai: name, moTa: description, trangThai: 'HOAT_DONG' }, { moTa: description, trangThai: 'HOAT_DONG' });
  }
  return { branches, branchesById, rates, cargo };
}

async function seedPromotions(db, operators) {
  const result = {};
  for (const definition of operatorDefs) {
    const operator = operators[definition.code];
    result[definition.code] = [];
    const promotionDefs = [
      { code: `${definition.code}10`, name: 'Ưu đãi đặt vé 10%', scope: 'DAT_VE', apply: 'NHAP_MA', kind: 'PHAN_TRAM', value: 10, max: 50000, from: dateOnly(2026, 9, 1), to: null, status: 'DANG_HOAT_DONG' },
      { code: `${definition.code}SHIP50K`, name: 'Giảm phí gửi hàng 50K', scope: 'GUI_HANG', apply: 'NHAP_MA', kind: 'SO_TIEN', value: 50000, max: null, from: dateOnly(2026, 9, 1), to: null, status: 'DANG_HOAT_DONG' },
      { code: `${definition.code}AUTO`, name: 'Ưu đãi tự động hai dịch vụ', scope: 'CA_HAI', apply: 'TU_DONG', kind: 'PHAN_TRAM', value: 5, max: 30000, from: dateOnly(2026, 10, 1), to: null, status: 'SAP_DIEN_RA' },
      { code: `${definition.code}OLD`, name: 'Chương trình cũ hết hạn', scope: 'DAT_VE', apply: 'NHAP_MA', kind: 'SO_TIEN', value: 30000, max: null, from: dateOnly(2026, 1, 1), to: dateOnly(2026, 2, 1), status: 'HET_HAN' },
      { code: `${definition.code}PAUSE`, name: 'Ưu đãi đang tạm ngưng', scope: 'CA_HAI', apply: 'NHAP_MA', kind: 'PHAN_TRAM', value: 15, max: 70000, from: dateOnly(2026, 9, 1), to: null, status: 'TAM_NGUNG' },
    ];
    for (const item of promotionDefs) {
      const promotion = await findOrCreate(
        db,
        'KhuyenMai',
        { nhaXeId: operator.nhaXeId, maKhuyenMai: item.code },
        { tenChuongTrinh: item.name, maKhuyenMai: item.code, phamViApDung: item.scope, hinhThucApDung: item.apply, loaiGiamGia: item.kind, giaTriGiam: decimal(item.value), giamToiDa: item.max === null ? null : decimal(item.max), giaTriDonToiThieu: null, dieuKienApDung: 'Dữ liệu demo, không áp dụng cho giao dịch seed.', tuNgay: item.from, denNgay: item.to, trangThai: item.status, nhaXeId: operator.nhaXeId },
        { tenChuongTrinh: item.name, trangThai: item.status },
      );
      result[definition.code].push(promotion);
    }
  }
  return result;
}

const shippingPlans = [
  { from: 'GUI_TAI_BUU_CUC', to: 'GIAO_TAI_BUU_CUC', status: 'CHO_DIEU_PHOI', trip: null, note: 'Gửi tại bưu cục, chưa điều phối' },
  { from: 'NHAN_TAN_NOI', to: 'GIAO_TAN_NOI', status: 'MOI_TAO', trip: null, note: 'Nhận và giao tận nơi' },
  { from: 'GUI_TAI_BUU_CUC', to: 'GIAO_TAN_NOI', status: 'DANG_VAN_CHUYEN', trip: 0, note: 'Đang vận chuyển' },
  { from: 'NHAN_TAN_NOI', to: 'GIAO_TAI_BUU_CUC', status: 'DA_GIAO', trip: 1, note: 'Đã giao tại bưu cục' },
  { from: 'GUI_TAI_BUU_CUC', to: 'GIAO_TAI_BUU_CUC', status: 'DA_HUY', trip: null, note: 'Đơn gửi hàng đã hủy' },
  { from: 'NHAN_TAN_NOI', to: 'GIAO_TAI_BUU_CUC', status: 'DANG_VAN_CHUYEN', trip: 2, note: 'Đang vận chuyển đến bưu cục phát' },
  { from: 'GUI_TAI_BUU_CUC', to: 'GIAO_TAI_BUU_CUC', status: 'DA_GIAO', trip: 3, note: 'Đã giao thành công' },
  { from: 'GUI_TAI_BUU_CUC', to: 'GIAO_TAN_NOI', status: 'CHO_DIEU_PHOI', trip: null, note: 'Chờ điều phối' },
];

const cargoKindsByShipment = [
  ['ĐIỆN TỬ', 'BƯU PHẨM'],
  ['THỰC PHẨM'],
  ['THƯ TÍN', 'QUẦN ÁO'],
  ['HẢI SẢN'],
  ['HÀNG GIA DỤNG', 'BƯU PHẨM'],
  ['ĐIỆN TỬ'],
  ['QUẦN ÁO', 'HÀNG GIA DỤNG'],
  ['THỰC PHẨM', 'HẢI SẢN', 'BƯU PHẨM'],
];

const weightRanges = [
  { from: 0, to: 1, actual: 0.5 },
  { from: 1.01, to: 5, actual: 3 },
  { from: 5.01, to: 10, actual: 7 },
  { from: 10.01, to: 20, actual: 15 },
  { from: 20.01, to: 50, actual: 30 },
  { from: 50.01, to: null, actual: 60 },
];

function shippingRateKey(operatorCode, weightIndex, from, to) {
  const range = weightRanges[weightIndex];
  return `${operatorCode}:${range.from}:${range.to}:${from}:${to}`;
}

function cargoKindsFor(shippingOrdinal) {
  return cargoKindsByShipment[shippingOrdinal];
}

function cargoWeightForIndex(itemIndex) {
  return 0.5 + itemIndex * 0.75;
}

function cargoWeightForKinds(cargoKinds) {
  return cargoKinds.reduce((total, _kind, itemIndex) => total + cargoWeightForIndex(itemIndex), 0);
}

function weightIndexForTotal(totalWeight) {
  const index = weightRanges.findIndex((range) => totalWeight >= range.from && (range.to === null || totalWeight <= range.to));
  if (index < 0) throw new Error(`No BangCuocGuiHang weight range covers ${totalWeight}kg`);
  return index;
}

function routeAddress(city, kind) {
  if (city === 'TP.HCM') return kind === 'pickup' ? '18 Đường Điện Biên Phủ, Phường 17, Bình Thạnh, TP.HCM' : '25 Đường Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP.HCM';
  if (city === 'Đà Lạt') return kind === 'pickup' ? '31 Đường Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng' : '88 Đường Phạm Ngũ Lão, Phường 3, Đà Lạt, Lâm Đồng';
  if (city === 'Vũng Tàu') return kind === 'pickup' ? '12 Đường Trần Hưng Đạo, Phường 1, Vũng Tàu, Bà Rịa - Vũng Tàu' : '88 Đường Hoàng Hoa Thám, Phường 2, Vũng Tàu, Bà Rịa - Vũng Tàu';
  return `12 Đường Trần Hưng Đạo, ${city}`;
}

function branchCity(branch) {
  if (branch.quanHuyen === 'Đà Lạt' || branch.quanHuyen === 'Vũng Tàu') return branch.quanHuyen;
  return branch.tinhThanh;
}

function customerSnapshot(customer) {
  return {
    tenKhachHang: customer.account.hoTen,
    soDienThoaiKhachHang: customer.account.soDienThoai,
    emailKhachHang: customer.account.email,
  };
}

async function ensureImage(db, hangHoa, url, order) {
  const existing = await db.HinhAnhHangHoa.findFirst({ where: { hangHoaId: hangHoa.hangHoaId, duongDan: url } });
  const data = { duongDan: url, thuTu: order, hangHoaId: hangHoa.hangHoaId };
  if (existing) {
    await db.HinhAnhHangHoa.update({ where: byId('HinhAnhHangHoa', existing.hinhAnhId), data });
    count('HinhAnhHangHoa', 'update');
    return existing;
  }
  const created = await db.HinhAnhHangHoa.create({ data });
  count('HinhAnhHangHoa', 'create');
  return created;
}

async function ensurePayment(db, data) {
  const existing = await db.ThanhToan.findFirst({ where: { donGiaoDichId: data.donGiaoDichId, loaiGiaoDich: data.loaiGiaoDich, veId: data.veId ?? null } });
  if (existing) {
    const updated = await db.ThanhToan.update({ where: byId('ThanhToan', existing.thanhToanId), data });
    count('ThanhToan', 'update');
    return updated;
  }
  const created = await db.ThanhToan.create({ data });
  count('ThanhToan', 'create');
  return created;
}

async function ensureCargo(db, shipment, cargoType, itemIndex, operatorCode) {
  const names = {
    'BƯU PHẨM': ['Hồ sơ hợp đồng', 'Bưu phẩm chuyển phát'],
    'THỰC PHẨM': ['Cà phê rang xay', 'Bánh đặc sản'],
    'THƯ TÍN': ['Thư mời hội nghị', 'Hồ sơ giấy tờ'],
    'HẢI SẢN': ['Cá khô đóng gói', 'Mực một nắng'],
    'ĐIỆN TỬ': ['Tai nghe không dây', 'Máy tính bảng'],
    'QUẦN ÁO': ['Áo khoác mùa đông', 'Bộ quần áo thể thao'],
    'HÀNG GIA DỤNG': ['Bộ ly thủy tinh', 'Nồi inox gia dụng'],
  };
  const name = names[cargoType][itemIndex % names[cargoType].length];
  const itemData = {
    tenHang: `${name} ${operatorCode}-${itemIndex + 1}`,
    soLuong: itemIndex + 1,
    khoiLuong: decimal(cargoWeightForIndex(itemIndex)),
    chieuDai: decimal(20 + itemIndex * 5),
    chieuRong: decimal(15 + itemIndex * 3),
    chieuCao: decimal(10 + itemIndex * 2),
    giaTriKhaiBao: decimal(200000 + itemIndex * 150000),
    moTa: `Hàng hóa demo thuộc nhóm ${cargoType}.`,
    phieuGuiHangId: shipment.phieuGuiHangId,
    loaiHangHoaId: shipment.cargoTypes[cargoType].loaiHangHoaId,
  };
  const existing = await db.HangHoa.findFirst({ where: { phieuGuiHangId: shipment.phieuGuiHangId, tenHang: itemData.tenHang } });
  const item = existing
    ? await db.HangHoa.update({ where: byId('HangHoa', existing.hangHoaId), data: itemData })
    : await db.HangHoa.create({ data: itemData });
  count('HangHoa', existing ? 'update' : 'create');
  const imageKind = cargoType === 'ĐIỆN TỬ' ? IMAGE_URLS.dienTu : cargoType === 'THỰC PHẨM' || cargoType === 'HẢI SẢN' ? IMAGE_URLS.thucPham : IMAGE_URLS.quanAo;
  await ensureImage(db, item, imageKind, 1);
  if (itemIndex % 2 === 0) await ensureImage(db, item, IMAGE_URLS.quanAo, 2);
  return item;
}

async function seedTransactions(db, operators, accounts, fleet, prices, logistics) {
  const ticketSizes = [1, 2, 1, 5, 2, 3, 1];
  const allTransactionCodes = [];
  const exchangeOldByOperator = new Map();
  for (const definition of operatorDefs) {
    const existingTickets = await db.Ve.findMany({ where: { maVe: { startsWith: `${definition.code}-PDV-` } }, select: { gheChuyenXeId: true } });
    for (const gheChuyenXeId of new Set(existingTickets.map((ticket) => ticket.gheChuyenXeId))) {
      await db.GheChuyenXe.update({ where: byId('GheChuyenXe', gheChuyenXeId), data: { trangThai: 'TRONG' } });
    }
  }
  for (let opIndex = 0; opIndex < operatorDefs.length; opIndex += 1) {
    const definition = operatorDefs[opIndex];
    const operator = operators[definition.code];
    const activeTrips = fleet.trips[definition.code];
    const outboundTrips = activeTrips.filter((trip) => trip.route.tuyenXeId === fleet.routes[definition.code][0].tuyenXeId);
    const operatorCustomers = accounts.customers;
    for (let txIndex = 0; txIndex < 15; txIndex += 1) {
      const hasTicket = txIndex <= 6 || txIndex >= 13;
      const hasShipping = txIndex >= 7;
      const isCombined = txIndex >= 13;
      const customerIndex = txIndex === 13 ? opIndex * 5 + 4 : opIndex * 5 + txIndex;
      const customer = operatorCustomers[customerIndex % operatorCustomers.length];
      const day = 22 + Math.floor(txIndex / 5);
      const minute = (txIndex % 5) * 10;
      const stamp = `${pad(day, 2)}092026${pad(10 + Math.floor(txIndex / 5), 2)}${pad(minute, 2)}`;
      const sequence = pad(txIndex + 1, 4);
      const transactionCode = `${definition.code}-GD-${stamp}-${sequence}`;
      const transactionTime = localDate(2026, 9, day, 10 + Math.floor(txIndex / 5), minute);
      if (txIndex === 4 || txIndex === 13) {
        const staleTransaction = await db.DonGiaoDich.findUnique({ where: { maDonGiaoDich: transactionCode } });
        if (staleTransaction) await db.ThanhToan.deleteMany({ where: { donGiaoDichId: staleTransaction.donGiaoDichId, loaiGiaoDich: { in: ['THU_CHENH_LECH', 'HOAN_TIEN'] } } });
      }
      const ticketPlan = [];
      let ticketSubtotal = 0;
      let chargeTicketSubtotal = 0;
      if (hasTicket) {
        const size = txIndex <= 6 ? ticketSizes[txIndex] : txIndex === 13 ? 2 : 1;
        const oldExchangeTrip = txIndex === 13 ? exchangeOldByOperator.get(definition.code)?.trip : null;
        const preferredTripIndex = txIndex === 4 ? 9 : txIndex === 13 ? 26 : txIndex * 2;
        const trip = selectTripAfter(activeTrips, preferredTripIndex, transactionTime, oldExchangeTrip?.chuyenXeId);
        if (!trip) throw new Error(`No departure after booking time for ${transactionCode}`);
        const typeId = trip.vehicle.loaiXeId;
        const price = prices.get(`${trip.route.tuyenXeId}:${typeId}`);
        if (!price) throw new Error(`Missing BangGia for ${definition.code} trip ${trip.maChuyenXe}`);
        for (let ticketIndex = 0; ticketIndex < size; ticketIndex += 1) {
          const tripSeat = trip.tripSeats[(txIndex * 3 + ticketIndex) % trip.tripSeats.length];
          const cancelled = (txIndex === 3 && ticketIndex === 2) || (txIndex === 4 && ticketIndex === 0);
          const priceAmount = Number(price.giaNiemYet);
          ticketSubtotal += priceAmount;
          if (!(txIndex === 13 && ticketIndex === 0)) chargeTicketSubtotal += priceAmount;
          ticketPlan.push({
            trip,
            tripSeat,
            price,
            priceAmount,
            cancelled,
            ticketIndex,
            code: `${definition.code}-PDV-${stamp}-${sequence}-VE-${pad(ticketIndex + 1, 2)}`,
          });
        }
      }

      const shippingOrdinal = txIndex - 7;
      const shipPlan = hasShipping ? shippingPlans[shippingOrdinal] : null;
      let shippingData = null;
      let shippingTotal = 0;
      if (shipPlan) {
        const cargoKinds = cargoKindsFor(shippingOrdinal);
        const totalCargoWeight = cargoWeightForKinds(cargoKinds);
        const weightIndex = weightIndexForTotal(totalCargoWeight);
        const range = weightRanges[weightIndex];
        const rate = logistics.rates.get(shippingRateKey(definition.code, weightIndex, shipPlan.from, shipPlan.to));
        if (!rate) throw new Error(`Missing BangCuocGuiHang for ${transactionCode}`);
        const rateFromBranch = logistics.branchesById.get(rate.buuCucGuiId);
        const rateToBranch = logistics.branchesById.get(rate.buuCucPhatId);
        if (!rateFromBranch || !rateToBranch) throw new Error(`Missing rate branches for ${transactionCode}`);
        const serviceFee = shipPlan.from === 'NHAN_TAN_NOI' && shipPlan.to === 'GIAO_TAN_NOI' ? 15000 : shipPlan.from === 'NHAN_TAN_NOI' || shipPlan.to === 'GIAO_TAN_NOI' ? 10000 : 0;
        shippingTotal = Number(rate.mucCuoc) + serviceFee;
        const trip = shipPlan.trip === null ? null : selectTripAfter(outboundTrips, shipPlan.trip, transactionTime, null, true);
        shippingData = {
          shipPlan,
          weightIndex,
          range,
          rate,
          serviceFee,
          trip,
          cargoKinds,
          totalCargoWeight,
          rateFromBranch,
          rateToBranch,
          fromBranch: shipPlan.from === 'GUI_TAI_BUU_CUC' ? rateFromBranch : null,
          toBranch: shipPlan.to === 'GIAO_TAI_BUU_CUC' ? rateToBranch : null,
          cargoTypes: logistics.cargo,
        };
      }
      const exchangeOld = txIndex === 13 ? exchangeOldByOperator.get(definition.code) : null;
      if (txIndex === 13 && !exchangeOld) throw new Error(`Missing old ticket for exchange scenario ${definition.code}`);
      const changeDifference = txIndex === 13 ? Number(ticketPlan[0].priceAmount) - Number(exchangeOld.ve.giaThucTe) : 0;
      const total = chargeTicketSubtotal + shippingTotal + changeDifference;
      const paymentState = txIndex === 5 ? 'PENDING' : txIndex === 8 ? 'FAILED' : 'SUCCESS';
      const snapshot = customerSnapshot(customer);
      const transaction = await upsertBy(
        db,
        'DonGiaoDich',
        { maDonGiaoDich: transactionCode },
        { maDonGiaoDich: transactionCode, ngayTao: transactionTime, tongTien: decimal(total), trangThai: paymentState === 'SUCCESS' ? 'DA_THANH_TOAN' : paymentState === 'FAILED' ? 'THAT_BAI' : 'CHO_THANH_TOAN', ...snapshot, khachHangId: customer.khachHangId, nhaXeId: operator.nhaXeId },
        { ngayTao: transactionTime, tongTien: decimal(total), trangThai: paymentState === 'SUCCESS' ? 'DA_THANH_TOAN' : paymentState === 'FAILED' ? 'THAT_BAI' : 'CHO_THANH_TOAN', ...snapshot, khachHangId: customer.khachHangId, nhaXeId: operator.nhaXeId },
      );

      let booking = null;
      let tickets = [];
      if (hasTicket) {
        const bookingCode = `${definition.code}-PDV-${stamp}-${sequence}`;
        booking = await upsertBy(
          db,
          'PhieuDatVe',
          { maPhieuDatVe: bookingCode },
          { maPhieuDatVe: bookingCode, ngayDat: transactionTime, soLuongVeBanDau: ticketPlan.length, tongTienBanDau: decimal(ticketSubtotal), trangThai: paymentState === 'SUCCESS' ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN', khuyenMaiId: null, donGiaoDichId: transaction.donGiaoDichId },
          { ngayDat: transactionTime, soLuongVeBanDau: ticketPlan.length, tongTienBanDau: decimal(ticketSubtotal), trangThai: paymentState === 'SUCCESS' ? 'DA_THANH_TOAN' : 'CHO_THAN_TOAN', khuyenMaiId: null },
        );
        for (const ticket of ticketPlan) {
          const existingSeatTicket = await db.Ve.findFirst({ where: { gheChuyenXeId: ticket.tripSeat.gheChuyenXeId } });
          if (existingSeatTicket && existingSeatTicket.maVe !== ticket.code && existingSeatTicket.trangThai !== 'HUY') {
            const existingSeat = await db.GheChuyenXe.findUnique({ where: byId('GheChuyenXe', ticket.tripSeat.gheChuyenXeId), select: { trangThai: true } });
            if (existingSeat?.trangThai === 'DA_DAT') throw new Error(`Active seat collision on ${ticket.code} and ${existingSeatTicket.maVe}`);
          }
          const ve = await upsertBy(
            db,
            'Ve',
            { maVe: ticket.code },
            { maVe: ticket.code, diemDon: ticket.trip.route.diemDi === 'TP.HCM' ? 'Bến xe Miền Đông mới' : `Văn phòng ${definition.name} ${ticket.trip.route.diemDi}`, giaNiemYet: decimal(ticket.priceAmount), giaThucTe: decimal(ticket.priceAmount), trangThai: ticket.cancelled ? 'HUY' : 'DA_DAT', phieuDatVeId: booking.phieuDatVeId, gheChuyenXeId: ticket.tripSeat.gheChuyenXeId, bangGiaApDungId: ticket.price.bangGiaId },
            { diemDon: ticket.trip.route.diemDi === 'TP.HCM' ? 'Bến xe Miền Đông mới' : `Văn phòng ${definition.name} ${ticket.trip.route.diemDi}`, giaNiemYet: decimal(ticket.priceAmount), giaThucTe: decimal(ticket.priceAmount), trangThai: ticket.cancelled ? 'HUY' : 'DA_DAT', phieuDatVeId: booking.phieuDatVeId, gheChuyenXeId: ticket.tripSeat.gheChuyenXeId, bangGiaApDungId: ticket.price.bangGiaId },
          );
          tickets.push(ve);
          if (txIndex === 4 && ticket.cancelled) {
            exchangeOldByOperator.set(definition.code, { ve, trip: ticket.trip, tripSeat: ticket.tripSeat });
          }
          await db.GheChuyenXe.update({ where: byId('GheChuyenXe', ticket.tripSeat.gheChuyenXeId), data: { trangThai: ticket.cancelled ? 'TRONG' : 'DA_DAT' } });
          count('GheChuyenXe', 'update');
        }
      }

      let shipment = null;
      if (shippingData) {
        const shipmentCode = `${definition.code}-VD-${stamp}-${sequence}`;
        const shipmentData = {
          maVanDon: shipmentCode,
          tenNguoiNhan: `Người nhận ${definition.code}-${shippingOrdinal + 1}`,
          soDienThoaiNguoiNhan: `+8493${pad(opIndex * 10 + shippingOrdinal + 1, 7)}`,
          diaChiNguoiNhan: shippingData.toBranch ? shippingData.toBranch.diaChi : routeAddress(branchCity(shippingData.rateToBranch), 'delivery'),
          hinhThucLayHang: shippingData.shipPlan.from,
          hinhThucGiaoHang: shippingData.shipPlan.to,
          diaChiLayHang: shippingData.fromBranch ? shippingData.fromBranch.diaChi : routeAddress(branchCity(shippingData.rateFromBranch), 'pickup'),
          ngayGui: transactionTime,
          cuocChinh: decimal(Number(shippingData.rate.mucCuoc)),
          phiDichVu: decimal(shippingData.serviceFee),
          soTienGiam: decimal(0),
          tongPhi: decimal(shippingTotal),
          nguoiTraCuoc: shippingOrdinal % 2 === 0 ? 'NGUOI_GUI' : 'NGUOI_NHAN',
          ghiChu: shippingData.shipPlan.note,
          trangThai: shippingData.shipPlan.status,
          chuyenXeId: shippingData.trip?.chuyenXeId ?? null,
          buuCucGuiId: shippingData.fromBranch?.buuCucId ?? null,
          buuCucPhatId: shippingData.toBranch?.buuCucId ?? null,
          bangCuocApDungId: shippingData.rate.bangCuocGuiHangId,
          khuyenMaiId: null,
          donGiaoDichId: transaction.donGiaoDichId,
        };
        shipment = await upsertBy(db, 'PhieuGuiHang', { maVanDon: shipmentCode }, shipmentData, shipmentData);
        const cargoKinds = shippingData.cargoKinds;
        const cargoShipment = { ...shipment, cargoTypes: logistics.cargo };
        for (let itemIndex = 0; itemIndex < cargoKinds.length; itemIndex += 1) {
          await ensureCargo(db, cargoShipment, cargoKinds[itemIndex], itemIndex, definition.code);
        }
      }

      if (paymentState === 'FAILED' || paymentState === 'PENDING') {
        await ensurePayment(db, { soTien: decimal(total), phuongThuc: paymentState === 'FAILED' ? 'VNPAY' : 'MOMO', loaiGiaoDich: 'THANH_TOAN', thoiGian: transactionTime, trangThai: paymentState === 'FAILED' ? 'THAT_BAI' : 'DANG_XU_LY', donGiaoDichId: transaction.donGiaoDichId, veId: null });
      } else {
        const initialAmount = changeDifference ? total - changeDifference : total;
        await ensurePayment(db, { soTien: decimal(initialAmount), phuongThuc: ['MOMO', 'VNPAY', 'ZALOPAY', 'TIEN_MAT'][txIndex % 4], loaiGiaoDich: 'THANH_TOAN', thoiGian: transactionTime, trangThai: 'THANH_CONG', donGiaoDichId: transaction.donGiaoDichId, veId: null });
        if (txIndex === 13) {
          const exchangeNew = tickets[0];
          if (!exchangeOld || !exchangeNew || exchangeOld.trip.chuyenXeId === ticketPlan[0].trip.chuyenXeId) {
            throw new Error(`Invalid exchange scenario for ${definition.code}: old and new trip must differ`);
          }
          if (changeDifference !== 0) {
            await ensurePayment(db, { soTien: decimal(Math.abs(changeDifference)), phuongThuc: 'VNPAY', loaiGiaoDich: changeDifference > 0 ? 'THU_CHENH_LECH' : 'HOAN_TIEN', thoiGian: localDate(2026, 9, day, 11 + Math.floor(txIndex / 5), minute), trangThai: 'THANH_CONG', donGiaoDichId: transaction.donGiaoDichId, veId: exchangeNew.veId });
          }
          scenarios.push({ type: 'doi-ve-that-chenh-lech', khachHangId: customer.khachHangId, maDonGiaoDich: transactionCode, veCu: exchangeOld.ve.maVe, veMoi: exchangeNew.maVe, chuyenXeCu: exchangeOld.trip.maChuyenXe, chuyenXeMoi: ticketPlan[0].trip.maChuyenXe, giaVeCu: Number(exchangeOld.ve.giaThucTe), giaVeMoi: Number(exchangeNew.giaThucTe), giaVeMoiKhongDoi: Number(ticketPlan.slice(1).reduce((sum, ticket) => sum + ticket.priceAmount, 0)), phiGuiHang: shippingTotal, thanhToanDichVuMoi: initialAmount, tongTienGiaoDich: total, soTienChenhLech: changeDifference, loaiGiaoDich: changeDifference > 0 ? 'THU_CHENH_LECH' : changeDifference < 0 ? 'HOAN_TIEN' : null });
        }
        const cancelledTicket = tickets.find((ticket) => ticket.trangThai === 'HUY');
        if (cancelledTicket && txIndex !== 4) {
          await ensurePayment(db, { soTien: decimal(Number(cancelledTicket.giaThucTe)), phuongThuc: 'MOMO', loaiGiaoDich: 'HOAN_TIEN', thoiGian: localDate(2026, 9, day, 12, minute), trangThai: 'THANH_CONG', donGiaoDichId: transaction.donGiaoDichId, veId: cancelledTicket.veId });
          scenarios.push({ type: 'huy-rieng-mot-ve-hoan-tien', maDonGiaoDich: transactionCode, maVe: cancelledTicket.maVe });
        }
        await upsertBy(
          db,
          'HoaDon',
          { maHoaDon: `${definition.code}-HD-${stamp}-${sequence}` },
          { maHoaDon: `${definition.code}-HD-${stamp}-${sequence}`, ngayLap: transactionTime, tongTien: decimal(total), trangThai: 'DA_PHAT_HANH', donGiaoDichId: transaction.donGiaoDichId },
          { ngayLap: transactionTime, tongTien: decimal(total), trangThai: 'DA_PHAT_HANH' },
        );
      }
      if (ticketPlan.length === 5) scenarios.push({ type: 'booking-5-ve', maDonGiaoDich: transactionCode, maPhieuDatVe: booking.maPhieuDatVe, maVe: tickets.map((ticket) => ticket.maVe) });
      if (shippingData?.shipPlan.trip === null) scenarios.push({ type: 'gui-hang-chua-dieu-phoi', maDonGiaoDich: transactionCode, maVanDon: shipment.maVanDon });
      if (shippingData?.shipPlan.status === 'DA_GIAO') scenarios.push({ type: 'gui-hang-da-giao', maDonGiaoDich: transactionCode, maVanDon: shipment.maVanDon });
      allTransactionCodes.push(transactionCode);
    }
  }
  return allTransactionCodes;
}

async function applyCustomerSnapshotChange(db, accounts) {
  const customer = accounts.customers[0];
  await db.TaiKhoan.update({ where: byId('TaiKhoan', customer.account.taiKhoanId), data: { hoTen: 'Nguyễn Minh Anh (đã cập nhật)', soDienThoai: '+84929999999', email: 'kh000001.updated@vexgo.test' } });
  count('TaiKhoan', 'snapshot-update');
}

function printSummary(transactionCodes) {
  console.log(`Seed timezone: ${TZ}`);
  console.log(`Password policy: shared development password hashed with bcrypt (10 rounds); plaintext is never stored.`);
  console.log(`Transactions: ${transactionCodes.length}`);
  console.log(`Scenarios: ${JSON.stringify(scenarios)}`);
  console.log('Operations:');
  for (const [key, value] of [...counts.entries()].sort()) console.log(`  ${key}=${value}`);
}

async function main() {
  await prisma.$connect();
  const operators = await seedOperators(prisma);
  const vehicleTypes = await seedVehicleTypes(prisma);
  const roles = await seedRoles(prisma);
  const accounts = await seedAccounts(prisma, operators, roles);
  const fleet = await seedVehiclesAndRoutes(prisma, operators, vehicleTypes);
  const prices = await seedPrices(prisma, fleet.routes, vehicleTypes);
  const cargoAndLogistics = await seedBranchesRatesCargo(prisma, operators, {});
  const promotions = await seedPromotions(prisma, operators);
  void promotions;
  const transactions = await seedTransactions(prisma, operators, accounts, fleet, prices, cargoAndLogistics);
  await applyCustomerSnapshotChange(prisma, accounts);
  printSummary(transactions);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
