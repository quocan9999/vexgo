import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
      allowPublicKeyRetrieval: true,
    }),
  });

  console.log('=== ĐANG TẠO CÁC CHUYẾN XE 0Đ (MIỄN PHÍ) ===\n');

  // Danh sách các nhà xe cần tạo chuyến 0đ
  const operators = [
    { nhaXeId: 1, codePrefix: 'FUTA', plate: '51B-000.99', typeName: 'Xe Thử Nghiệm (0đ)' },
    { nhaXeId: 2, codePrefix: 'TB', plate: '51B-000.88', typeName: 'Xe Thử Nghiệm (0đ)' },
  ];

  const seatCodes = [
    'A01', 'A02', 'A03', 'A04', 'A05', 'A06',
    'A07', 'A08', 'A09', 'A10', 'A11', 'A12',
    'B01', 'B02', 'B03', 'B04', 'B05', 'B06',
    'B07', 'B08', 'B09', 'B10', 'B11', 'B12',
  ];

  const createdTripsSummary = [];

  for (const op of operators) {
    const nhaXe = await prisma.nhaXe.findUnique({ where: { nhaXeId: op.nhaXeId } });
    if (!nhaXe) {
      console.log(`Bỏ qua nhà xe ID ${op.nhaXeId} vì không tồn tại.`);
      continue;
    }

    // 1. Tạo hoặc lấy loại xe 0đ
    let loaiXe = await prisma.loaiXe.findFirst({
      where: { nhaXeId: op.nhaXeId, tenLoai: op.typeName },
    });
    if (!loaiXe) {
      loaiXe = await prisma.loaiXe.create({
        data: {
          nhaXeId: op.nhaXeId,
          tenLoai: op.typeName,
          moTa: 'Xe chuyên dùng thử nghiệm đặt vé và gửi hàng 0đ',
          sucChuaXeMayMacDinh: 5,
          sucChuaHangCongKenhMacDinh: 10,
          sucChuaHangNheMacDinh: 50,
        },
      });
    }

    // 2. Tạo hoặc lấy xe
    let xe = await prisma.xe.findFirst({ where: { bienSoXe: op.plate } });
    if (!xe) {
      xe = await prisma.xe.create({
        data: {
          bienSoXe: op.plate,
          trangThai: 'HOAT_DONG',
          nhaXeId: op.nhaXeId,
          loaiXeId: loaiXe.loaiXeId,
        },
      });
    }

    // 3. Tạo ghế xe
    for (const code of seatCodes) {
      const existing = await prisma.ghe.findFirst({
        where: { xeId: xe.xeId, soGhe: code },
      });
      if (!existing) {
        await prisma.ghe.create({
          data: {
            xeId: xe.xeId,
            soGhe: code,
            viTri: code.startsWith('A') ? 'Tầng dưới' : 'Tầng trên',
          },
        });
      }
    }
    const allSeats = await prisma.ghe.findMany({ where: { xeId: xe.xeId } });

    // 4. Lấy các tuyến xe của nhà xe
    const routes = await prisma.tuyenXe.findMany({
      where: { nhaXeId: op.nhaXeId, trangThai: 'HOAT_DONG' },
    });

    for (const route of routes) {
      // Đảm bảo có bảng giá 0đ cho tuyến này
      let bangGia = await prisma.bangGia.findFirst({
        where: {
          nhaXeId: op.nhaXeId,
          tuyenXeId: route.tuyenXeId,
          loaiXeId: loaiXe.loaiXeId,
        },
      });
      if (!bangGia) {
        bangGia = await prisma.bangGia.create({
          data: {
            nhaXeId: op.nhaXeId,
            tuyenXeId: route.tuyenXeId,
            loaiXeId: loaiXe.loaiXeId,
            giaNiemYet: 0,
            tuNgay: new Date('2026-01-01T00:00:00.000Z'),
            denNgay: null,
            trangThai: 'HOAT_DONG',
          },
        });
      } else {
        await prisma.bangGia.update({
          where: { bangGiaId: bangGia.bangGiaId },
          data: { giaNiemYet: 0, trangThai: 'HOAT_DONG' },
        });
      }

      // Tạo các chuyến xe cho 3 ngày tới: Hôm nay (2026-10-23), 2026-10-24, 2026-10-25
      const tripSchedules = [
        // Hôm nay (chiều và tối để chắc chắn sau giờ hiện tại)
        { date: '2026-10-23', depTime: '13:30', arrTime: '19:30' },
        { date: '2026-10-23', depTime: '16:00', arrTime: '22:00' },
        { date: '2026-10-23', depTime: '18:30', arrTime: '01:30' },
        { date: '2026-10-23', depTime: '21:00', arrTime: '04:00' },
        // Ngày mai
        { date: '2026-10-24', depTime: '07:30', arrTime: '13:30' },
        { date: '2026-10-24', depTime: '10:00', arrTime: '16:00' },
        { date: '2026-10-24', depTime: '14:00', arrTime: '20:00' },
        { date: '2026-10-24', depTime: '19:30', arrTime: '02:30' },
        // Ngày mốt
        { date: '2026-10-25', depTime: '08:00', arrTime: '14:00' },
        { date: '2026-10-25', depTime: '15:00', arrTime: '21:00' },
      ];

      for (const schedule of tripSchedules) {
        const dateClean = schedule.date.replace(/-/g, '');
        const timeClean = schedule.depTime.replace(':', '');
        const tripCode = `${op.codePrefix}-0D-${route.tuyenXeId}-${dateClean}-${timeClean}`;

        let chuyenXe = await prisma.chuyenXe.findFirst({
          where: { maChuyenXe: tripCode },
        });

        const departureDate = new Date(`${schedule.date}T00:00:00.000Z`);
        const [depH, depM] = schedule.depTime.split(':').map(Number);
        const [arrH, arrM] = schedule.arrTime.split(':').map(Number);
        const gioKhoiHanh = new Date(Date.UTC(1970, 0, 1, depH, depM, 0));
        const gioDen = new Date(Date.UTC(1970, 0, 1, arrH, arrM, 0));

        if (!chuyenXe) {
          chuyenXe = await prisma.chuyenXe.create({
            data: {
              maChuyenXe: tripCode,
              ngayKhoiHanh: departureDate,
              gioKhoiHanh: gioKhoiHanh,
              gioDen: gioDen,
              nhanGuiHang: true,
              sucChuaXeMay: 5,
              sucChuaHangCongKenh: 10,
              sucChuaHangNhe: 50,
              trangThai: 'CHUA_KHOI_HANH',
              nhaXeId: op.nhaXeId,
              tuyenXeId: route.tuyenXeId,
              xeId: xe.xeId,
            },
          });

          // Khởi tạo ghế chuyến xe ở trạng thái TRỐNG
          for (const seat of allSeats) {
            await prisma.gheChuyenXe.create({
              data: {
                chuyenXeId: chuyenXe.chuyenXeId,
                gheId: seat.gheId,
                trangThai: 'TRONG',
              },
            });
          }
        } else {
          // Cập nhật lại để đảm bảo trạng thái CHUA_KHOI_HANH và đúng giờ
          await prisma.chuyenXe.update({
            where: { chuyenXeId: chuyenXe.chuyenXeId },
            data: {
              trangThai: 'CHUA_KHOI_HANH',
              gioKhoiHanh,
              gioDen,
              nhanGuiHang: true,
            },
          });
          // Đảm bảo ghế còn trống
          await prisma.gheChuyenXe.updateMany({
            where: { chuyenXeId: chuyenXe.chuyenXeId },
            data: { trangThai: 'TRONG' },
          });
        }

        createdTripsSummary.push({
          id: chuyenXe.chuyenXeId,
          code: tripCode,
          nhaXe: nhaXe.tenNhaXe,
          route: `${route.diemDi} → ${route.diemDen}`,
          date: schedule.date,
          time: schedule.depTime,
          price: '0đ',
        });
      }
    }
  }

  console.log(`✓ Đã tạo thành công ${createdTripsSummary.length} chuyến xe giá 0đ!`);
  console.log('\n--- BẢNG DANH SÁCH CÁC CHUYẾN XE 0Đ TIÊU BIỂU ---');
  console.table(
    createdTripsSummary.slice(0, 20).map((t) => ({
      ID: t.id,
      'Nhà xe': t.nhaXe,
      Tuyến: t.route,
      Ngày: t.date,
      Giờ: t.time,
      Giá: t.price,
      Mã: t.code,
    })),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Lỗi khi tạo các chuyến xe 0đ:', err);
  process.exit(1);
});
