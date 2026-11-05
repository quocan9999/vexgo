import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

function databaseConfig() {
  const raw = process.env.DATABASE_URL ?? process.env.MIGRATION_URL;
  if (!raw) throw new Error('MIGRATION_URL or DATABASE_URL is required for seed');
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

const adapter = new PrismaMariaDb(databaseConfig());
const prisma = new PrismaClient({ adapter });

async function seedMultiDateReviews() {
  console.log('--- SEEDING MULTI-DATE REVIEWS ---');

  // Lấy các khách hàng
  const customers = await prisma.khachHang.findMany({ take: 10 });
  if (customers.length < 5) {
    console.error('Không đủ khách hàng');
    return;
  }

  // Cấu hình cụ thể theo từng nhà xe với các ngày chạy khác nhau
  const reviewPlans = [
    // --- PHƯƠNG TRANG (nhaXeId: 1) ---
    {
      chuyenXeId: 1246, // Chuyến 04/11/2026 07:00
      customerIdx: 0,
      mucDanhGia: 5,
      noiDung: 'Xe chạy êm ái, đúng giờ, tài xế lái xe rất cẩn thận và nhân viên phục vụ chu đáo!',
      reviewDateStr: '2026-11-05T08:30:00Z',
    },
    {
      chuyenXeId: 1175, // Chuyến 02/11/2026 08:00
      customerIdx: 1,
      mucDanhGia: 5,
      noiDung: 'Chuyến đi rất thoải mái, xe sạch sẽ thơm tho, có wifi mạnh và nước suối khăn lạnh đầy đủ.',
      reviewDateStr: '2026-11-03T09:15:00Z',
    },
    {
      chuyenXeId: 882, // Chuyến 28/10/2026 08:00
      customerIdx: 2,
      mucDanhGia: 4,
      noiDung: 'Tài xế nhiệt tình, hỗ trợ khách bưng hành lý cẩn thận. Xe đến bến hơi muộn 10 phút do kẹt xe nhưng thông cảm được.',
      reviewDateStr: '2026-10-29T14:20:00Z',
    },
    {
      chuyenXeId: 295, // Chuyến 24/10/2026 08:00
      customerIdx: 3,
      mucDanhGia: 5,
      noiDung: 'Đặt vé trên VexGo tiện lợi, lên xe chỉ cần quét mã QR là vào chỗ ngay. Xe Phương Trang chạy rất chuyên nghiệp.',
      reviewDateStr: '2026-10-25T11:00:00Z',
    },
    {
      chuyenXeId: 576, // Chuyến 24/10/2026 19:30
      customerIdx: 4,
      mucDanhGia: 4,
      noiDung: 'Chất lượng xe tốt, điều hòa mát lạnh. Bác tài thân thiện, lái xe an toàn trên suốt cung đường.',
      reviewDateStr: '2026-10-26T07:45:00Z',
    },

    // --- THÀNH BƯỞI (nhaXeId: 2) ---
    {
      chuyenXeId: 1248, // Chuyến 04/11/2026 08:00
      customerIdx: 5,
      mucDanhGia: 5,
      noiDung: 'Xe phòng nằm Limousine Thành Bưởi quá tuyệt vời, giường massage êm ái, bác tài vui tính!',
      reviewDateStr: '2026-11-05T09:00:00Z',
    },
    {
      chuyenXeId: 1176, // Chuyến 02/11/2026 08:00
      customerIdx: 6,
      mucDanhGia: 5,
      noiDung: 'Rất ưng ý dịch vụ của Thành Bưởi, đón trả tận nơi chu đáo, chạy rất đúng giờ.',
      reviewDateStr: '2026-11-03T16:20:00Z',
    },
    {
      chuyenXeId: 883, // Chuyến 28/10/2026 08:00
      customerIdx: 7,
      mucDanhGia: 4,
      noiDung: 'Xe êm không rung lắc, vệ sinh sạch sẽ. Điểm nghỉ chân đồ ăn uống ngon miệng.',
      reviewDateStr: '2026-10-29T10:10:00Z',
    },
    {
      chuyenXeId: 596, // Chuyến 24/10/2026 19:30
      customerIdx: 8,
      mucDanhGia: 5,
      noiDung: 'Trải nghiệm 5 sao! Lên xe ngủ một giấc êm ái sáng sớm là tới Đà Lạt rồi.',
      reviewDateStr: '2026-10-25T08:00:00Z',
    },

    // --- HOA MAI (nhaXeId: 3) ---
    {
      chuyenXeId: 1249, // Chuyến 04/11/2026 08:00
      customerIdx: 9,
      mucDanhGia: 5,
      noiDung: 'Xe Hoa Mai đi Vũng Tàu chạy rất êm, đón trả nhanh chóng, tài xế lịch sự.',
      reviewDateStr: '2026-11-05T10:30:00Z',
    },
    {
      chuyenXeId: 1177, // Chuyến 02/11/2026 08:00
      customerIdx: 0,
      mucDanhGia: 5,
      noiDung: 'Dịch vụ chuẩn chỉ, xe đời mới sạch sẽ thơm tho, giá vé hợp lý.',
      reviewDateStr: '2026-11-03T11:45:00Z',
    },
    {
      chuyenXeId: 884, // Chuyến 28/10/2026 08:00
      customerIdx: 1,
      mucDanhGia: 4,
      noiDung: 'Xe chạy cao tốc nhanh và an toàn, rất hài lòng khi đặt qua VexGo.',
      reviewDateStr: '2026-10-29T18:00:00Z',
    },
  ];

  for (const item of reviewPlans) {
    const customer = customers[item.customerIdx % customers.length];
    await prisma.phanHoi.create({
      data: {
        mucDanhGia: item.mucDanhGia,
        noiDung: item.noiDung,
        thoiGian: new Date(item.reviewDateStr),
        trangThai: 'HIEN_THI',
        khachHangId: customer.khachHangId,
        chuyenXeId: item.chuyenXeId,
      },
    });
  }

  console.log(`Đã seed thành công ${reviewPlans.length} đánh giá với nhiều ngày chạy khác nhau!`);
}

seedMultiDateReviews()
  .catch((e) => {
    console.error('Lỗi seed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
