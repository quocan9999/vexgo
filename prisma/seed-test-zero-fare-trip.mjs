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

  console.log('--- Đang tạo dữ liệu chuyến xe 0đ ---');

  // 1. Lấy nhà xe Phương Trang (nhaXeId: 1) và tuyến TP.HCM -> Đà Lạt (tuyenXeId: 1)
  const nhaXe = await prisma.nhaXe.findUnique({ where: { nhaXeId: 1 } });
  if (!nhaXe) throw new Error('Không tìm thấy nhà xe Phương Trang (nhaXeId: 1)');

  const tuyenXe = await prisma.tuyenXe.findFirst({
    where: { nhaXeId: 1, diemDi: 'TP.HCM', diemDen: 'Đà Lạt' },
  });
  if (!tuyenXe) throw new Error('Không tìm thấy tuyến xe TP.HCM -> Đà Lạt');

  console.log(`Nhà xe: ${nhaXe.tenNhaXe} (ID: ${nhaXe.nhaXeId})`);
  console.log(`Tuyến: ${tuyenXe.diemDi} -> ${tuyenXe.diemDen} (ID: ${tuyenXe.tuyenXeId})`);

  // 2. Tạo hoặc tìm LoaiXe "Xe Thử Nghiệm 0đ"
  let loaiXe = await prisma.loaiXe.findFirst({
    where: {
      nhaXeId: nhaXe.nhaXeId,
      tenLoai: 'Xe Thử Nghiệm (0đ)',
    },
  });

  if (!loaiXe) {
    loaiXe = await prisma.loaiXe.create({
      data: {
        nhaXeId: nhaXe.nhaXeId,
        tenLoai: 'Xe Thử Nghiệm (0đ)',
        moTa: 'Xe chuyên dùng để thử nghiệm đặt vé và hủy vé miễn phí (0đ)',
        sucChuaXeMayMacDinh: 5,
        sucChuaHangCongKenhMacDinh: 10,
        sucChuaHangNheMacDinh: 50,
      },
    });
    console.log(`Đã tạo loại xe: ${loaiXe.tenLoai} (ID: ${loaiXe.loaiXeId})`);
  } else {
    console.log(`Đã có loại xe: ${loaiXe.tenLoai} (ID: ${loaiXe.loaiXeId})`);
  }

  // 3. Tạo hoặc tìm Xe "51B-000.99"
  let xe = await prisma.xe.findFirst({
    where: { bienSoXe: '51B-000.99' },
  });

  if (!xe) {
    xe = await prisma.xe.create({
      data: {
        bienSoXe: '51B-000.99',
        trangThai: 'HOAT_DONG',
        nhaXeId: nhaXe.nhaXeId,
        loaiXeId: loaiXe.loaiXeId,
      },
    });
    console.log(`Đã tạo xe: ${xe.bienSoXe} (ID: ${xe.xeId})`);
  } else {
    console.log(`Đã có xe: ${xe.bienSoXe} (ID: ${xe.xeId})`);
  }

  // 4. Tạo các ghế (A01 -> A12, B01 -> B12)
  const seatCodes = [
    'A01', 'A02', 'A03', 'A04', 'A05', 'A06',
    'A07', 'A08', 'A09', 'A10', 'A11', 'A12',
    'B01', 'B02', 'B03', 'B04', 'B05', 'B06',
    'B07', 'B08', 'B09', 'B10', 'B11', 'B12',
  ];

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
  console.log(`Xe có tổng cộng ${allSeats.length} ghế.`);

  // 5. Cấu hình bảng giá 0đ
  let bangGia = await prisma.bangGia.findFirst({
    where: {
      nhaXeId: nhaXe.nhaXeId,
      tuyenXeId: tuyenXe.tuyenXeId,
      loaiXeId: loaiXe.loaiXeId,
    },
  });

  if (!bangGia) {
    bangGia = await prisma.bangGia.create({
      data: {
        nhaXeId: nhaXe.nhaXeId,
        tuyenXeId: tuyenXe.tuyenXeId,
        loaiXeId: loaiXe.loaiXeId,
        giaNiemYet: 0,
        tuNgay: new Date('2026-01-01T00:00:00.000Z'),
        denNgay: null,
        trangThai: 'HOAT_DONG',
      },
    });
    console.log(`Đã tạo bảng giá 0đ (ID: ${bangGia.bangGiaId})`);
  } else {
    await prisma.bangGia.update({
      where: { bangGiaId: bangGia.bangGiaId },
      data: { giaNiemYet: 0, trangThai: 'HOAT_DONG' },
    });
    console.log(`Bảng giá 0đ đã tồn tại (ID: ${bangGia.bangGiaId})`);
  }

  // 6. Tạo các chuyến xe cho ngày hôm nay và các ngày tiếp theo
  const now = new Date();
  const dates = [
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2)),
  ];

  const createdTrips = [];

  for (let i = 0; i < dates.length; i++) {
    const departureDate = dates[i];
    const dateStr = departureDate.toISOString().slice(0, 10).replace(/-/g, '');
    const tripCode = `FUTA-TEST0D-${dateStr}`;

    let chuyenXe = await prisma.chuyenXe.findFirst({
      where: { maChuyenXe: tripCode },
    });

    if (!chuyenXe) {
      // 08:30 sáng
      const gioKhoiHanh = new Date('1970-01-01T08:30:00.000Z');
      const gioDen = new Date('1970-01-01T15:30:00.000Z');

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
          nhaXeId: nhaXe.nhaXeId,
          tuyenXeId: tuyenXe.tuyenXeId,
          xeId: xe.xeId,
        },
      });

      // Tạo ghế chuyến xe
      for (const seat of allSeats) {
        await prisma.gheChuyenXe.create({
          data: {
            chuyenXeId: chuyenXe.chuyenXeId,
            gheId: seat.gheId,
            trangThai: 'TRONG',
          },
        });
      }
      console.log(`Đã tạo chuyến xe mới: ${tripCode} (ID: ${chuyenXe.chuyenXeId}) - Ngày: ${departureDate.toISOString().slice(0, 10)}`);
    } else {
      console.log(`Chuyến xe đã tồn tại: ${tripCode} (ID: ${chuyenXe.chuyenXeId})`);
    }

    createdTrips.push(chuyenXe);
  }

  console.log('\n--- HOÀN THÀNH ---');
  console.log('Các chuyến xe 0đ sẵn sàng thử nghiệm:');
  for (const trip of createdTrips) {
    const d = trip.ngayKhoiHanh.toISOString().slice(0, 10);
    console.log(`- ID: ${trip.chuyenXeId} | Mã: ${trip.maChuyenXe} | Ngày: ${d} | Giá: 0đ | Link: http://localhost:3000/trips/${trip.chuyenXeId}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Lỗi tạo chuyến xe 0đ:', err);
  process.exit(1);
});
