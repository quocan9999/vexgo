import 'dotenv/config';
import crypto from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { ensureDemoPayment } from '../prisma/demo-revenue.mjs';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required');
  const url = new URL(raw);
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

export function deterministicUuid(...parts) {
  const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
  return `${hash.slice(0, 12)}4${hash.slice(13, 16)}a${hash.slice(17, 32)}`;
}

function calculateClockTime(baseTime, durationMinutes) {
  if (durationMinutes == null || !Number.isFinite(durationMinutes)) return null;
  const totalSeconds =
    baseTime.getUTCHours() * 3600 +
    baseTime.getUTCMinutes() * 60 +
    baseTime.getUTCSeconds() +
    Math.round(durationMinutes * 60);
  const normalizedSeconds = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;
  const d = new Date(0);
  d.setUTCHours(hours, minutes, seconds, 0);
  return d;
}

function localDateTime(year, month, day, hour = 0, minute = 0) {
  // Store the fixed UTC instant corresponding to Asia/Ho_Chi_Minh local time (UTC+7)
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
}

async function main() {
  console.log('=== BẮT ĐẦU SEED CHUYẾN XE VÀ GIAO DỊCH DOANH THU THÁNG 10/2026 ===\n');

  // Load operators
  const operators = await prisma.nhaXe.findMany();
  const operatorDefs = [
    { code: 'FUTA', nhaXeId: 1, name: 'Phương Trang' },
    { code: 'TB', nhaXeId: 2, name: 'Thành Bưởi' },
    { code: 'HM', nhaXeId: 3, name: 'Hoa Mai' },
  ];

  // 1. Seed October Trips (01/10/2026 -> 31/10/2026)
  console.log('--- 1. Seed Chuyến xe Tháng 10/2026 (01/10 -> 31/10) ---');
  const allRoutes = await prisma.tuyenXe.findMany({
    where: { trangThai: 'HOAT_DONG' },
    include: {
      tuyenXeDiemDungs: {
        include: { diemDonTra: true },
        orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      },
    },
  });
  const routesMap = new Map(allRoutes.map((r) => [r.tuyenXeId, r]));

  const vehicles = await prisma.xe.findMany({
    where: { trangThai: 'HOAT_DONG' },
    include: { loaiXe: true, ghes: true },
  });
  const vehiclesByOperator = new Map();
  for (const v of vehicles) {
    if (!vehiclesByOperator.has(v.nhaXeId)) vehiclesByOperator.set(v.nhaXeId, []);
    vehiclesByOperator.get(v.nhaXeId).push(v);
  }

  const dailySchedules = [
    // FUTA (nhaXeId 1)
    { nhaXeId: 1, routeId: 1, time: '06:00', duration: 420 },
    { nhaXeId: 1, routeId: 1, time: '13:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '08:00', duration: 420 },
    { nhaXeId: 1, routeId: 2, time: '15:00', duration: 420 },
    { nhaXeId: 1, routeId: 87, time: '07:00', duration: 210 },
    { nhaXeId: 1, routeId: 87, time: '14:00', duration: 210 },
    { nhaXeId: 1, routeId: 89, time: '08:30', duration: 150 },
    { nhaXeId: 1, routeId: 89, time: '16:00', duration: 150 },

    // TB (nhaXeId 2)
    { nhaXeId: 2, routeId: 5, time: '08:00', duration: 420 },
    { nhaXeId: 2, routeId: 5, time: '22:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '09:00', duration: 420 },
    { nhaXeId: 2, routeId: 4, time: '23:00', duration: 420 },

    // HM (nhaXeId 3)
    { nhaXeId: 3, routeId: 90, time: '06:30', duration: 150 },
    { nhaXeId: 3, routeId: 90, time: '12:00', duration: 150 },
    { nhaXeId: 3, routeId: 90, time: '17:00', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '07:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '13:30', duration: 150 },
    { nhaXeId: 3, routeId: 7, time: '18:30', duration: 150 },
    { nhaXeId: 3, routeId: 10, time: '08:00', duration: 420 },
    { nhaXeId: 3, routeId: 11, time: '14:00', duration: 420 },
  ];

  let addedOctoberTrips = 0;
  for (let d = 1; d <= 31; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    const dateStr = `2026-10-${dayStr}`;
    const departureDate = new Date(`${dateStr}T00:00:00.000Z`);

    for (let i = 0; i < dailySchedules.length; i++) {
      const schedule = dailySchedules[i];
      const route = routesMap.get(schedule.routeId);
      if (!route) continue;

      const opVehicles = vehiclesByOperator.get(schedule.nhaXeId) || [];
      if (opVehicles.length === 0) continue;
      const vehicle = opVehicles[(d + i) % opVehicles.length];

      const maChuyenXe = deterministicUuid('CX', schedule.nhaXeId, schedule.routeId, dateStr, schedule.time);
      const existing = await prisma.chuyenXe.findUnique({
        where: { maChuyenXe },
        select: { chuyenXeId: true },
      });
      if (existing) continue;

      const departureTime = new Date(`1970-01-01T${schedule.time}:00.000Z`);
      const arrivalTime = calculateClockTime(departureTime, schedule.duration);

      const createdTrip = await prisma.chuyenXe.create({
        data: {
          maChuyenXe,
          ngayKhoiHanh: departureDate,
          gioKhoiHanh: departureTime,
          gioDen: arrivalTime,
          nhanGuiHang: true,
          sucChuaXeMay: vehicle.loaiXe.sucChuaXeMayMacDinh ?? 1,
          sucChuaHangCongKenh: vehicle.loaiXe.sucChuaHangCongKenhMacDinh ?? 5,
          sucChuaHangNhe: vehicle.loaiXe.sucChuaHangNheMacDinh ?? 45,
          trangThai: 'CHUA_KHOI_HANH',
          nhaXeId: schedule.nhaXeId,
          tuyenXeId: schedule.routeId,
          xeId: vehicle.xeId,
        },
      });
      addedOctoberTrips++;

      if (vehicle.ghes.length > 0) {
        await prisma.gheChuyenXe.createMany({
          data: vehicle.ghes.map((ghe) => ({
            chuyenXeId: createdTrip.chuyenXeId,
            gheId: ghe.gheId,
            trangThai: 'TRONG',
            tang: ghe.tang,
            toaDoX: ghe.toaDoX,
            toaDoY: ghe.toaDoY,
          })),
        });
      }

      if (route.tuyenXeDiemDungs.length > 0) {
        await prisma.diemDonTraChuyenXe.createMany({
          data: route.tuyenXeDiemDungs.map((stop) => ({
            chuyenXeId: createdTrip.chuyenXeId,
            diemDonTraId: stop.diemDonTraId,
            loaiDiem: stop.loaiDiem,
            thoiGianDuKien: calculateClockTime(departureTime, stop.phutLech),
            phutLech: stop.phutLech,
            thuTu: stop.thuTu,
            phuPhi: stop.phuPhi,
            phutCoMatTruoc: stop.phutCoMatTruoc,
            nhanKhach: stop.nhanKhach,
            ghiChu: stop.ghiChu,
          })),
        });
      }
    }
  }
  console.log(`✓ Đã tạo mới ${addedOctoberTrips} chuyến xe Tháng 10/2026.\n`);

  // 2. Seed October Transactions (01/10/2026 -> 30/10/2026)
  console.log('--- 2. Seed Giao dịch Doanh thu Tháng 10/2026 ---');

  const customers = await prisma.khachHang.findMany({
    include: { taiKhoan: true },
    orderBy: { khachHangId: 'asc' },
  });

  const allPrices = await prisma.bangGia.findMany({
    where: { trangThai: 'HOAT_DONG' },
  });
  const priceMap = new Map();
  for (const p of allPrices) {
    priceMap.set(`${p.tuyenXeId}:${p.loaiXeId}`, p);
  }

  const cargoPoints = await prisma.diemGiaoNhanHang.findMany({
    where: { trangThai: 'HOAT_DONG' },
  });
  const cargoPointsByOperator = new Map();
  for (const cp of cargoPoints) {
    if (!cargoPointsByOperator.has(cp.nhaXeId)) cargoPointsByOperator.set(cp.nhaXeId, []);
    cargoPointsByOperator.get(cp.nhaXeId).push(cp);
  }

  const cargoRates = await prisma.bangCuocGuiHang.findMany({
    where: { trangThai: 'HOAT_DONG' },
  });
  const cargoTypes = await prisma.loaiHangHoa.findMany();

  const daysOfOctober = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

  let totalOctoberTransactions = 0;
  let totalOctoberSales = 0;
  let totalOctoberRefunds = 0;

  for (let opIdx = 0; opIdx < operatorDefs.length; opIdx++) {
    const op = operatorDefs[opIdx];
    const opPoints = cargoPointsByOperator.get(op.nhaXeId) || [];

    for (let txIndex = 0; txIndex < daysOfOctober.length; txIndex++) {
      const day = daysOfOctober[txIndex];
      const hour = 8 + (txIndex % 10);
      const minute = (txIndex * 7) % 60;
      const transactionTime = localDateTime(2026, 10, day, hour, minute);

      const customer = customers[(opIdx * 5 + txIndex) % customers.length];
      const customerSnapshot = {
        tenKhachHang: customer.taiKhoan?.hoTen || `Khách hàng ${customer.khachHangId}`,
        soDienThoaiKhachHang: customer.taiKhoan?.soDienThoai || `+849200000${txIndex}`,
        emailKhachHang: customer.taiKhoan?.email || `customer${customer.khachHangId}@vexgo.test`,
      };

      const hasTicket = txIndex <= 6 || txIndex >= 12;
      const hasShipping = txIndex >= 7;
      const hasRefund = txIndex === 4; // Transaction 4 has a partial ticket refund

      const transactionCode = deterministicUuid('GD', op.code, 'OCT', txIndex);

      // Find an active trip departing on or after transaction date
      const tripDateStr = `2026-10-${day < 10 ? `0${day}` : `${day}`}`;
      const trip = await prisma.chuyenXe.findFirst({
        where: {
          nhaXeId: op.nhaXeId,
          ngayKhoiHanh: new Date(`${tripDateStr}T00:00:00.000Z`),
        },
        include: {
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { where: { trangThai: 'TRONG' }, take: 4 },
        },
      });

      if (!trip && hasTicket) {
        console.warn(`Không tìm thấy chuyến xe cho ${op.code} ngày ${tripDateStr}`);
        continue;
      }

      let ticketTotal = 0;
      const ticketPlan = [];
      if (hasTicket && trip) {
        const priceRecord = priceMap.get(`${trip.tuyenXeId}:${trip.xe.loaiXeId}`);
        const priceAmount = priceRecord ? Number(priceRecord.giaNiemYet) : 250000;
        const ticketCount = txIndex === 3 ? 3 : (txIndex % 2) + 1; // 1, 2, or 3 tickets
        const availableSeats = trip.gheChuyenXes.slice(0, ticketCount);

        for (let seatIdx = 0; seatIdx < availableSeats.length; seatIdx++) {
          const seat = availableSeats[seatIdx];
          const isCancelled = hasRefund && seatIdx === 0;
          ticketTotal += priceAmount;
          ticketPlan.push({
            seat,
            priceAmount,
            isCancelled,
            priceRecord,
            code: deterministicUuid('VE', op.code, 'OCT', txIndex, seatIdx),
          });
        }
      }

      let shippingTotal = 0;
      let shippingData = null;
      if (hasShipping && opPoints.length >= 2) {
        const pointSend = opPoints[0];
        const pointReceive = opPoints[1];
        const requestedType = cargoTypes[txIndex % cargoTypes.length];
        const rate =
          cargoRates.find(
            (r) =>
              r.diemGuiId === pointSend.diemGiaoNhanHangId &&
              r.loaiHangHoaId === requestedType.loaiHangHoaId,
          ) ||
          cargoRates.find((r) => r.loaiHangHoaId === requestedType.loaiHangHoaId) ||
          cargoRates[0];

        const cargoType =
          cargoTypes.find((ct) => ct.loaiHangHoaId === rate.loaiHangHoaId) ||
          requestedType;
        const fee = rate ? Number(rate.mucCuoc) : 50000;
        shippingTotal = fee;
        shippingData = {
          pointSend,
          pointReceive,
          cargoType,
          rate,
          fee,
          code: deterministicUuid('VD', op.code, 'OCT', txIndex),
        };
      }

      const totalAmount = ticketTotal + shippingTotal;
      if (totalAmount <= 0) continue;

      // 1. Create or update DonGiaoDich
      const transaction = await prisma.donGiaoDich.upsert({
        where: { maDonGiaoDich: transactionCode },
        create: {
          maDonGiaoDich: transactionCode,
          ngayTao: transactionTime,
          tongTien: String(totalAmount),
          trangThai: 'DA_THANH_TOAN',
          ...customerSnapshot,
          khachHangId: customer.khachHangId,
          nhaXeId: op.nhaXeId,
        },
        update: {
          ngayTao: transactionTime,
          tongTien: String(totalAmount),
          trangThai: 'DA_THANH_TOAN',
          ...customerSnapshot,
          khachHangId: customer.khachHangId,
          nhaXeId: op.nhaXeId,
        },
      });

      // 2. Create PhieuDatVe & Ve
      let booking = null;
      const createdTickets = [];
      if (hasTicket && ticketPlan.length > 0) {
        const bookingCode = deterministicUuid('PDV', op.code, 'OCT', txIndex);
        booking = await prisma.phieuDatVe.upsert({
          where: { maPhieuDatVe: bookingCode },
          create: {
            maPhieuDatVe: bookingCode,
            ngayDat: transactionTime,
            soLuongVeBanDau: ticketPlan.length,
            tongTienBanDau: String(ticketTotal),
            trangThai: 'DA_THANH_TOAN',
            donGiaoDichId: transaction.donGiaoDichId,
          },
          update: {
            ngayDat: transactionTime,
            soLuongVeBanDau: ticketPlan.length,
            tongTienBanDau: String(ticketTotal),
            trangThai: 'DA_THANH_TOAN',
          },
        });

        for (const item of ticketPlan) {
          const ve = await prisma.ve.upsert({
            where: { maVe: item.code },
            create: {
              maVe: item.code,
              diemDon: `Văn phòng ${op.name}`,
              giaNiemYet: String(item.priceAmount),
              giaThucTe: String(item.priceAmount),
              trangThai: item.isCancelled ? 'HUY' : 'DA_DAT',
              phieuDatVeId: booking.phieuDatVeId,
              gheChuyenXeId: item.seat.gheChuyenXeId,
              bangGiaApDungId: item.priceRecord?.bangGiaId || null,
            },
            update: {
              diemDon: `Văn phòng ${op.name}`,
              giaNiemYet: String(item.priceAmount),
              giaThucTe: String(item.priceAmount),
              trangThai: item.isCancelled ? 'HUY' : 'DA_DAT',
            },
          });
          createdTickets.push(ve);

          await prisma.gheChuyenXe.update({
            where: { gheChuyenXeId: item.seat.gheChuyenXeId },
            data: { trangThai: item.isCancelled ? 'TRONG' : 'DA_DAT' },
          });
        }
      }

      // 3. Create PhieuGuiHang
      if (shippingData && trip) {
        const shipment = await prisma.phieuGuiHang.upsert({
          where: { maVanDon: shippingData.code },
          create: {
            maVanDon: shippingData.code,
            tenNguoiNhan: `Người nhận ${op.code}-${day}`,
            soDienThoaiNguoiNhan: `+849380000${txIndex}`,
            ngayGui: transactionTime,
            cuocChinh: String(shippingData.fee),
            phiDichVu: '0',
            soTienGiam: '0',
            tongPhi: String(shippingData.fee),
            nguoiTraCuoc: 'NGUOI_GUI',
            ghiChu: 'Gửi hàng demo tháng 10',
            trangThai: 'DA_GIAO',
            chuyenXeId: trip.chuyenXeId,
            diemGuiId: shippingData.pointSend.diemGiaoNhanHangId,
            diemNhanId: shippingData.pointReceive.diemGiaoNhanHangId,
            donGiaoDichId: transaction.donGiaoDichId,
          },
          update: {
            cuocChinh: String(shippingData.fee),
            tongPhi: String(shippingData.fee),
            trangThai: 'DA_GIAO',
          },
        });

        // Add HangHoa & ChiTietCuocGuiHang
        await prisma.chiTietCuocGuiHang.deleteMany({ where: { phieuGuiHangId: shipment.phieuGuiHangId } });
        await prisma.hangHoa.deleteMany({ where: { phieuGuiHangId: shipment.phieuGuiHangId } });

        const item = await prisma.hangHoa.create({
          data: {
            tenHang: `${shippingData.cargoType.tenLoai} ${op.code}-${txIndex + 1}`,
            soLuong: 1,
            khoiLuong: '5',
            chieuDai: '20',
            chieuRong: '15',
            chieuCao: '10',
            giaTriKhaiBao: '200000',
            moTa: 'Hàng hóa demo',
            phieuGuiHangId: shipment.phieuGuiHangId,
            loaiHangHoaId: shippingData.cargoType.loaiHangHoaId,
          },
        });

        if (shippingData.rate) {
          await prisma.chiTietCuocGuiHang.create({
            data: {
              phieuGuiHangId: shipment.phieuGuiHangId,
              loaiHangHoaId: shippingData.cargoType.loaiHangHoaId,
              bangCuocGuiHangId: shippingData.rate.bangCuocGuiHangId,
              khoiLuongTinhCuoc: '5',
              soTienCuoc: String(shippingData.fee),
            },
          });
        }
      }

      // 4. Create Payment via ensureDemoPayment
      const methods = ['VNPAY', 'MOMO', 'ZALOPAY', 'TIEN_MAT'];
      const paymentMethod = methods[txIndex % methods.length];

      await ensureDemoPayment(prisma, {
        soTien: String(totalAmount),
        phuongThuc: paymentMethod,
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: transactionTime,
        trangThai: 'THANH_CONG',
        donGiaoDichId: transaction.donGiaoDichId,
        veId: null,
      });
      totalOctoberSales++;

      // 5. If partial refund (txIndex === 4)
      if (hasRefund) {
        const cancelledTicket = createdTickets.find((t) => t.trangThai === 'HUY');
        if (cancelledTicket) {
          const refundTime = new Date(transactionTime.getTime() + 15 * 60_000);
          await ensureDemoPayment(prisma, {
            soTien: cancelledTicket.giaThucTe,
            phuongThuc: 'MOMO',
            loaiGiaoDich: 'HOAN_TIEN',
            thoiGian: refundTime,
            trangThai: 'THANH_CONG',
            donGiaoDichId: transaction.donGiaoDichId,
            veId: cancelledTicket.veId,
          });
          totalOctoberRefunds++;
        }
      }

      // 6. Create HoaDon
      const invoiceCode = deterministicUuid('HD', op.code, 'OCT', txIndex);
      await prisma.hoaDon.upsert({
        where: { maHoaDon: invoiceCode },
        create: {
          maHoaDon: invoiceCode,
          ngayLap: transactionTime,
          tongTien: String(totalAmount),
          trangThai: 'DA_PHAT_HANH',
          donGiaoDichId: transaction.donGiaoDichId,
        },
        update: {
          ngayLap: transactionTime,
          tongTien: String(totalAmount),
          trangThai: 'DA_PHAT_HANH',
        },
      });

      totalOctoberTransactions++;
    }
  }

  console.log(`✓ Đã tạo thành công ${totalOctoberTransactions} đơn giao dịch Tháng 10/2026.`);
  console.log(`✓ Đã tạo thành công ${totalOctoberSales} thanh toán hợp lệ Tháng 10/2026.`);
  console.log(`✓ Đã tạo thành công ${totalOctoberRefunds} khoản hoàn tiền Tháng 10/2026.\n`);

  // 3. Verify Revenue Reports for October 2026
  console.log('--- 3. Kiểm chứng Số liệu Báo cáo Doanh thu Tháng 10/2026 ---');
  for (const op of operatorDefs) {
    const payments = await prisma.thanhToan.findMany({
      where: {
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'THANH_CONG',
        laQuyetToanHopLe: true,
        thoiDiemHoanTat: {
          gte: new Date('2026-10-01T00:00:00.000+07:00'),
          lt: new Date('2026-10-31T00:00:00.000+07:00'),
        },
        donGiaoDich: { nhaXeId: op.nhaXeId },
      },
      select: {
        soTien: true,
        thoiDiemHoanTat: true,
      },
    });

    const refunds = await prisma.thanhToan.findMany({
      where: {
        loaiGiaoDich: 'HOAN_TIEN',
        trangThai: 'THANH_CONG',
        thoiDiemHoanTat: {
          gte: new Date('2026-10-01T00:00:00.000+07:00'),
          lt: new Date('2026-10-31T00:00:00.000+07:00'),
        },
        donGiaoDich: { nhaXeId: op.nhaXeId },
      },
    });

    const totalGross = payments.reduce((sum, p) => sum + Number(p.soTien), 0);
    const totalRefund = refunds.reduce((sum, r) => sum + Number(r.soTien), 0);
    const netRevenue = totalGross - totalRefund;

    console.log(`Nhà xe ${op.name} (${op.code}):`);
    console.log(`  - Số thanh toán thành công: ${payments.length}`);
    console.log(`  - Doanh thu gộp: ${totalGross.toLocaleString('vi-VN')} đ`);
    console.log(`  - Tiền hoàn: ${totalRefund.toLocaleString('vi-VN')} đ`);
    console.log(`  - Doanh thu ròng: ${netRevenue.toLocaleString('vi-VN')} đ`);

    if (payments.length === 0 || netRevenue <= 0) {
      throw new Error(`Báo cáo doanh thu Tháng 10 của ${op.name} không có dữ liệu!`);
    }
  }

  console.log('\n=== TẤT CẢ KIỂM CHỨNG BÁO CÁO DOANH THU THÁNG 10 THÀNH CÔNG 100% ===');
}

main()
  .catch((err) => {
    console.error('LỖI:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
