import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

async function main() {
  const route = await prisma.tuyenXe.findFirst({
    where: { diemDi: 'TP.HCM', diemDen: 'Đà Lạt' },
    include: { nhaXe: true }
  });
  
  if (!route) throw new Error("Route not found");
  
  const vehicle = await prisma.xe.findFirst({
    where: { nhaXeId: route.nhaXeId }
  });
  
  if (!vehicle) throw new Error("Vehicle not found");

  const seats = await prisma.ghe.findMany({
    where: { xeId: vehicle.xeId }
  });

  console.log(`Found Route ${route.tuyenXeId}, Vehicle ${vehicle.xeId}, Seats ${seats.length}`);

  const targetDate = new Date('2026-10-01T00:00:00.000Z');
  
  for (let i = 1; i <= 6; i++) {
    const hour = 6 + i; // 07:00 to 12:00
    const code = `FUTA-CX-01102026-T${i}`;
    
    // Create the trip
    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: code,
        ngayKhoiHanh: targetDate,
        gioKhoiHanh: new Date(`1970-01-01T${hour.toString().padStart(2, '0')}:00:00.000Z`),
        trangThai: 'MO_BAN',
        nhaXeId: route.nhaXeId,
        tuyenXeId: route.tuyenXeId,
        xeId: vehicle.xeId,
      }
    });

    // Create the seats for the trip
    const tripSeatsData = seats.map(seat => ({
      chuyenXeId: trip.chuyenXeId,
      gheId: seat.gheId,
      trangThai: 'TRONG'
    }));

    await prisma.gheChuyenXe.createMany({
      data: tripSeatsData
    });

    console.log(`Created trip ${code} at ${hour}:00`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
