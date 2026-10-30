import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { LocationsService } from '../../../src/locations/locations.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';

function readLocalEnvValue(name: string): string | undefined {
  const candidates = [
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const line = readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    if (line) return line.slice(name.length + 1).trim();
  }
  return undefined;
}

// Biến môi trường riêng cho test tích hợp Task 4 (giống FEATURE07_TEST_DATABASE_URL ở test khác)
// Tự động skip khi chưa cấu hình TASK4_TEST_DATABASE_URL
const testDatabaseUrl =
  process.env.TASK4_TEST_DATABASE_URL ??
  readLocalEnvValue('TASK4_TEST_DATABASE_URL');
const describeDb = testDatabaseUrl ? describe : describe.skip;

describeDb('Task 4 - Location Key-based Search with real MySQL Database', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tripsService: TripsService;

  const testSuffix = randomUUID().slice(0, 8);
  const companyCode = `LOC-NX-${testSuffix}`;
  let nhaXeId: number;
  let routeHcmDlId: number;
  let routeYenBaiHnId: number;
  let routeLaoCaiHnId: number;
  let routeThuDauMotId: number;
  let routeDiAnId: number;
  let routeThuDucId: number;
  let vehicleId: number;

  let tripHcmId: number;
  let tripBinhDuongId: number;
  let tripVungTauId: number;
  let tripHcmStringOnlyWithBdStationId: number;
  let tripYenBaiId: number;
  let tripLaoCaiId: number;
  let tripNoPointsThuDauMotId: number;
  let tripNoPointsDiAnId: number;
  let tripNoPointsThuDucId: number;

  // Dynamic IDs queried from DB via unique composite (code, laDiaDanhCu)
  let hcmMoiId: number;
  let hcmCuId: number;
  let bdCuId: number;
  let vtCuId: number;
  let yenBaiCuId: number;
  let laoCaiMoiId: number;
  let bxBinhDuongId: number;

  let diAnDistrictId: number | undefined;
  let thuDucDistrictId: number | undefined;

  const tomorrowDateStr = '2026-11-15';
  const tomorrowDate = new Date(`${tomorrowDateStr}T00:00:00.000Z`);

  beforeAll(async () => {
    if (testDatabaseUrl) {
      process.env.DATABASE_URL = testDatabaseUrl;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);
    tripsService = app.get(TripsService);

    // 1. Tra cứu động các địa danh theo (code, laDiaDanhCu) - không phụ thuộc auto-increment ID
    const hcmCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 79, laDiaDanhCu: true } },
    });
    const hcmMoi = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 79, laDiaDanhCu: false } },
    });
    const bdCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 74, laDiaDanhCu: true } },
    });
    const vtCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 77, laDiaDanhCu: true } },
    });
    const yenBaiCu = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 15, laDiaDanhCu: true } },
    });
    const laoCaiMoi = await prisma.danhMucDiaDiem.findUniqueOrThrow({
      where: { code_laDiaDanhCu: { code: 15, laDiaDanhCu: false } },
    });

    hcmCuId = hcmCu.diaDiemId;
    hcmMoiId = hcmMoi.diaDiemId;
    bdCuId = bdCu.diaDiemId;
    vtCuId = vtCu.diaDiemId;
    yenBaiCuId = yenBaiCu.diaDiemId;
    laoCaiMoiId = laoCaiMoi.diaDiemId;

    // Đảm bảo quận/huyện "Dĩ An" (thuộc Bình Dương cũ, diaDiemChaId = bdCuId) tồn tại
    // Đây là quận/huyện KHÔNG nằm trong master alias của Bình Dương (master chỉ có Bình Dương, Thủ Dầu Một)
    const districtDiAn = await prisma.danhMucDiaDiem.upsert({
      where: { code_laDiaDanhCu: { code: 719, laDiaDanhCu: true } },
      update: {
        diaDiemChaId: bdCuId,
        trangThai: 'HOAT_DONG',
      },
      create: {
        maDiaDiem: `DIST-DIAN-${testSuffix}`,
        code: 719,
        tenDiaDiem: 'Thị xã Dĩ An',
        tenKhongDau: 'di an',
        capDiaDiem: 'QUAN_HUYEN',
        laDiaDanhCu: true,
        diaDiemChaId: bdCuId,
        trangThai: 'HOAT_DONG',
      },
    });
    diAnDistrictId = districtDiAn.diaDiemId;

    // Đảm bảo quận/huyện "Thủ Đức" (thuộc TP.HCM cũ, diaDiemChaId = hcmCuId) tồn tại
    const districtThuDuc = await prisma.danhMucDiaDiem.upsert({
      where: { code_laDiaDanhCu: { code: 769, laDiaDanhCu: true } },
      update: {
        diaDiemChaId: hcmCuId,
        trangThai: 'HOAT_DONG',
      },
      create: {
        maDiaDiem: `DIST-THUDUC-${testSuffix}`,
        code: 769,
        tenDiaDiem: 'Thành phố Thủ Đức',
        tenKhongDau: 'thu duc',
        capDiaDiem: 'QUAN_HUYEN',
        laDiaDanhCu: true,
        diaDiemChaId: hcmCuId,
        trangThai: 'HOAT_DONG',
      },
    });
    thuDucDistrictId = districtThuDuc.diaDiemId;

    // Nạp lại LocationsService cache để cập nhật các quận/huyện vừa tạo
    const locationsService = app.get(LocationsService);
    await (locationsService as any).refresh();

    // 2. Tạo Nhà Xe test
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyCode,
        tenNhaXe: `Nhà xe Test Loc ${testSuffix}`,
        thongTinLienHe: '0901234567',
        trangThai: 'HOAT_DONG',
      },
    });
    nhaXeId = company.nhaXeId;

    // 3. Tạo Tuyến Xe
    const route1 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-HCM-DL-${testSuffix}`,
        diemDi: 'TP.HCM',
        diemDen: 'Đà Lạt',
        thoiGianChayPhut: 360,
        trangThai: 'HOAT_DONG',
      },
    });
    routeHcmDlId = route1.tuyenXeId;

    const route2 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-YB-HN-${testSuffix}`,
        diemDi: 'Yên Bái',
        diemDen: 'Hà Nội',
        thoiGianChayPhut: 240,
        trangThai: 'HOAT_DONG',
      },
    });
    routeYenBaiHnId = route2.tuyenXeId;

    const route3 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-LC-HN-${testSuffix}`,
        diemDi: 'Lào Cai',
        diemDen: 'Hà Nội',
        thoiGianChayPhut: 300,
        trangThai: 'HOAT_DONG',
      },
    });
    routeLaoCaiHnId = route3.tuyenXeId;

    // Tuyến đường ghi "Thủ Dầu Một" phục vụ kiểm chứng ca 5 (dự phòng chuỗi theo mục danh mục)
    const route4 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-TDM-DL-${testSuffix}`,
        diemDi: 'Thủ Dầu Một',
        diemDen: 'Đà Lạt',
        thoiGianChayPhut: 360,
        trangThai: 'HOAT_DONG',
      },
    });
    routeThuDauMotId = route4.tuyenXeId;

    // Tuyến đường ghi "Dĩ An" phục vụ kiểm chứng ca 7 (quận/huyện không nằm trong master alias)
    const route5 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-DA-DL-${testSuffix}`,
        diemDi: 'Dĩ An',
        diemDen: 'Đà Lạt',
        thoiGianChayPhut: 360,
        trangThai: 'HOAT_DONG',
      },
    });
    routeDiAnId = route5.tuyenXeId;

    // Tuyến đường ghi "Thủ Đức" phục vụ kiểm chứng ca 8 (bản CŨ TP.HCM cũng gom quận/huyện con của chính nó)
    const route6 = await prisma.tuyenXe.create({
      data: {
        nhaXeId,
        maTuyenXe: `TX-TD-DL-${testSuffix}`,
        diemDi: 'Thủ Đức',
        diemDen: 'Đà Lạt',
        thoiGianChayPhut: 360,
        trangThai: 'HOAT_DONG',
      },
    });
    routeThuDucId = route6.tuyenXeId;

    // 4. Tạo Loại Xe và Xe
    const loaiXe = await prisma.loaiXe.create({
      data: {
        nhaXeId,
        tenLoai: 'Giường nằm 34 chỗ test',
      },
    });
    const vehicle = await prisma.xe.create({
      data: {
        nhaXeId,
        bienSoXe: `51B-${testSuffix.slice(0, 5)}`,
        loaiXeId: loaiXe.loaiXeId,
        trangThai: 'HOAT_DONG',
      },
    });
    vehicleId = vehicle.xeId;

    // 5. Tìm các điểm đón trả có sẵn trong DB theo ID động
    const bxMienDong = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: hcmCuId, diaDiemMoiId: hcmMoiId, trangThai: 'HOAT_DONG' },
    });
    const bxBinhDuong = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: bdCuId, diaDiemMoiId: hcmMoiId, trangThai: 'HOAT_DONG' },
    });
    bxBinhDuongId = bxBinhDuong.diemDonTraId;

    const bxVungTau = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: vtCuId, diaDiemMoiId: hcmMoiId, trangThai: 'HOAT_DONG' },
    });

    // Tạo thêm 2 điểm cho Yên Bái và Lào Cai
    const pointYenBai = await prisma.diemDonTra.upsert({
      where: { nhaXeId_maDiem: { nhaXeId, maDiem: `BX-YB-${testSuffix}` } },
      update: {},
      create: {
        nhaXeId,
        maDiem: `BX-YB-${testSuffix}`,
        tenDiem: 'Bến xe Yên Bái',
        loaiDiem: 'BEN_XE',
        diaChi: 'TP. Yên Bái',
        diaDiemCuId: yenBaiCuId,
        diaDiemMoiId: laoCaiMoiId,
        trangThai: 'HOAT_DONG',
      },
    });

    const laoCaiCu = await prisma.danhMucDiaDiem.findFirst({
      where: { tenDiaDiem: { contains: 'Lào Cai' }, laDiaDanhCu: true },
    });
    const laoCaiCuId = laoCaiCu?.diaDiemId ?? laoCaiMoiId;

    const pointLaoCai = await prisma.diemDonTra.upsert({
      where: { nhaXeId_maDiem: { nhaXeId, maDiem: `BX-LC-${testSuffix}` } },
      update: {},
      create: {
        nhaXeId,
        maDiem: `BX-LC-${testSuffix}`,
        tenDiem: 'Bến xe Trung tâm Lào Cai',
        loaiDiem: 'BEN_XE',
        diaChi: 'TP. Lào Cai',
        diaDiemCuId: laoCaiCuId,
        diaDiemMoiId: laoCaiMoiId,
        trangThai: 'HOAT_DONG',
      },
    });

    // 6. Tạo các chuyến xe test
    // Chuyến 1: Đón tại TP.HCM cũ (BX Miền Đông)
    const tripHcm = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeHcmDlId,
        xeId: vehicleId,
        maChuyenXe: `CX-HCM-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: bxMienDong.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripHcmId = tripHcm.chuyenXeId;

    // Chuyến 2: Đón tại Bình Dương cũ (BX Bình Dương)
    const tripBd = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeHcmDlId,
        xeId: vehicleId,
        maChuyenXe: `CX-BD-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T09:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: bxBinhDuong.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripBinhDuongId = tripBd.chuyenXeId;

    // Chuyến 3: Đón tại Vũng Tàu cũ (BX Vũng Tàu)
    const tripVt = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeHcmDlId,
        xeId: vehicleId,
        maChuyenXe: `CX-VT-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T10:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: bxVungTau.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripVungTauId = tripVt.chuyenXeId;

    // Chuyến 4: Tuyến đường ghi "TP.HCM - Đà Lạt", NHƯNG đã gán điểm đón BX Bình Dương
    const tripBdWithStringHcm = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeHcmDlId,
        xeId: vehicleId,
        maChuyenXe: `CX-BD-STR-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T11:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: bxBinhDuong.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripHcmStringOnlyWithBdStationId = tripBdWithStringHcm.chuyenXeId;

    // Chuyến 5: Đón tại Yên Bái cũ (code 15 cũ)
    const tripYb = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeYenBaiHnId,
        xeId: vehicleId,
        maChuyenXe: `CX-YB-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T12:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: pointYenBai.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripYenBaiId = tripYb.chuyenXeId;

    // Chuyến 6: Đón tại Lào Cai cũ (thuộc Lào Cai mới, code 15 mới)
    const tripLc = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeLaoCaiHnId,
        xeId: vehicleId,
        maChuyenXe: `CX-LC-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T13:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        diemDonTraChuyenXes: {
          create: [{ diemDonTraId: pointLaoCai.diemDonTraId, loaiDiem: 'DON', thuTu: 1 }],
        },
      },
    });
    tripLaoCaiId = tripLc.chuyenXeId;

    // Chuyến 7 (Ca 5): Tuyến ghi diemDi = "Thủ Dầu Một", CHƯA GÁN BẤT KỲ ĐIỂM ĐÓN NÀO
    const tripTdmNoPoints = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeThuDauMotId,
        xeId: vehicleId,
        maChuyenXe: `CX-TDM-NO-PTS-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T14:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
      },
    });
    tripNoPointsThuDauMotId = tripTdmNoPoints.chuyenXeId;

    // Chuyến 8 (Ca 7): Tuyến ghi diemDi = "Dĩ An" (quận/huyện KHÔNG nằm trong master alias của Bình Dương)
    const tripDiAnNoPoints = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeDiAnId,
        xeId: vehicleId,
        maChuyenXe: `CX-DA-NO-PTS-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T15:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
      },
    });
    tripNoPointsDiAnId = tripDiAnNoPoints.chuyenXeId;

    // Chuyến 9 (Ca 8): Tuyến ghi diemDi = "Thủ Đức" (quận/huyện thuộc chính TP.HCM cũ)
    const tripThuDucNoPoints = await prisma.chuyenXe.create({
      data: {
        nhaXeId,
        tuyenXeId: routeThuDucId,
        xeId: vehicleId,
        maChuyenXe: `CX-TD-NO-PTS-${testSuffix}`,
        ngayKhoiHanh: tomorrowDate,
        gioKhoiHanh: new Date('1970-01-01T16:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
      },
    });
    tripNoPointsThuDucId = tripThuDucNoPoints.chuyenXeId;
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (prisma && nhaXeId) {
      await prisma.diemDonTraChuyenXe.deleteMany({
        where: { chuyenXe: { nhaXeId } },
      });
      await prisma.gheChuyenXe.deleteMany({
        where: { chuyenXe: { nhaXeId } },
      });
      await prisma.chuyenXe.deleteMany({
        where: { nhaXeId },
      });
      await prisma.diemDonTra.deleteMany({
        where: { nhaXeId },
      });
      await prisma.xe.deleteMany({
        where: { nhaXeId },
      });
      await prisma.loaiXe.deleteMany({
        where: { nhaXeId },
      });
      await prisma.tuyenXe.deleteMany({
        where: { nhaXeId },
      });
      await prisma.nhaXe.deleteMany({
        where: { nhaXeId },
      });
    }

    if (prisma && diAnDistrictId) {
      await prisma.danhMucDiaDiem.deleteMany({
        where: { diaDiemId: diAnDistrictId, maDiaDiem: `DIST-DIAN-${testSuffix}` },
      });
    }
    if (prisma && thuDucDistrictId) {
      await prisma.danhMucDiaDiem.deleteMany({
        where: { diaDiemId: thuDucDistrictId, maDiaDiem: `DIST-THUDUC-${testSuffix}` },
      });
    }

    if (app) await app.close();
  });

  // Ca 1: Tìm TP.HCM cũ: Trả về chuyến TP.HCM; KHÔNG ra chuyến Bình Dương/Vũng Tàu
  it('Ca 1 (DB thật): Tìm TP.HCM cũ -> MySQL chỉ trả về chuyến TP.HCM cũ, KHÔNG ra chuyến Bình Dương hay Vũng Tàu', async () => {
    const result = await tripsService.search({
      fromLocationId: hcmCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    expect(returnedTripIds).toContain(tripHcmId);
    expect(returnedTripIds).not.toContain(tripBinhDuongId);
    expect(returnedTripIds).not.toContain(tripVungTauId);
  });

  // Ca 2: Tìm TP.HCM mới: Trả về cả ba chuyến cùng subAreas
  it('Ca 2 (DB thật): Tìm TP.HCM mới -> MySQL trả về cả 3 chuyến thuộc cụm sáp nhập cùng fromSubAreas', async () => {
    const result = await tripsService.search({
      fromLocationId: hcmMoiId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    expect(returnedTripIds).toContain(tripHcmId);
    expect(returnedTripIds).toContain(tripBinhDuongId);
    expect(returnedTripIds).toContain(tripVungTauId);

    // fromSubAreas đếm đúng các chuyến của từng tỉnh thành phần
    expect(result.fromSubAreas).toBeDefined();
    const hcmSub = result.fromSubAreas?.find((s) => s.diaDiemId === hcmCuId);
    const bdSub = result.fromSubAreas?.find((s) => s.diaDiemId === bdCuId);
    const vtSub = result.fromSubAreas?.find((s) => s.diaDiemId === vtCuId);

    expect(hcmSub?.tripCount).toBeGreaterThanOrEqual(1);
    expect(bdSub?.tripCount).toBeGreaterThanOrEqual(1);
    expect(vtSub?.tripCount).toBeGreaterThanOrEqual(1);
  });

  // Ca 3: Mã 15 Yên Bái cũ không ra chuyến Lào Cai mới
  it('Ca 3 (DB thật): Mã 15 Yên Bái cũ -> MySQL chỉ trả về chuyến Yên Bái cũ, KHÔNG ra chuyến Lào Cai mới', async () => {
    const result = await tripsService.search({
      fromLocationId: yenBaiCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    expect(returnedTripIds).toContain(tripYenBaiId);
    expect(returnedTripIds).not.toContain(tripLaoCaiId);
  });

  // Ca 4: Chuyến đã gán điểm không bị dự phòng chuỗi làm sai
  it('Ca 4 (DB thật): Chuyến có tuyến đường ghi "TP.HCM" nhưng đã gán điểm đón tại Bình Dương -> KHÔNG bị khớp sai vào TP.HCM cũ', async () => {
    const result = await tripsService.search({
      fromLocationId: hcmCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    expect(returnedTripIds).not.toContain(tripHcmStringOnlyWithBdStationId);
  });

  // Ca 5: Chuyến CHƯA gán điểm đón, tuyến ghi diemDi = 'Thủ Dầu Một'
  it('Ca 5 (DB thật): Chuyến CHƯA gán điểm đón, tuyến ghi diemDi = "Thủ Dầu Một" -> tìm TP.HCM mới thì RA, tìm TP.HCM cũ thì KHÔNG RA', async () => {
    // Tìm TP.HCM mới: terms chứa "Thủ Dầu Một" (sáp nhập Bình Dương) -> PHẢI RA
    const resultMoi = await tripsService.search({
      fromLocationId: hcmMoiId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedMoiIds = resultMoi.data.map((t) => t.id);
    expect(returnedMoiIds).toContain(tripNoPointsThuDauMotId);

    // Tìm TP.HCM cũ: terms chỉ gồm TP.HCM -> KHÔNG ĐƯỢC RA
    const resultCu = await tripsService.search({
      fromLocationId: hcmCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedCuIds = resultCu.data.map((t) => t.id);
    expect(returnedCuIds).not.toContain(tripNoPointsThuDauMotId);
  });

  // Ca 6: Tìm fromStationId = bến Bình Dương -> chỉ ra chuyến đã gán đúng bến đó
  it('Ca 6 (DB thật): Tìm fromStationId = bến Bình Dương -> CHỈ ra các chuyến đã gán đúng bến đó', async () => {
    const result = await tripsService.search({
      fromStationId: bxBinhDuongId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    // Chuyến 2 và chuyến 4 gán BX Bình Dương
    expect(returnedTripIds).toContain(tripBinhDuongId);
    expect(returnedTripIds).toContain(tripHcmStringOnlyWithBdStationId);

    // Các chuyến khác không được có
    expect(returnedTripIds).not.toContain(tripHcmId);
    expect(returnedTripIds).not.toContain(tripVungTauId);
    expect(returnedTripIds).not.toContain(tripYenBaiId);
    expect(returnedTripIds).not.toContain(tripLaoCaiId);
    expect(returnedTripIds).not.toContain(tripNoPointsThuDauMotId);
  });

  // Ca 7: Tuyến chưa gán điểm ghi quận/huyện KHÔNG nằm trong master alias ("Dĩ An" thuộc Bình Dương)
  it('Ca 7 (DB thật): Tuyến chưa gán điểm ghi quận/huyện KHÔNG nằm trong master alias ("Dĩ An" thuộc Bình Dương) -> tìm TP.HCM mới thì RA, tìm TP.HCM cũ thì KHÔNG RA', async () => {
    // Tìm TP.HCM mới: TP.HCM mới gom Bình Dương cùng quận/huyện Dĩ An từ DB -> PHẢI RA
    const resultMoi = await tripsService.search({
      fromLocationId: hcmMoiId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedMoiIds = resultMoi.data.map((t) => t.id);
    expect(returnedMoiIds).toContain(tripNoPointsDiAnId);

    // Tìm TP.HCM cũ: TP.HCM cũ không gom Bình Dương / Dĩ An -> KHÔNG ĐƯỢC RA
    const resultCu = await tripsService.search({
      fromLocationId: hcmCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedCuIds = resultCu.data.map((t) => t.id);
    expect(returnedCuIds).not.toContain(tripNoPointsDiAnId);
  });

  // Ca 8: Bản CŨ TP.HCM cũng gom quận/huyện của chính nó ("Thủ Đức")
  it('Ca 8 (DB thật): Tuyến chưa gán điểm ghi "Thủ Đức" (quận/huyện thuộc TP.HCM cũ) -> tìm TP.HCM cũ thì RA, tìm TP.HCM mới cũng RA', async () => {
    // Tìm TP.HCM cũ: bản cũ cũng gom quận/huyện con của chính nó -> PHẢI RA
    const resultCu = await tripsService.search({
      fromLocationId: hcmCuId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedCuIds = resultCu.data.map((t) => t.id);
    expect(returnedCuIds).toContain(tripNoPointsThuDucId);

    // Tìm TP.HCM mới: bản mới bao trùm cả TP.HCM cũ và quận/huyện của nó -> PHẢI RA
    const resultMoi = await tripsService.search({
      fromLocationId: hcmMoiId,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });
    const returnedMoiIds = resultMoi.data.map((t) => t.id);
    expect(returnedMoiIds).toContain(tripNoPointsThuDucId);
  });
});
