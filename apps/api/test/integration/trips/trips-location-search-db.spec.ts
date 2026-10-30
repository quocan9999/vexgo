import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { TripsService } from '../../../src/trips/trips.service.js';

describe('Task 4 - Location Key-based Search with real MySQL Database', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tripsService: TripsService;

  const testSuffix = randomUUID().slice(0, 8);
  const companyCode = `LOC-NX-${testSuffix}`;
  let nhaXeId: number;
  let routeHcmDlId: number;
  let routeYenBaiHnId: number;
  let routeLaoCaiHnId: number;
  let vehicleId: number;

  let tripHcmId: number;
  let tripBinhDuongId: number;
  let tripVungTauId: number;
  let tripHcmStringOnlyWithBdStationId: number;
  let tripYenBaiId: number;
  let tripLaoCaiId: number;

  // DB IDs from master seed
  const HCM_MOI_ID = 28; // diaDiemId của TP.HCM mới (code 79, laDiaDanhCu: false)
  const HCM_CU_ID = 84;  // diaDiemId của TP.HCM cũ (code 79, laDiaDanhCu: true)
  const BD_CU_ID = 81;   // diaDiemId của Bình Dương cũ (code 74, laDiaDanhCu: true)
  const VT_CU_ID = 83;   // diaDiemId của Bà Rịa - Vũng Tàu cũ (code 77, laDiaDanhCu: true)
  const YEN_BAI_CU_ID = 44; // diaDiemId của Yên Bái cũ (code 15, laDiaDanhCu: true)
  const LAO_CAI_MOI_ID = 7; // diaDiemId của Lào Cai mới (code 15, laDiaDanhCu: false)

  const tomorrowDateStr = '2026-11-15';
  const tomorrowDate = new Date(`${tomorrowDateStr}T00:00:00.000Z`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    prisma = app.get(PrismaService);
    tripsService = app.get(TripsService);

    // 1. Tạo Nhà Xe test
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: companyCode,
        tenNhaXe: `Nhà xe Test Loc ${testSuffix}`,
        thongTinLienHe: '0901234567',
        trangThai: 'HOAT_DONG',
      },
    });
    nhaXeId = company.nhaXeId;

    // 2. Tạo Tuyến Xe
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

    // 3. Tạo Loại Xe và Xe
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

    // 4. Tìm các điểm đón trả có sẵn trong DB
    const bxMienDong = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: HCM_CU_ID, diaDiemMoiId: HCM_MOI_ID, trangThai: 'HOAT_DONG' },
    });
    const bxBinhDuong = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: BD_CU_ID, diaDiemMoiId: HCM_MOI_ID, trangThai: 'HOAT_DONG' },
    });
    const bxVungTau = await prisma.diemDonTra.findFirstOrThrow({
      where: { diaDiemCuId: VT_CU_ID, diaDiemMoiId: HCM_MOI_ID, trangThai: 'HOAT_DONG' },
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
        diaDiemCuId: YEN_BAI_CU_ID,
        diaDiemMoiId: LAO_CAI_MOI_ID,
        trangThai: 'HOAT_DONG',
      },
    });

    const pointLaoCai = await prisma.diemDonTra.upsert({
      where: { nhaXeId_maDiem: { nhaXeId, maDiem: `BX-LC-${testSuffix}` } },
      update: {},
      create: {
        nhaXeId,
        maDiem: `BX-LC-${testSuffix}`,
        tenDiem: 'Bến xe Trung tâm Lào Cai',
        loaiDiem: 'BEN_XE',
        diaChi: 'TP. Lào Cai',
        diaDiemCuId: 40, // Lào Cai cũ
        diaDiemMoiId: LAO_CAI_MOI_ID,
        trangThai: 'HOAT_DONG',
      },
    });

    // 5. Tạo các chuyến xe test
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

    // Chuyến 4: Tuyến đường ghi "TP.HCM - Đà Lạt" (tuyenXe.diemDi = 'TP.HCM'), NHƯNG đã gán điểm đón BX Bình Dương
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
    if (app) await app.close();
  });

  // Ca 1: Tìm TP.HCM cũ (id 84): Trả về chuyến TP.HCM; KHÔNG ra chuyến Bình Dương/Vũng Tàu
  it('Ca 1 (DB thật): Tìm TP.HCM cũ (id 84) -> MySQL chỉ trả về chuyến TP.HCM cũ, KHÔNG ra chuyến Bình Dương hay Vũng Tàu', async () => {
    const result = await tripsService.search({
      fromLocationId: HCM_CU_ID,
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

  // Ca 2: Tìm TP.HCM mới (id 28): Trả về cả ba chuyến cùng subAreas
  it('Ca 2 (DB thật): Tìm TP.HCM mới (id 28) -> MySQL trả về cả 3 chuyến thuộc cụm sáp nhập cùng fromSubAreas', async () => {
    const result = await tripsService.search({
      fromLocationId: HCM_MOI_ID,
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
    const hcmSub = result.fromSubAreas?.find((s) => s.diaDiemId === HCM_CU_ID);
    const bdSub = result.fromSubAreas?.find((s) => s.diaDiemId === BD_CU_ID);
    const vtSub = result.fromSubAreas?.find((s) => s.diaDiemId === VT_CU_ID);

    expect(hcmSub?.tripCount).toBeGreaterThanOrEqual(1);
    expect(bdSub?.tripCount).toBeGreaterThanOrEqual(1);
    expect(vtSub?.tripCount).toBeGreaterThanOrEqual(1);
  });

  // Ca 3: Mã 15 Yên Bái cũ (id 44) không ra chuyến Lào Cai mới (id 7)
  it('Ca 3 (DB thật): Mã 15 Yên Bái cũ (id 44) -> MySQL chỉ trả về chuyến Yên Bái cũ, KHÔNG ra chuyến Lào Cai mới', async () => {
    const result = await tripsService.search({
      fromLocationId: YEN_BAI_CU_ID,
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
      fromLocationId: HCM_CU_ID,
      busCompanyId: nhaXeId,
      departureDate: tomorrowDateStr,
      page: 1,
      pageSize: 50,
      sortBy: 'departureTime',
      sortDirection: 'asc',
    });

    const returnedTripIds = result.data.map((t) => t.id);
    // Chuyến 4 có diemDi = 'TP.HCM', nhưng đã gán điểm tại Bình Dương (BD_CU_ID)
    // Khi search TP.HCM cũ, nhánh none { loaiDiem: 'DON', diemDonTra: { trangThai: 'HOAT_DONG' } } không thỏa mãn
    // vì chuyến 4 ĐÃ CÓ điểm đón hoạt động -> MySQL loại bỏ chuyến này!
    expect(returnedTripIds).not.toContain(tripHcmStringOnlyWithBdStationId);
  });
});
