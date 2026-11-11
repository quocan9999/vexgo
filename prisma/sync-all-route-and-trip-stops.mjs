import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';
import { databaseConfig } from './lib/db-config.mjs';

export function deterministicUuid(...parts) {
  const hash = crypto.createHash('md5').update(parts.map(String).join(':')).digest('hex');
  return `${hash.slice(0, 12)}4${hash.slice(13, 16)}a${hash.slice(17, 32)}`;
}

export function calculateClockTime(baseTime, durationMinutes) {
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

/**
 * Bước 1: Dọn sạch bản ghi trùng lặp ở TuyenXe (12..22 -> 1..11), DiemDonTra, DiemGiaoNhanHang,
 * và loại bỏ các chuyến xe bị trùng giờ trên cùng tuyến do chạy chồng chéo seed cũ.
 */
async function deduplicateCoreTables(prisma) {
  console.log('\n--- 1. DỌN SẠCH BẢN GHI TRÙNG LẶP & ĐỒNG BỘ MÃ UUID V4 CHUẨN ---');

  // 1.1. Gộp các tuyến xe trùng (12..22 về 1..11) hoặc các tuyến trùng (nhaXeId, diemDi, diemDen)
  const allRoutes = await prisma.tuyenXe.findMany({
    orderBy: { tuyenXeId: 'asc' },
  });

  const canonicalRouteByKey = new Map();
  const duplicateRoutePairs = [];

  for (const r of allRoutes) {
    const key = `${r.nhaXeId}:${r.diemDi.trim().toLowerCase()}:${r.diemDen.trim().toLowerCase()}`;
    if (!canonicalRouteByKey.has(key)) {
      canonicalRouteByKey.set(key, r);
    } else {
      duplicateRoutePairs.push({ canonical: canonicalRouteByKey.get(key), duplicate: r });
    }
  }

  for (const { canonical, duplicate } of duplicateRoutePairs) {
    const dstId = canonical.tuyenXeId;
    const srcId = duplicate.tuyenXeId;
    const canonicalMaTuyenXe = duplicate.maTuyenXe; // Bản sau mang mã chuẩn của seed.mjs / seed-shipments-network.mjs

    // Chuyển BangGia từ srcId sang dstId
    const dstFares = await prisma.bangGia.findMany({ where: { tuyenXeId: dstId } });
    const srcFares = await prisma.bangGia.findMany({ where: { tuyenXeId: srcId } });
    const dstFareByLoaiXe = new Map(dstFares.map((f) => [f.loaiXeId, f.bangGiaId]));

    for (const sf of srcFares) {
      const targetBangGiaId = dstFareByLoaiXe.get(sf.loaiXeId);
      if (targetBangGiaId) {
        await prisma.ve.updateMany({
          where: { bangGiaApDungId: sf.bangGiaId },
          data: { bangGiaApDungId: targetBangGiaId },
        });
        await prisma.bangGia.delete({ where: { bangGiaId: sf.bangGiaId } });
      } else {
        await prisma.bangGia.update({
          where: { bangGiaId: sf.bangGiaId },
          data: { tuyenXeId: dstId },
        });
      }
    }

    // Chuyển BangCuocGuiHang từ srcId sang dstId trước khi xoá
    const dstRates = await prisma.bangCuocGuiHang.findMany({ where: { tuyenXeId: dstId } });
    const srcRates = await prisma.bangCuocGuiHang.findMany({ where: { tuyenXeId: srcId } });
    const dstRateByKey = new Map(
      dstRates.map((r) => [`${r.loaiHangHoaId}_${Number(r.khoiLuongTu)}`, r.bangCuocGuiHangId]),
    );
    for (const sr of srcRates) {
      const targetRateId = dstRateByKey.get(`${sr.loaiHangHoaId}_${Number(sr.khoiLuongTu)}`);
      if (targetRateId) {
        await prisma.chiTietCuocGuiHang.updateMany({
          where: { bangCuocGuiHangId: sr.bangCuocGuiHangId },
          data: { bangCuocGuiHangId: targetRateId },
        });
        await prisma.bangCuocGuiHang.delete({
          where: { bangCuocGuiHangId: sr.bangCuocGuiHangId },
        });
      } else {
        await prisma.bangCuocGuiHang.update({
          where: { bangCuocGuiHangId: sr.bangCuocGuiHangId },
          data: { tuyenXeId: dstId },
        });
      }
    }

    // Xoá DiemGiaoNhanTuyenXe, TuyenXeDiemDung trên bản sao srcId
    await prisma.diemGiaoNhanTuyenXe.deleteMany({ where: { tuyenXeId: srcId } });
    await prisma.tuyenXeDiemDung.deleteMany({ where: { tuyenXeId: srcId } });
    await prisma.phieuGuiHang.updateMany({
      where: { tuyenXeId: srcId },
      data: { tuyenXeId: dstId },
    });

    // Xử lý ChuyenXe trên srcId
    const dstTrips = await prisma.chuyenXe.findMany({
      where: { tuyenXeId: dstId },
      select: { chuyenXeId: true, ngayKhoiHanh: true, gioKhoiHanh: true },
    });
    const dstTripKeySet = new Set(
      dstTrips.map((t) => `${t.ngayKhoiHanh.toISOString()}_${t.gioKhoiHanh.toISOString()}`),
    );

    const srcTrips = await prisma.chuyenXe.findMany({
      where: { tuyenXeId: srcId },
      include: {
        _count: {
          select: {
            phieuGuiHangs: true,
            phanHois: true,
            giuChos: true,
          },
        },
      },
    });

    for (const st of srcTrips) {
      const tripKey = `${st.ngayKhoiHanh.toISOString()}_${st.gioKhoiHanh.toISOString()}`;
      const ticketCount = await prisma.ve.count({
        where: { gheChuyenXe: { chuyenXeId: st.chuyenXeId } },
      });
      const hasRefs =
        ticketCount > 0 ||
        st._count.phieuGuiHangs > 0 ||
        st._count.phanHois > 0 ||
        st._count.giuChos > 0;

      if (dstTripKeySet.has(tripKey) && !hasRefs) {
        await prisma.diemDonTraChuyenXe.deleteMany({ where: { chuyenXeId: st.chuyenXeId } });
        await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: st.chuyenXeId } });
        await prisma.chuyenXe.delete({ where: { chuyenXeId: st.chuyenXeId } });
      } else {
        await prisma.chuyenXe.update({
          where: { chuyenXeId: st.chuyenXeId },
          data: { tuyenXeId: dstId },
        });
        dstTripKeySet.add(tripKey);
      }
    }

    // Xoá tuyến bản sao srcId và cập nhật maTuyenXe chuẩn cho dstId
    await prisma.tuyenXe.delete({ where: { tuyenXeId: srcId } });
    await prisma.tuyenXe.update({
      where: { tuyenXeId: dstId },
      data: { maTuyenXe: canonicalMaTuyenXe },
    });
  }

  // Đảm bảo maTuyenXe của 11 tuyến gốc khớp 100% với công thức seed.mjs & seed-shipments-network.mjs
  const expectedRouteCodes = [
    { id: 1, code: deterministicUuid('TX', 'FUTA', 0) },
    { id: 2, code: deterministicUuid('TX', 'FUTA', 1) },
    { id: 3, code: deterministicUuid('TX', 'FUTA', 2) },
    { id: 4, code: deterministicUuid('TX', 'TB', 0) },
    { id: 5, code: deterministicUuid('TX', 'TB', 1) },
    { id: 6, code: deterministicUuid('TX', 'TB', 2) },
    { id: 7, code: deterministicUuid('TX', 'HM', 0) },
    { id: 8, code: deterministicUuid('TX', 'HM', 1) },
    { id: 9, code: deterministicUuid('TX', 'HM', 2) },
    { id: 10, code: deterministicUuid('TX', 'HM', 'TP.HCM', 'Đà Lạt') },
    { id: 11, code: deterministicUuid('TX', 'HM', 'Đà Lạt', 'TP.HCM') },
  ];
  for (const item of expectedRouteCodes) {
    const exists = await prisma.tuyenXe.findUnique({ where: { tuyenXeId: item.id } });
    if (exists && exists.maTuyenXe !== item.code) {
      await prisma.tuyenXe.update({
        where: { tuyenXeId: item.id },
        data: { maTuyenXe: item.code },
      });
    }
  }
  console.log(`   ✓ Đã gộp ${duplicateRoutePairs.length} tuyến xe bị nhân đôi và đồng bộ maTuyenXe chuẩn.`);

  // 1.2. Dọn các chuyến xe bị trùng (cùng tuyenXeId, ngayKhoiHanh, gioKhoiHanh)
  const allTrips = await prisma.chuyenXe.findMany({
    orderBy: { chuyenXeId: 'asc' },
    select: {
      chuyenXeId: true,
      tuyenXeId: true,
      ngayKhoiHanh: true,
      gioKhoiHanh: true,
    },
  });

  const tripsBySlot = new Map();
  for (const t of allTrips) {
    const slotKey = `${t.tuyenXeId}_${t.ngayKhoiHanh.toISOString()}_${t.gioKhoiHanh.toISOString()}`;
    if (!tripsBySlot.has(slotKey)) tripsBySlot.set(slotKey, []);
    tripsBySlot.get(slotKey).push(t);
  }

  let removedDuplicateSlotTrips = 0;
  for (const group of tripsBySlot.values()) {
    if (group.length <= 1) continue;
    // Giữ lại chuyến có vé/đơn hàng hoặc chuyến đầu tiên
    let kept = group[0];
    for (const candidate of group) {
      const cnt = await prisma.ve.count({
        where: { gheChuyenXe: { chuyenXeId: candidate.chuyenXeId } },
      });
      if (cnt > 0) {
        kept = candidate;
        break;
      }
    }
    for (const item of group) {
      if (item.chuyenXeId === kept.chuyenXeId) continue;
      const ticketCnt = await prisma.ve.count({
        where: { gheChuyenXe: { chuyenXeId: item.chuyenXeId } },
      });
      const shipCnt = await prisma.phieuGuiHang.count({
        where: { chuyenXeId: item.chuyenXeId },
      });
      if (ticketCnt === 0 && shipCnt === 0) {
        await prisma.diemDonTraChuyenXe.deleteMany({ where: { chuyenXeId: item.chuyenXeId } });
        await prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: item.chuyenXeId } });
        await prisma.giuCho.deleteMany({ where: { chuyenXeId: item.chuyenXeId } });
        await prisma.chuyenXe.delete({ where: { chuyenXeId: item.chuyenXeId } });
        removedDuplicateSlotTrips++;
      }
    }
  }
  console.log(`   ✓ Đã dọn ${removedDuplicateSlotTrips} chuyến xe trùng khung giờ trên cùng tuyến.`);

  // 1.3. Dọn sạch bản ghi DiemDonTra bị nhân đôi (giữ lại bản có maDiem chuẩn từ seed-locations/seed-crawled)
  const allPoints = await prisma.diemDonTra.findMany({
    orderBy: { diemDonTraId: 'desc' }, // Bản mới (ID cao) có maDiem chuẩn của seed-crawled-operator-data.mjs
  });
  const seenPointKey = new Set();
  const pointIdsToDelete = [];

  for (const p of allPoints) {
    const key = `${p.nhaXeId}:${p.tenDiem.trim().toLowerCase()}:${p.diaChi.trim().toLowerCase()}`;
    const isLegacyCorruptedUuid = p.maDiem === deterministicUuid('DDT', p.diemDonTraId);
    if (seenPointKey.has(key) || isLegacyCorruptedUuid) {
      pointIdsToDelete.push(p.diemDonTraId);
    } else {
      seenPointKey.add(key);
    }
  }

  if (pointIdsToDelete.length > 0) {
    await prisma.tuyenXeDiemDung.deleteMany({
      where: { diemDonTraId: { in: pointIdsToDelete } },
    });
    await prisma.diemDonTraChuyenXe.deleteMany({
      where: { diemDonTraId: { in: pointIdsToDelete } },
    });
    await prisma.diemDonTra.updateMany({
      where: { benTrungChuyenId: { in: pointIdsToDelete } },
      data: { benTrungChuyenId: null },
    });
    await prisma.diemDonTra.deleteMany({
      where: { diemDonTraId: { in: pointIdsToDelete } },
    });
  }
  console.log(`   ✓ Đã dọn ${pointIdsToDelete.length} bản ghi DiemDonTra trùng lặp.`);

  // 1.4. Dọn sạch bản ghi DiemGiaoNhanHang bị nhân đôi (giữ lại bản gốc được tham chiếu bởi PhieuGuiHang và cập nhật maDiem chuẩn)
  const allCargoPoints = await prisma.diemGiaoNhanHang.findMany({
    orderBy: { diemGiaoNhanHangId: 'asc' },
  });
  const cargoGroups = new Map();
  for (const cp of allCargoPoints) {
    const key = `${cp.nhaXeId}:${cp.tenDiem.trim().toLowerCase()}:${cp.diaChi.trim().toLowerCase()}`;
    if (!cargoGroups.has(key)) cargoGroups.set(key, []);
    cargoGroups.get(key).push(cp);
  }

  let removedCargoDuplicates = 0;
  for (const group of cargoGroups.values()) {
    if (group.length <= 1) continue;
    const primary = group[0]; // ID thấp đang được PhieuGuiHang tham chiếu
    const latest = group[group.length - 1]; // ID cao đang giữ maDiem chuẩn của seed.mjs / seed-shipments-network.mjs
    const canonicalCode = latest.maDiem;

    for (let i = 1; i < group.length; i++) {
      const dup = group[i];
      await prisma.phieuGuiHang.updateMany({
        where: { diemGuiId: dup.diemGiaoNhanHangId },
        data: { diemGuiId: primary.diemGiaoNhanHangId },
      });
      await prisma.phieuGuiHang.updateMany({
        where: { diemNhanId: dup.diemGiaoNhanHangId },
        data: { diemNhanId: primary.diemGiaoNhanHangId },
      });
      await prisma.diemGiaoNhanTuyenXe.deleteMany({
        where: { diemGiaoNhanHangId: dup.diemGiaoNhanHangId },
      });
      await prisma.diemGiaoNhanHang.delete({
        where: { diemGiaoNhanHangId: dup.diemGiaoNhanHangId },
      });
      removedCargoDuplicates++;
    }

    if (primary.maDiem !== canonicalCode) {
      await prisma.diemGiaoNhanHang.update({
        where: { diemGiaoNhanHangId: primary.diemGiaoNhanHangId },
        data: { maDiem: canonicalCode },
      });
    }
  }
  console.log(`   ✓ Đã dọn ${removedCargoDuplicates} bản ghi DiemGiaoNhanHang trùng lặp.`);
}

/**
 * Bước 2: Phân bổ lại xe (xeId) cho các chuyến xe trùng giờ xuất bến giữa các tuyến khác nhau của cùng nhà xe
 * để không có chiếc xe nào cùng 1 biển số lại xuất bến cùng giờ ở 2 đầu bến khác nhau.
 */
async function rebalanceSimultaneousVehicles(prisma) {
  console.log('\n--- 2. CÂN BẰNG PHÂN BỔ XE TRÁNH TRÙNG BIỂN SỐ CÙNG GIỜ XUẤT BẾN ---');

  const vehicles = await prisma.xe.findMany({
    where: { trangThai: 'HOAT_DONG' },
    include: { ghes: true },
    orderBy: { xeId: 'asc' },
  });
  const vehiclesByOp = new Map();
  const vehicleMap = new Map();
  for (const v of vehicles) {
    if (!vehiclesByOp.has(v.nhaXeId)) vehiclesByOp.set(v.nhaXeId, []);
    vehiclesByOp.get(v.nhaXeId).push(v);
    vehicleMap.set(v.xeId, v);
  }

  const allTrips = await prisma.chuyenXe.findMany({
    orderBy: [{ ngayKhoiHanh: 'asc' }, { gioKhoiHanh: 'asc' }, { tuyenXeId: 'asc' }],
    select: {
      chuyenXeId: true,
      nhaXeId: true,
      tuyenXeId: true,
      xeId: true,
      ngayKhoiHanh: true,
      gioKhoiHanh: true,
    },
  });

  // Nhóm theo (nhaXeId, ngayKhoiHanh, gioKhoiHanh)
  const slotGroups = new Map();
  for (const t of allTrips) {
    const key = `${t.nhaXeId}_${t.ngayKhoiHanh.toISOString()}_${t.gioKhoiHanh.toISOString()}`;
    if (!slotGroups.has(key)) slotGroups.set(key, []);
    slotGroups.get(key).push(t);
  }

  let reassignedCount = 0;
  for (const group of slotGroups.values()) {
    if (group.length <= 1) continue;
    const opVehicles = vehiclesByOp.get(group[0].nhaXeId) || [];
    if (opVehicles.length <= 1) continue;

    const usedVehicleIds = new Set();
    for (let idx = 0; idx < group.length; idx++) {
      const trip = group[idx];
      if (!usedVehicleIds.has(trip.xeId)) {
        usedVehicleIds.add(trip.xeId);
        continue;
      }

      // Kiểm tra xem chuyến có vé đã đặt không
      const ticketCount = await prisma.ve.count({
        where: { gheChuyenXe: { chuyenXeId: trip.chuyenXeId } },
      });
      const holdCount = await prisma.giuCho.count({
        where: { chuyenXeId: trip.chuyenXeId },
      });
      if (ticketCount > 0 || holdCount > 0) continue;

      // Chọn xe khác chưa được dùng trong cùng khung giờ này
      const dayNum = trip.ngayKhoiHanh.getUTCDate();
      let chosenVehicle = opVehicles.find((v) => !usedVehicleIds.has(v.xeId));
      if (!chosenVehicle) {
        chosenVehicle = opVehicles[(dayNum + idx + trip.tuyenXeId) % opVehicles.length];
      }
      usedVehicleIds.add(chosenVehicle.xeId);

      if (chosenVehicle.xeId !== trip.xeId) {
        await prisma.$transaction([
          prisma.gheChuyenXe.deleteMany({ where: { chuyenXeId: trip.chuyenXeId } }),
          prisma.chuyenXe.update({
            where: { chuyenXeId: trip.chuyenXeId },
            data: { xeId: chosenVehicle.xeId },
          }),
          prisma.gheChuyenXe.createMany({
            data: chosenVehicle.ghes.map((g) => ({
              chuyenXeId: trip.chuyenXeId,
              gheId: g.gheId,
              trangThai: 'TRONG',
              tang: g.tang,
              toaDoX: g.toaDoX,
              toaDoY: g.toaDoY,
            })),
          }),
        ]);
        reassignedCount++;
      }
    }
  }

  console.log(`   ✓ Đã phân bổ lại xe cho ${reassignedCount} chuyến xe bị trùng biển số cùng giờ.`);
}

/**
 * Bước 3: Khởi tạo đầy đủ các điểm đón/trả còn thiếu & các điểm TRUNG_CHUYEN cho 3 nhà xe,
 * sau đó thiết lập TuyenXeDiemDung tuần tự cho TOÀN BỘ tuyến xe.
 */
async function configureAllRouteStopTemplates(prisma) {
  console.log('\n--- 3. THIẾT LẬP LỘ TRÌNH ĐIỂM DỪNG (TuyenXeDiemDung) CHO TOÀN BỘ TUYẾN XE ---');

  const points = await prisma.diemDonTra.findMany({
    where: { trangThai: 'HOAT_DONG' },
  });

  function findStation(nhaXeId, matcher) {
    return points.find((p) => p.nhaXeId === nhaXeId && matcher(p)) ?? null;
  }

  async function ensureStation({
    nhaXeId,
    seedKey,
    tenDiem,
    loaiDiem,
    diaChi,
    baseStation,
    benTrungChuyenId = null,
    soDienThoai = null,
  }) {
    const maDiem = deterministicUuid('DDT-CUSTOM', nhaXeId, seedKey);
    let existing = await prisma.diemDonTra.findFirst({
      where: {
        nhaXeId,
        OR: [{ maDiem }, { tenDiem }],
      },
    });

    if (existing) {
      existing = await prisma.diemDonTra.update({
        where: { diemDonTraId: existing.diemDonTraId },
        data: {
          maDiem: existing.maDiem.length === 32 ? existing.maDiem : maDiem,
          tenDiem,
          loaiDiem,
          diaChi,
          diaDiemCuId: baseStation?.diaDiemCuId ?? existing.diaDiemCuId,
          diaDiemMoiId: baseStation?.diaDiemMoiId ?? existing.diaDiemMoiId,
          benTrungChuyenId,
          trangThai: 'HOAT_DONG',
        },
      });
    } else {
      existing = await prisma.diemDonTra.create({
        data: {
          nhaXeId,
          maDiem,
          tenDiem,
          loaiDiem,
          diaChi,
          diaDiemCuId: baseStation?.diaDiemCuId ?? null,
          diaDiemMoiId: baseStation?.diaDiemMoiId ?? null,
          benTrungChuyenId,
          soDienThoai,
          trangThai: 'HOAT_DONG',
        },
      });
      points.push(existing);
    }
    return existing;
  }

  // =========================================================================
  // A. CÁC BẾN CHÍNH CỦA TỪNG NHÀ XE
  // =========================================================================
  // 1. FUTA (nhaXeId = 1)
  const futaBxMienDongMoi = findStation(
    1,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase().includes('miền đông mới'),
  );
  const futaBxMienTay = findStation(
    1,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase() === 'bến xe miền tây',
  );
  const futaBxDaLat = findStation(
    1,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase() === 'bến xe đà lạt',
  );
  const futaBxNhaTrang = findStation(
    1,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase().includes('nha trang mới'),
  );
  const futaBxVungTau = findStation(
    1,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase().includes('bến xe vũng tàu'),
  );

  // Điểm trung chuyển FUTA
  const futaTcHcmMienDong = await ensureStation({
    nhaXeId: 1,
    seedKey: 'FUTA-TC-HCM-MD',
    tenDiem: 'Trung chuyển Nội thành TP.HCM (Quận 1, 3, 5, 10, Bình Thạnh)',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Đón/trả tận nơi khu vực nội thành TP. Hồ Chí Minh kết nối Bến xe Miền Đông mới',
    baseStation: futaBxMienDongMoi,
    benTrungChuyenId: futaBxMienDongMoi?.diemDonTraId ?? null,
    soDienThoai: '19006067',
  });

  const futaTcDaLat = await ensureStation({
    nhaXeId: 1,
    seedKey: 'FUTA-TC-DALAT',
    tenDiem: 'Trung chuyển Nội thành TP. Đà Lạt (Bán kính 5km quanh Chợ Đà Lạt)',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Đón/trả tận nơi tại các khách sạn, homestay trung tâm TP. Đà Lạt, Lâm Đồng',
    baseStation: futaBxDaLat,
    benTrungChuyenId: futaBxDaLat?.diemDonTraId ?? null,
    soDienThoai: '02633822577',
  });

  const futaDauGiay = await ensureStation({
    nhaXeId: 1,
    seedKey: 'FUTA-DAU-GIAY-QL20',
    tenDiem: 'Ngã 3 Dầu Giây (Quốc lộ 20)',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Nút giao Quốc lộ 1A - Quốc lộ 20, Thị trấn Dầu Giây, Thống Nhất, Đồng Nai',
    baseStation: findStation(1, (p) => p.tenDiem.includes('Tân Phú')),
    soDienThoai: '19006067',
  });

  const futaMadagui = await ensureStation({
    nhaXeId: 1,
    seedKey: 'FUTA-MADAGUI-QL20',
    tenDiem: 'Trạm dừng Madagui - Đạ Huoai',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Quốc lộ 20, Thị trấn Ma Đa Guôi, Huyện Đạ Huoai, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '19006067',
  });

  // 2. THÀNH BƯỞI (nhaXeId = 2)
  const tbBxMienDongMoi = findStation(
    2,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase().includes('miền đông mới'),
  );
  const tbBxDaLat =
    findStation(2, (p) => p.tenDiem === 'Bến xe Liên tỉnh Đà Lạt') ??
    findStation(2, (p) => p.tenDiem.includes('Đà Lạt') && p.loaiDiem === 'BEN_XE');
  const tbBxNhaTrang = findStation(
    2,
    (p) => p.loaiDiem === 'BEN_XE' && p.tenDiem.toLowerCase().includes('nha trang'),
  );

  const tbTcHcm = await ensureStation({
    nhaXeId: 2,
    seedKey: 'TB-TC-HCM-TSN',
    tenDiem: 'Điểm trung chuyển Sân bay Tân Sơn Nhất & Nội thành TP.HCM',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Ga Quốc Nội Sân bay Tân Sơn Nhất & các quận trung tâm TP. Hồ Chí Minh',
    baseStation: tbBxMienDongMoi,
    benTrungChuyenId: tbBxMienDongMoi?.diemDonTraId ?? null,
    soDienThoai: '19006079',
  });

  const tbTcDaLat = await ensureStation({
    nhaXeId: 2,
    seedKey: 'TB-TC-HO-XUAN-HUONG',
    tenDiem: 'Điểm đón trung chuyển Hồ Xuân Hương - Đà Lạt',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Quảng trường Lâm Viên, Đường Trần Quốc Toản, Phường 10, TP. Đà Lạt, Lâm Đồng',
    baseStation: tbBxDaLat,
    benTrungChuyenId: tbBxDaLat?.diemDonTraId ?? null,
    soDienThoai: '19006079',
  });

  const tbDauGiay = await ensureStation({
    nhaXeId: 2,
    seedKey: 'TB-DAU-GIAY',
    tenDiem: 'Điểm đón trả Ngã 3 Dầu Giây (QL20)',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Km 01 Quốc lộ 20, Thị trấn Dầu Giây, Huyện Thống Nhất, Đồng Nai',
    baseStation: findStation(2, (p) => p.tenDiem.includes('Biên Hòa')),
    soDienThoai: '19006079',
  });

  const tbDinhQuan = await ensureStation({
    nhaXeId: 2,
    seedKey: 'TB-DINH-QUAN',
    tenDiem: 'Điểm đón trả Định Quán - Đồng Nai (Km 112 QL20)',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Quốc lộ 20, Thị trấn Định Quán, Huyện Định Quán, Đồng Nai',
    baseStation: findStation(2, (p) => p.tenDiem.includes('Biên Hòa')),
    soDienThoai: '19006079',
  });

  // 3. HOA MAI (nhaXeId = 3)
  const hmVpMienDong =
    findStation(3, (p) => p.tenDiem === 'VP Miền Đông') ??
    findStation(3, (p) => p.tenDiem.includes('Miền Đông'));
  const hmBxVungTau =
    findStation(3, (p) => p.tenDiem === 'Bến xe Vũng Tàu' && p.diaChi.includes('192')) ??
    findStation(3, (p) => p.tenDiem === 'Bến xe Vũng Tàu');

  const hmTcSanBay = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-TC-SAN-BAY-TSN',
    tenDiem: 'Điểm trung chuyển Sân Bay Tân Sơn Nhất',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Cột B1 Ga Quốc Nội, Sân Bay Tân Sơn Nhất, Quận Tân Bình, TP. Hồ Chí Minh',
    baseStation: hmVpMienDong,
    benTrungChuyenId: hmVpMienDong?.diemDonTraId ?? null,
    soDienThoai: '0889200200',
  });

  const hmTcVungTau = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-TC-NOI-THANH-VT',
    tenDiem: 'Trung chuyển Nội thành TP. Vũng Tàu (Bãi Trước - Bãi Sau)',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Đón/trả tận nơi khu vực Bãi Trước, Bãi Sau, Trung tâm TP. Vũng Tàu',
    baseStation: hmBxVungTau,
    benTrungChuyenId: hmBxVungTau?.diemDonTraId ?? null,
    soDienThoai: '0889200200',
  });

  // Các điểm dọc tuyến TP.HCM <-> Đà Lạt cho Hoa Mai
  const hmBienHoa = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-BIEN-HOA-AMATA',
    tenDiem: 'Điểm đón trả Ngã 4 Amata - Biên Hòa',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Quốc lộ 1A, Phường Long Bình, TP. Biên Hòa, Đồng Nai',
    baseStation: futaDauGiay,
    soDienThoai: '0889200200',
  });
  const hmDauGiay = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-DAU-GIAY-QL20',
    tenDiem: 'Điểm đón trả Ngã 3 Dầu Giây (QL20)',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Ngã 3 Dầu Giây, Quốc lộ 20, Huyện Thống Nhất, Đồng Nai',
    baseStation: futaDauGiay,
    soDienThoai: '0889200200',
  });
  const hmBaoLoc = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-VP-BAO-LOC',
    tenDiem: 'Văn phòng Hoa Mai Bảo Lộc',
    loaiDiem: 'VAN_PHONG',
    diaChi: '285 Trần Phú, Phường Lộc Sơn, TP. Bảo Lộc, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '0889200200',
  });
  const hmDiLinh = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-DI-LINH',
    tenDiem: 'Điểm đón trả Chợ Di Linh (QL20)',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Quốc lộ 20, Thị trấn Di Linh, Huyện Di Linh, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '0889200200',
  });
  const hmDucTrong = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-DUC-TRONG',
    tenDiem: 'Điểm đón trả Liên Nghĩa - Đức Trọng',
    loaiDiem: 'DIEM_DON_TRA',
    diaChi: 'Quốc lộ 20, Thị trấn Liên Nghĩa, Huyện Đức Trọng, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '0889200200',
  });
  const hmBxDaLat = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-BX-DA-LAT',
    tenDiem: 'Bến xe Liên tỉnh Đà Lạt (Quầy Hoa Mai)',
    loaiDiem: 'BEN_XE',
    diaChi: '01 Tô Hiến Thành, Phường 3, TP. Đà Lạt, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '0889200200',
  });
  const hmVpDaLat = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-VP-DA-LAT',
    tenDiem: 'Văn phòng Hoa Mai Đà Lạt (Phan Đình Phùng)',
    loaiDiem: 'VAN_PHONG',
    diaChi: '31 Phan Đình Phùng, Phường 1, TP. Đà Lạt, Lâm Đồng',
    baseStation: futaBxDaLat,
    soDienThoai: '0889200200',
  });
  const hmTcDaLat = await ensureStation({
    nhaXeId: 3,
    seedKey: 'HM-TC-DA-LAT',
    tenDiem: 'Trung chuyển Nội thành TP. Đà Lạt (Hoa Mai)',
    loaiDiem: 'TRUNG_CHUYEN',
    diaChi: 'Đón/trả tận nơi khu vực trung tâm TP. Đà Lạt, Lâm Đồng',
    baseStation: hmBxDaLat,
    benTrungChuyenId: hmBxDaLat.diemDonTraId,
    soDienThoai: '0889200200',
  });

  // Helper lấy ID điểm theo tên
  function pid(nhaXeId, exactOrSub) {
    const exact = points.find(
      (p) => p.nhaXeId === nhaXeId && p.tenDiem.toLowerCase() === exactOrSub.toLowerCase(),
    );
    if (exact) return exact.diemDonTraId;
    const sub = points.find(
      (p) => p.nhaXeId === nhaXeId && p.tenDiem.toLowerCase().includes(exactOrSub.toLowerCase()),
    );
    return sub?.diemDonTraId ?? null;
  }

  // =========================================================================
  // B. ĐỊNH NGHĨA LỘ TRÌNH TUẦN TỰ CHO 11 TUYẾN CHÍNH (tuyenXeId 1..11)
  // =========================================================================
  const routeStopDefinitions = {
    // -----------------------------------------------------------------------
    // Tuyến 1: FUTA | TP.HCM -> Đà Lạt (420 phút)
    // -----------------------------------------------------------------------
    1: [
      { id: futaTcHcmMienDong.diemDonTraId, loaiDiem: 'DON', phutLech: -90, phuPhi: 0, ghiChu: 'Xe trung chuyển đón tận nơi nội thành TP.HCM' },
      { id: pid(1, 'Ung Bướu 1'), loaiDiem: 'DON', phutLech: -90, phuPhi: 0, ghiChu: 'Đón khách tại 68 Nơ Trang Long, Phường 14, Bình Thạnh' },
      { id: pid(1, 'Lê Văn Lương'), loaiDiem: 'DON', phutLech: -80, phuPhi: 0, ghiChu: 'Đón khách tại 486 Lê Văn Lương, Phường Tân Hưng, Quận 7' },
      { id: pid(1, 'Bến Xe An Sương'), loaiDiem: 'DON', phutLech: -75, phuPhi: 0, ghiChu: 'Đón khách trung chuyển từ Bến xe An Sương, Quốc lộ 22, Hóc Môn' },
      { id: pid(1, 'VP Đồng Đen'), loaiDiem: 'DON', phutLech: -65, phuPhi: 0, ghiChu: 'Đón khách tại VP 288 Đồng Đen, Phường 10, Tân Bình' },
      { id: pid(1, 'VP Y Dược'), loaiDiem: 'DON', phutLech: -60, phuPhi: 0, ghiChu: 'Đón khách tại VP 03 Mạc Thiên Tích (Y Dược), Quận 5' },
      { id: pid(1, 'VP Chợ Rẫy'), loaiDiem: 'DON', phutLech: -55, phuPhi: 0, ghiChu: 'Đón khách tại VP 20 Phạm Hữu Chí (Chợ Rẫy), Quận 5' },
      { id: pid(1, 'VP 202 Lê Hồng Phong'), loaiDiem: 'DON', phutLech: -50, phuPhi: 0, ghiChu: 'Đón khách tại VP 202-204 Lê Hồng Phong, Phường 4, Quận 5' },
      { id: pid(1, 'Văn phòng Đề Thám (Quận 1)'), loaiDiem: 'DON', phutLech: -40, phuPhi: 0, ghiChu: 'Đón khách tại VP 272 Đề Thám, Phường Phạm Ngũ Lão, Quận 1' },
      { id: pid(1, 'VP Hàng Xanh'), loaiDiem: 'DON', phutLech: -25, phuPhi: 0, ghiChu: 'Đón khách tại VP 486H-486J Điện Biên Phủ, Phường 21, Bình Thạnh' },
      { id: futaBxMienDongMoi?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Miền Đông mới (501 Hoàng Hữu Nam, TP. Thủ Đức)' },
      { id: pid(1, 'Xa Lộ Hà Nội'), loaiDiem: 'DON', phutLech: 15, phuPhi: 0, ghiChu: 'Đón khách dọc đường 798 Xa Lộ Hà Nội, Phường Hiệp Phú, TP. Thủ Đức' },
      { id: pid(1, 'Suối Linh'), loaiDiem: 'DON', phutLech: 40, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 4 Amata - Suối Linh, Phường Long Bình, Biên Hòa' },
      { id: pid(1, 'VP. Bến xe Biên Hòa'), loaiDiem: 'DON', phutLech: 50, phuPhi: 0, ghiChu: 'Đón khách dọc đường 04 Nguyễn Ái Quốc, Biên Hòa, Đồng Nai' },
      { id: futaDauGiay.diemDonTraId, loaiDiem: 'DON', phutLech: 65, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 3 Dầu Giây - Quốc lộ 20, Đồng Nai' },
      { id: pid(1, 'VP Tân Phú'), loaiDiem: 'DON', phutLech: 120, phuPhi: 0, ghiChu: 'Đón khách dọc đường 782 Quốc lộ 20, Thị trấn Tân Phú, Đồng Nai' },
      { id: futaMadagui.diemDonTraId, loaiDiem: 'TRA', phutLech: 175, phuPhi: 0, ghiChu: 'Trả khách dọc đường Thị trấn Ma Đa Guôi - Đạ Huoai, Lâm Đồng' },
      { id: pid(1, 'VP Bảo Lộc'), loaiDiem: 'TRA', phutLech: 240, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 399 Trần Phú, Phường Lộc Sơn, TP. Bảo Lộc' },
      { id: pid(1, 'Văn Phòng Lộc An'), loaiDiem: 'TRA', phutLech: 270, phuPhi: 0, ghiChu: 'Trả khách dọc đường Quốc lộ 20, Xã Lộc An, Bảo Lâm, Lâm Đồng' },
      { id: pid(1, 'Di Linh'), loaiDiem: 'TRA', phutLech: 310, phuPhi: 0, ghiChu: 'Trả khách dọc đường 735 Hùng Vương, Thị trấn Di Linh, Lâm Đồng' },
      { id: pid(1, 'VP Hoà Ninh'), loaiDiem: 'TRA', phutLech: 330, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ngã 3 Hoà Ninh, Di Linh, Lâm Đồng' },
      { id: pid(1, 'Đức Trọng'), loaiDiem: 'TRA', phutLech: 365, phuPhi: 0, ghiChu: 'Trả khách dọc đường 795 Quốc lộ 20, TT. Liên Nghĩa, Đức Trọng' },
      { id: pid(1, 'VP Fi Nôm'), loaiDiem: 'TRA', phutLech: 380, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ngã 3 Fi Nôm, Hiệp Thạnh, Đức Trọng' },
      { id: futaBxDaLat?.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Đà Lạt (01 Tô Hiến Thành, Phường 3, TP. Đà Lạt)' },
      { id: pid(1, 'VP Lê Quý Đôn'), loaiDiem: 'TRA', phutLech: 435, phuPhi: 0, ghiChu: 'Trả khách tại VP 11A/2 Lê Quý Đôn, Phường 5, TP. Đà Lạt' },
      { id: pid(1, 'VP Trại Mát'), loaiDiem: 'TRA', phutLech: 445, phuPhi: 0, ghiChu: 'Trả khách tại VP 07 Huỳnh Tấn Phát - Trại Mát, Phường 11, Đà Lạt' },
      { id: futaTcDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 455, phuPhi: 0, ghiChu: 'Xe trung chuyển trả khách tận nơi nội thành TP. Đà Lạt' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 2: FUTA | Đà Lạt -> TP.HCM (420 phút)
    // -----------------------------------------------------------------------
    2: [
      { id: futaTcDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: -60, phuPhi: 0, ghiChu: 'Xe trung chuyển đón tận nơi nội thành TP. Đà Lạt' },
      { id: pid(1, 'VP Trại Mát'), loaiDiem: 'DON', phutLech: -35, phuPhi: 0, ghiChu: 'Đón khách tại VP Trại Mát - Phường 11, Đà Lạt' },
      { id: pid(1, 'VP Lê Quý Đôn'), loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón khách tại VP 11A/2 Lê Quý Đôn, Đà Lạt' },
      { id: futaBxDaLat?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Liên tỉnh Đà Lạt' },
      { id: pid(1, 'VP Fi Nôm'), loaiDiem: 'DON', phutLech: 25, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 3 Fi Nôm, Đức Trọng' },
      { id: pid(1, 'Đức Trọng'), loaiDiem: 'DON', phutLech: 40, phuPhi: 0, ghiChu: 'Đón khách dọc đường Quốc lộ 20 - Liên Nghĩa, Đức Trọng' },
      { id: pid(1, 'VP Hoà Ninh'), loaiDiem: 'DON', phutLech: 70, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 3 Hoà Ninh, Di Linh' },
      { id: pid(1, 'Di Linh'), loaiDiem: 'DON', phutLech: 90, phuPhi: 0, ghiChu: 'Đón khách dọc đường Thị trấn Di Linh' },
      { id: pid(1, 'Văn Phòng Lộc An'), loaiDiem: 'DON', phutLech: 120, phuPhi: 0, ghiChu: 'Đón khách dọc đường Quốc lộ 20 - Lộc An' },
      { id: pid(1, 'VP Bảo Lộc'), loaiDiem: 'DON', phutLech: 150, phuPhi: 0, ghiChu: 'Đón khách tại VP 399 Trần Phú, TP. Bảo Lộc' },
      { id: pid(1, 'VP Tân Phú'), loaiDiem: 'TRA', phutLech: 270, phuPhi: 0, ghiChu: 'Trả khách dọc đường Thị trấn Tân Phú, Đồng Nai' },
      { id: futaDauGiay.diemDonTraId, loaiDiem: 'TRA', phutLech: 330, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ngã 3 Dầu Giây - Đồng Nai' },
      { id: pid(1, 'Suối Linh'), loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ngã 4 Amata - Biên Hòa' },
      { id: pid(1, 'Xa Lộ Hà Nội'), loaiDiem: 'TRA', phutLech: 390, phuPhi: 0, ghiChu: 'Trả khách dọc đường Xa Lộ Hà Nội - TP. Thủ Đức' },
      { id: pid(1, 'Mai Chí Thọ (đón/trả khách)'), loaiDiem: 'TRA', phutLech: 405, phuPhi: 0, ghiChu: 'Trả khách nút giao Mai Chí Thọ, TP. Thủ Đức' },
      { id: futaBxMienDongMoi?.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Miền Đông mới (TP. Thủ Đức)' },
      { id: pid(1, 'VP Hàng Xanh'), loaiDiem: 'TRA', phutLech: 440, phuPhi: 0, ghiChu: 'Trả khách tại VP Hàng Xanh, Bình Thạnh' },
      { id: pid(1, 'Văn phòng Đề Thám (Quận 1)'), loaiDiem: 'TRA', phutLech: 455, phuPhi: 0, ghiChu: 'Trả khách tại VP 272 Đề Thám, Quận 1' },
      { id: pid(1, 'VP 202 Lê Hồng Phong'), loaiDiem: 'TRA', phutLech: 470, phuPhi: 0, ghiChu: 'Trả khách tại VP 202 Lê Hồng Phong, Quận 5' },
      { id: futaTcHcmMienDong.diemDonTraId, loaiDiem: 'TRA', phutLech: 485, phuPhi: 0, ghiChu: 'Xe trung chuyển trả khách tận nơi nội thành TP.HCM' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 3: FUTA | TP.HCM -> Nha Trang (540 phút)
    // -----------------------------------------------------------------------
    3: [
      { id: futaTcHcmMienDong.diemDonTraId, loaiDiem: 'DON', phutLech: -60, phuPhi: 0, ghiChu: 'Trung chuyển đón nội thành TP.HCM' },
      { id: pid(1, 'VP 202 Lê Hồng Phong'), loaiDiem: 'DON', phutLech: -45, phuPhi: 0, ghiChu: 'Đón tại VP 202 Lê Hồng Phong' },
      { id: pid(1, 'VP Hàng Xanh'), loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón tại VP Hàng Xanh' },
      { id: futaBxMienDongMoi?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát Bến xe Miền Đông mới' },
      { id: pid(1, 'Suối Linh'), loaiDiem: 'DON', phutLech: 35, phuPhi: 0, ghiChu: 'Đón dọc đường Biên Hòa' },
      { id: pid(1, 'VP Bến xe Cam Ranh'), loaiDiem: 'TRA', phutLech: 460, phuPhi: 0, ghiChu: 'Trả dọc đường Cam Ranh' },
      { id: pid(1, 'Văn phòng Mỹ Ca'), loaiDiem: 'TRA', phutLech: 480, phuPhi: 0, ghiChu: 'Trả dọc đường Ngã 3 Mỹ Ca' },
      { id: futaBxNhaTrang?.diemDonTraId, loaiDiem: 'TRA', phutLech: 540, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Phía Nam Nha Trang Mới' },
      { id: pid(1, 'Văn phòng 176 Trần Quý Cáp'), loaiDiem: 'TRA', phutLech: 555, phuPhi: 0, ghiChu: 'Trả tại VP 176 Trần Quý Cáp, Nha Trang' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 4: THÀNH BƯỞI | Đà Lạt -> TP.HCM (420 phút)
    // -----------------------------------------------------------------------
    4: [
      { id: tbTcDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: -45, phuPhi: 15000, ghiChu: 'Trung chuyển đón tận nơi khu vực Hồ Xuân Hương - Đà Lạt' },
      { id: pid(2, 'VP Phan Bội Châu'), loaiDiem: 'DON', phutLech: -25, phuPhi: 0, ghiChu: 'Đón khách tại VP 55 Phan Bội Châu, Đà Lạt' },
      { id: pid(2, 'VP Lữ Gia'), loaiDiem: 'DON', phutLech: -15, phuPhi: 0, ghiChu: 'Đón khách tại VP 06 Lữ Gia, Đà Lạt' },
      { id: tbBxDaLat?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Liên tỉnh Đà Lạt' },
      { id: pid(2, 'VP Đức Trọng'), loaiDiem: 'DON', phutLech: 40, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP 514 Quốc lộ 20, Đức Trọng' },
      { id: pid(2, 'VP Di Linh'), loaiDiem: 'DON', phutLech: 90, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP 1180 Hùng Vương, Di Linh' },
      { id: pid(2, 'VP Bảo Lộc'), loaiDiem: 'DON', phutLech: 150, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP 139 Trần Phú, TP. Bảo Lộc' },
      { id: tbDinhQuan.diemDonTraId, loaiDiem: 'TRA', phutLech: 270, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Định Quán - Quốc lộ 20' },
      { id: tbDauGiay.diemDonTraId, loaiDiem: 'TRA', phutLech: 330, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Ngã 3 Dầu Giây' },
      { id: pid(2, 'VP Biên Hòa'), loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP Long Bình Tân, Biên Hòa' },
      { id: pid(2, 'VP Thủ Đức'), loaiDiem: 'TRA', phutLech: 390, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 48C Xa Lộ Hà Nội, Thủ Đức' },
      { id: pid(2, 'VP Quốc Lộ 13'), loaiDiem: 'TRA', phutLech: 405, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 704 Quốc Lộ 13, Thủ Đức' },
      { id: tbBxMienDongMoi?.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Miền Đông Mới (Quầy vé 30)' },
      { id: pid(2, 'VP Hàng Xanh'), loaiDiem: 'TRA', phutLech: 440, phuPhi: 0, ghiChu: 'Trả khách tại VP 630 Điện Biên Phủ, Bình Thạnh' },
      { id: pid(2, 'VP Lê Hồng Phong'), loaiDiem: 'TRA', phutLech: 460, phuPhi: 0, ghiChu: 'Trả khách tại VP 266-268 Lê Hồng Phong, Quận 5' },
      { id: pid(2, 'VP Đầm Sen'), loaiDiem: 'TRA', phutLech: 475, phuPhi: 0, ghiChu: 'Trả khách tại VP 372 Lạc Long Quân, Quận 11' },
      { id: tbTcHcm.diemDonTraId, loaiDiem: 'TRA', phutLech: 490, phuPhi: 20000, ghiChu: 'Trung chuyển trả tận nơi Sân bay Tân Sơn Nhất & Nội thành TP.HCM' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 5: THÀNH BƯỞI | TP.HCM -> Đà Lạt (420 phút)
    // -----------------------------------------------------------------------
    5: [
      { id: tbTcHcm.diemDonTraId, loaiDiem: 'DON', phutLech: -65, phuPhi: 20000, ghiChu: 'Trung chuyển đón tận nơi Sân bay Tân Sơn Nhất & Nội thành TP.HCM' },
      { id: pid(2, 'VP Đầm Sen'), loaiDiem: 'DON', phutLech: -55, phuPhi: 0, ghiChu: 'Đón khách tại VP 372 Lạc Long Quân (Đầm Sen), Quận 11' },
      { id: pid(2, 'VP Lê Hồng Phong'), loaiDiem: 'DON', phutLech: -45, phuPhi: 0, ghiChu: 'Đón khách tại VP 266-268 Lê Hồng Phong, Quận 5' },
      { id: pid(2, 'VP Hàng Xanh'), loaiDiem: 'DON', phutLech: -25, phuPhi: 0, ghiChu: 'Đón khách tại VP 630 Điện Biên Phủ (Hàng Xanh), Bình Thạnh' },
      { id: pid(2, 'VP Quốc Lộ 13'), loaiDiem: 'DON', phutLech: -15, phuPhi: 0, ghiChu: 'Đón khách tại VP 704 Quốc Lộ 13, Hiệp Bình, Thủ Đức' },
      { id: tbBxMienDongMoi?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Miền Đông Mới (501 Hoàng Hữu Nam)' },
      { id: pid(2, 'VP Thủ Đức'), loaiDiem: 'DON', phutLech: 15, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP 48C Xa Lộ Hà Nội, Thủ Đức' },
      { id: pid(2, 'VP Biên Hòa'), loaiDiem: 'DON', phutLech: 35, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP Long Bình Tân, Biên Hòa' },
      { id: tbDauGiay.diemDonTraId, loaiDiem: 'DON', phutLech: 60, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại Ngã 3 Dầu Giây - Quốc lộ 20' },
      { id: tbDinhQuan.diemDonTraId, loaiDiem: 'TRA', phutLech: 135, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Định Quán - Quốc lộ 20' },
      { id: pid(2, 'VP Bảo Lộc'), loaiDiem: 'TRA', phutLech: 240, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 139 Trần Phú, TP. Bảo Lộc' },
      { id: pid(2, 'VP Di Linh'), loaiDiem: 'TRA', phutLech: 300, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 1180 Hùng Vương, Di Linh' },
      { id: pid(2, 'VP Đức Trọng'), loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP 514 Quốc lộ 20, Đức Trọng' },
      { id: tbBxDaLat?.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Liên tỉnh Đà Lạt (01 Tô Hiến Thành)' },
      { id: pid(2, 'VP Lữ Gia'), loaiDiem: 'TRA', phutLech: 435, phuPhi: 0, ghiChu: 'Trả khách tại VP 06 Lữ Gia, TP. Đà Lạt' },
      { id: pid(2, 'VP Phan Bội Châu'), loaiDiem: 'TRA', phutLech: 445, phuPhi: 0, ghiChu: 'Trả khách tại VP 55 Phan Bội Châu, Trung tâm Đà Lạt' },
      { id: tbTcDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 460, phuPhi: 15000, ghiChu: 'Trung chuyển trả khách tận nơi khu vực Hồ Xuân Hương - Đà Lạt' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 6: THÀNH BƯỞI | Đà Lạt -> Nha Trang (240 phút)
    // -----------------------------------------------------------------------
    6: [
      { id: tbTcDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: -45, phuPhi: 15000, ghiChu: 'Trung chuyển đón tại Hồ Xuân Hương' },
      { id: pid(2, 'VP Phan Bội Châu'), loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón tại VP Phan Bội Châu' },
      { id: tbBxDaLat?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát Bến xe Liên tỉnh Đà Lạt' },
      { id: pid(2, 'VP Lữ Gia'), loaiDiem: 'DON', phutLech: 15, phuPhi: 0, ghiChu: 'Đón dọc đường tại VP Lữ Gia' },
      { id: tbBxNhaTrang?.diemDonTraId, loaiDiem: 'TRA', phutLech: 225, phuPhi: 0, ghiChu: 'Trả tại Bến xe phía nam Nha Trang' },
      { id: pid(2, 'VP Nha Trang'), loaiDiem: 'TRA', phutLech: 240, phuPhi: 0, ghiChu: 'Bến cuối: VP Nha Trang (KĐT Lê Hồng Phong 2)' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 7: HOA MAI | Vũng Tàu -> TP.HCM (150 phút)
    // -----------------------------------------------------------------------
    7: [
      { id: hmTcVungTau.diemDonTraId, loaiDiem: 'DON', phutLech: -35, phuPhi: 0, ghiChu: 'Xe trung chuyển đón tận nơi Bãi Trước, Bãi Sau - TP. Vũng Tàu' },
      { id: pid(3, 'VP Trưng Nhị'), loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón khách tại VP 47 Trưng Nhị, Phường 1, Vũng Tàu' },
      { id: pid(3, 'Bình Giã'), loaiDiem: 'DON', phutLech: -10, phuPhi: 0, ghiChu: 'Đón khách tại 154/1 Bình Giã, Phường 8, Vũng Tàu' },
      { id: hmBxVungTau?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Vũng Tàu (192 Nam Kỳ Khởi Nghĩa)' },
      { id: pid(3, 'Nhà thờ Phước Thành'), loaiDiem: 'DON', phutLech: 10, phuPhi: 0, ghiChu: 'Đón khách dọc đường Nhà thờ Phước Thành, Vũng Tàu' },
      { id: pid(3, 'Hải Đoàn 128'), loaiDiem: 'DON', phutLech: 15, phuPhi: 0, ghiChu: 'Đón khách dọc đường Hải Đoàn 128, Vũng Tàu' },
      { id: pid(3, 'Nhà thờ Giáo xứ Nam Bình'), loaiDiem: 'DON', phutLech: 20, phuPhi: 0, ghiChu: 'Đón khách dọc đường Giáo xứ Nam Bình, Vũng Tàu' },
      { id: pid(3, 'Cây xăng Petrolimex số 4'), loaiDiem: 'DON', phutLech: 25, phuPhi: 0, ghiChu: 'Đón khách dọc đường Cây xăng Petrolimex số 4' },
      { id: pid(3, 'Ẹo Ông Từ'), loaiDiem: 'DON', phutLech: 32, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ẹo Ông Từ, cửa ngõ Vũng Tàu' },
      { id: pid(3, 'Bến xe Bà Rịa'), loaiDiem: 'DON', phutLech: 42, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại Bến xe Bà Rịa' },
      { id: pid(3, 'Co.opmart Bà Rịa'), loaiDiem: 'DON', phutLech: 47, phuPhi: 0, ghiChu: 'Đón khách dọc đường Co.opmart Bà Rịa' },
      { id: pid(3, 'Cổng chào Bà Rịa'), loaiDiem: 'DON', phutLech: 52, phuPhi: 0, ghiChu: 'Đón khách dọc Quốc lộ 51 - Cổng chào Bà Rịa' },
      { id: pid(3, 'Chợ Kim Hải'), loaiDiem: 'DON', phutLech: 60, phuPhi: 0, ghiChu: 'Đón khách dọc Quốc lộ 51 - Chợ Kim Hải' },
      { id: pid(3, 'Thị Trấn Phú Mỹ (Dọc Quốc lộ 51)'), loaiDiem: 'DON', phutLech: 70, phuPhi: 0, ghiChu: 'Đón khách dọc Quốc lộ 51 - Thị trấn Phú Mỹ' },
      { id: pid(3, 'Ngã 3 Mỹ Xuân'), loaiDiem: 'DON', phutLech: 80, phuPhi: 0, ghiChu: 'Đón khách dọc Quốc lộ 51 - Ngã 3 Mỹ Xuân' },
      { id: pid(3, 'N3 Vũng Tàu'), loaiDiem: 'TRA', phutLech: 110, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ngã 3 Vũng Tàu' },
      { id: pid(3, 'Cao Tốc'), loaiDiem: 'TRA', phutLech: 125, phuPhi: 0, ghiChu: 'Trả khách đầu Cao tốc Long Thành - Dầu Giây (TP. Thủ Đức)' },
      { id: pid(3, 'Hàng Xanh'), loaiDiem: 'TRA', phutLech: 140, phuPhi: 0, ghiChu: 'Trả khách dọc đường 450H Điện Biên Phủ (Hàng Xanh)' },
      { id: hmVpMienDong?.diemDonTraId, loaiDiem: 'TRA', phutLech: 150, phuPhi: 0, ghiChu: 'Bến cuối chính: VP Miền Đông (167 Quốc lộ 13, Bình Thạnh)' },
      { id: pid(3, 'Nguyễn Thái Bình (VIP)'), loaiDiem: 'TRA', phutLech: 160, phuPhi: 0, ghiChu: 'Trả khách tại VP 83 Nguyễn Thái Bình, Quận 1' },
      { id: pid(3, 'Văn phòng Quận 5'), loaiDiem: 'TRA', phutLech: 170, phuPhi: 0, ghiChu: 'Trả khách tại Văn phòng Quận 5 (An Đông)' },
      { id: hmTcSanBay.diemDonTraId, loaiDiem: 'TRA', phutLech: 185, phuPhi: 20000, ghiChu: 'Trung chuyển trả khách tại Sân Bay Tân Sơn Nhất' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 8: HOA MAI | TP.HCM -> Vũng Tàu (150 phút)
    // -----------------------------------------------------------------------
    8: [
      { id: hmTcSanBay.diemDonTraId, loaiDiem: 'DON', phutLech: -45, phuPhi: 20000, ghiChu: 'Trung chuyển đón khách từ Sân Bay Tân Sơn Nhất' },
      { id: pid(3, 'An Đông'), loaiDiem: 'DON', phutLech: -35, phuPhi: 0, ghiChu: 'Đón khách tại 275 Hùng Vương (An Đông), Quận 5' },
      { id: pid(3, 'Văn phòng Quận 5'), loaiDiem: 'DON', phutLech: -25, phuPhi: 0, ghiChu: 'Đón khách tại Văn phòng Quận 5' },
      { id: pid(3, 'Nguyễn Thái Bình (VIP)'), loaiDiem: 'DON', phutLech: -15, phuPhi: 0, ghiChu: 'Đón khách tại VP 83 Nguyễn Thái Bình, Quận 1' },
      { id: hmVpMienDong?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại VP Miền Đông (167 Quốc lộ 13, Bình Thạnh)' },
      { id: pid(3, 'Hàng Xanh'), loaiDiem: 'DON', phutLech: 10, phuPhi: 0, ghiChu: 'Đón khách dọc đường 450H Điện Biên Phủ (Hàng Xanh)' },
      { id: pid(3, 'Cao Tốc'), loaiDiem: 'DON', phutLech: 25, phuPhi: 0, ghiChu: 'Đón khách dọc đường đầu Cao tốc Long Thành, TP. Thủ Đức' },
      { id: pid(3, 'N3 Vũng Tàu'), loaiDiem: 'DON', phutLech: 40, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 3 Vũng Tàu' },
      { id: pid(3, 'Ngã 3 Mỹ Xuân'), loaiDiem: 'TRA', phutLech: 65, phuPhi: 0, ghiChu: 'Trả khách dọc Quốc lộ 51 - Ngã 3 Mỹ Xuân' },
      { id: pid(3, 'Thị Trấn Phú Mỹ (Dọc Quốc lộ 51)'), loaiDiem: 'TRA', phutLech: 75, phuPhi: 0, ghiChu: 'Trả khách dọc Quốc lộ 51 - Thị trấn Phú Mỹ' },
      { id: pid(3, 'Chợ Kim Hải'), loaiDiem: 'TRA', phutLech: 82, phuPhi: 0, ghiChu: 'Trả khách dọc Quốc lộ 51 - Chợ Kim Hải' },
      { id: pid(3, 'Cổng chào Bà Rịa'), loaiDiem: 'TRA', phutLech: 90, phuPhi: 0, ghiChu: 'Trả khách dọc đường Cổng chào Bà Rịa' },
      { id: pid(3, 'Bến xe Bà Rịa'), loaiDiem: 'TRA', phutLech: 95, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Bến xe Bà Rịa' },
      { id: pid(3, 'Co.opmart Bà Rịa'), loaiDiem: 'TRA', phutLech: 100, phuPhi: 0, ghiChu: 'Trả khách tại Co.opmart Bà Rịa' },
      { id: pid(3, 'Ẹo Ông Từ'), loaiDiem: 'TRA', phutLech: 112, phuPhi: 0, ghiChu: 'Trả khách dọc đường Ẹo Ông Từ, Vũng Tàu' },
      { id: pid(3, 'Cảng Cát Lở'), loaiDiem: 'TRA', phutLech: 118, phuPhi: 0, ghiChu: 'Trả khách dọc đường Cảng Cát Lở, Vũng Tàu' },
      { id: pid(3, 'Cây xăng Petrolimex số 4'), loaiDiem: 'TRA', phutLech: 125, phuPhi: 0, ghiChu: 'Trả khách dọc đường Cây xăng Petrolimex số 4' },
      { id: pid(3, 'Nhà thờ Giáo xứ Nam Bình'), loaiDiem: 'TRA', phutLech: 132, phuPhi: 0, ghiChu: 'Trả khách dọc đường Giáo xứ Nam Bình, Vũng Tàu' },
      { id: hmBxVungTau?.diemDonTraId, loaiDiem: 'TRA', phutLech: 145, phuPhi: 0, ghiChu: 'Bến cuối chính: Bến xe Vũng Tàu (192 Nam Kỳ Khởi Nghĩa)' },
      { id: pid(3, 'VP Trưng Nhị'), loaiDiem: 'TRA', phutLech: 150, phuPhi: 0, ghiChu: 'Trả khách tại VP 47 Trưng Nhị, Phường 1, Vũng Tàu' },
      { id: hmTcVungTau.diemDonTraId, loaiDiem: 'TRA', phutLech: 165, phuPhi: 0, ghiChu: 'Xe trung chuyển trả khách tận nơi Bãi Trước, Bãi Sau - Vũng Tàu' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 9: HOA MAI | Vũng Tàu -> Đà Lạt (360 phút)
    // -----------------------------------------------------------------------
    9: [
      { id: hmTcVungTau.diemDonTraId, loaiDiem: 'DON', phutLech: -30, phuPhi: 0, ghiChu: 'Trung chuyển đón nội thành Vũng Tàu' },
      { id: pid(3, 'VP Trưng Nhị'), loaiDiem: 'DON', phutLech: -15, phuPhi: 0, ghiChu: 'Đón tại VP 47 Trưng Nhị' },
      { id: hmBxVungTau?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất phát Bến xe Vũng Tàu' },
      { id: pid(3, 'Bến xe Bà Rịa'), loaiDiem: 'DON', phutLech: 30, phuPhi: 0, ghiChu: 'Đón dọc đường Bến xe Bà Rịa' },
      { id: hmDauGiay.diemDonTraId, loaiDiem: 'DON', phutLech: 90, phuPhi: 0, ghiChu: 'Đón dọc đường Ngã 3 Dầu Giây' },
      { id: hmBaoLoc.diemDonTraId, loaiDiem: 'TRA', phutLech: 210, phuPhi: 0, ghiChu: 'Trả dọc đường VP Hoa Mai Bảo Lộc' },
      { id: hmDiLinh.diemDonTraId, loaiDiem: 'TRA', phutLech: 260, phuPhi: 0, ghiChu: 'Trả dọc đường Chợ Di Linh' },
      { id: hmDucTrong.diemDonTraId, loaiDiem: 'TRA', phutLech: 310, phuPhi: 0, ghiChu: 'Trả dọc đường Liên Nghĩa - Đức Trọng' },
      { id: hmBxDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Liên tỉnh Đà Lạt' },
      { id: hmVpDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 375, phuPhi: 0, ghiChu: 'Trả tại VP Hoa Mai Đà Lạt' },
      { id: hmTcDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 390, phuPhi: 0, ghiChu: 'Trung chuyển trả nội thành Đà Lạt' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 10: HOA MAI | TP.HCM -> Đà Lạt (420 phút)
    // -----------------------------------------------------------------------
    10: [
      { id: hmTcSanBay.diemDonTraId, loaiDiem: 'DON', phutLech: -50, phuPhi: 20000, ghiChu: 'Trung chuyển đón từ Sân Bay Tân Sơn Nhất' },
      { id: pid(3, 'Văn phòng Quận 5'), loaiDiem: 'DON', phutLech: -35, phuPhi: 0, ghiChu: 'Đón khách tại Văn phòng Quận 5' },
      { id: pid(3, 'Nguyễn Thái Bình (VIP)'), loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón khách tại VP 83 Nguyễn Thái Bình, Quận 1' },
      { id: hmVpMienDong?.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại VP Miền Đông (167 Quốc lộ 13)' },
      { id: pid(3, 'Hàng Xanh'), loaiDiem: 'DON', phutLech: 15, phuPhi: 0, ghiChu: 'Đón khách dọc đường Hàng Xanh, Bình Thạnh' },
      { id: pid(3, 'Cao Tốc'), loaiDiem: 'DON', phutLech: 30, phuPhi: 0, ghiChu: 'Đón khách dọc đường đầu Cao tốc Long Thành, Thủ Đức' },
      { id: hmBienHoa.diemDonTraId, loaiDiem: 'DON', phutLech: 45, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 4 Amata - Biên Hòa' },
      { id: hmDauGiay.diemDonTraId, loaiDiem: 'DON', phutLech: 70, phuPhi: 0, ghiChu: 'Đón khách dọc đường Ngã 3 Dầu Giây - Quốc lộ 20' },
      { id: hmBaoLoc.diemDonTraId, loaiDiem: 'TRA', phutLech: 240, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại VP Hoa Mai Bảo Lộc' },
      { id: hmDiLinh.diemDonTraId, loaiDiem: 'TRA', phutLech: 300, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Chợ Di Linh - Quốc lộ 20' },
      { id: hmDucTrong.diemDonTraId, loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Liên Nghĩa - Đức Trọng' },
      { id: hmBxDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối: Bến xe Liên tỉnh Đà Lạt (Quầy Hoa Mai)' },
      { id: hmVpDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 435, phuPhi: 0, ghiChu: 'Trả khách tại VP Hoa Mai Đà Lạt (31 Phan Đình Phùng)' },
      { id: hmTcDaLat.diemDonTraId, loaiDiem: 'TRA', phutLech: 450, phuPhi: 0, ghiChu: 'Xe trung chuyển trả khách nội thành TP. Đà Lạt' },
    ],

    // -----------------------------------------------------------------------
    // Tuyến 11: HOA MAI | Đà Lạt -> TP.HCM (420 phút)
    // -----------------------------------------------------------------------
    11: [
      { id: hmTcDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: -45, phuPhi: 0, ghiChu: 'Xe trung chuyển đón khách nội thành TP. Đà Lạt' },
      { id: hmVpDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: -20, phuPhi: 0, ghiChu: 'Đón khách tại VP Hoa Mai Đà Lạt (31 Phan Đình Phùng)' },
      { id: hmBxDaLat.diemDonTraId, loaiDiem: 'DON', phutLech: 0, phuPhi: 0, ghiChu: 'Xuất bến chính tại Bến xe Liên tỉnh Đà Lạt' },
      { id: hmDucTrong.diemDonTraId, loaiDiem: 'DON', phutLech: 40, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại Liên Nghĩa - Đức Trọng' },
      { id: hmDiLinh.diemDonTraId, loaiDiem: 'DON', phutLech: 90, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại Chợ Di Linh - Quốc lộ 20' },
      { id: hmBaoLoc.diemDonTraId, loaiDiem: 'DON', phutLech: 150, phuPhi: 0, ghiChu: 'Đón khách dọc đường tại VP Hoa Mai Bảo Lộc' },
      { id: hmDauGiay.diemDonTraId, loaiDiem: 'TRA', phutLech: 330, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Ngã 3 Dầu Giây' },
      { id: hmBienHoa.diemDonTraId, loaiDiem: 'TRA', phutLech: 360, phuPhi: 0, ghiChu: 'Trả khách dọc đường tại Ngã 4 Amata - Biên Hòa' },
      { id: pid(3, 'Cao Tốc'), loaiDiem: 'TRA', phutLech: 390, phuPhi: 0, ghiChu: 'Trả khách đầu Cao tốc Long Thành - TP. Thủ Đức' },
      { id: pid(3, 'Hàng Xanh'), loaiDiem: 'TRA', phutLech: 405, phuPhi: 0, ghiChu: 'Trả khách dọc đường Hàng Xanh, Bình Thạnh' },
      { id: hmVpMienDong?.diemDonTraId, loaiDiem: 'TRA', phutLech: 420, phuPhi: 0, ghiChu: 'Bến cuối chính: VP Miền Đông (167 Quốc lộ 13)' },
      { id: pid(3, 'Nguyễn Thái Bình (VIP)'), loaiDiem: 'TRA', phutLech: 435, phuPhi: 0, ghiChu: 'Trả khách tại VP 83 Nguyễn Thái Bình, Quận 1' },
      { id: pid(3, 'Văn phòng Quận 5'), loaiDiem: 'TRA', phutLech: 450, phuPhi: 0, ghiChu: 'Trả khách tại Văn phòng Quận 5' },
      { id: hmTcSanBay.diemDonTraId, loaiDiem: 'TRA', phutLech: 465, phuPhi: 20000, ghiChu: 'Trung chuyển trả khách tại Sân Bay Tân Sơn Nhất' },
    ],
  };

  for (const [routeIdStr, rawStops] of Object.entries(routeStopDefinitions)) {
    const tuyenXeId = Number(routeIdStr);
    const route = await prisma.tuyenXe.findUnique({ where: { tuyenXeId } });
    if (!route) continue;

    // Lọc bỏ các điểm null hoặc trùng (diemDonTraId, loaiDiem)
    const seen = new Set();
    const validStops = [];
    for (const s of rawStops) {
      if (!s.id) continue;
      const key = `${s.id}_${s.loaiDiem}`;
      if (seen.has(key)) continue;
      seen.add(key);
      validStops.push(s);
    }

    validStops.sort((a, b) => a.phutLech - b.phutLech);

    await prisma.$transaction(async (tx) => {
      await tx.tuyenXeDiemDung.deleteMany({ where: { tuyenXeId } });
      for (let i = 0; i < validStops.length; i++) {
        const s = validStops[i];
        await tx.tuyenXeDiemDung.create({
          data: {
            tuyenXeId,
            diemDonTraId: s.id,
            loaiDiem: s.loaiDiem,
            phutLech: s.phutLech,
            thuTu: i + 1,
            phuPhi: s.phuPhi ?? 0,
            phutCoMatTruoc: 15,
            nhanKhach: true,
            ghiChu: s.ghiChu ?? null,
          },
        });
      }
    });

    console.log(
      `   ✓ Tuyến #${tuyenXeId} [${route.diemDi} -> ${route.diemDen}]: Đã cấu hình ${validStops.length} điểm đón/trả tuần tự.`,
    );
  }
}

/**
 * Bước 4: Đồng bộ DiemDonTraChuyenXe cho 100% chuyến xe trong DB từ TuyenXeDiemDung của tuyến tương ứng.
 */
async function syncAllTripStopsFromRoutes(prisma) {
  console.log('\n--- 4. ĐỒNG BỘ DiemDonTraChuyenXe CHO 100% CHUYẾN XE TRONG DATABASE ---');

  const routes = await prisma.tuyenXe.findMany({
    include: {
      tuyenXeDiemDungs: {
        orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      },
    },
  });
  const stopsByRouteId = new Map(routes.map((r) => [r.tuyenXeId, r.tuyenXeDiemDungs]));

  const allTrips = await prisma.chuyenXe.findMany({
    select: {
      chuyenXeId: true,
      tuyenXeId: true,
      gioKhoiHanh: true,
      _count: { select: { diemDonTraChuyenXes: true } },
    },
  });

  const tripIdsToReset = [];
  const rowsToInsert = [];
  let updatedTripsCount = 0;

  for (const trip of allTrips) {
    const routeStops = stopsByRouteId.get(trip.tuyenXeId) || [];
    if (routeStops.length === 0) continue;
    if (trip._count.diemDonTraChuyenXes === routeStops.length) continue;

    if (trip._count.diemDonTraChuyenXes > 0) {
      const hasTicketStopRef = await prisma.ve.count({
        where: {
          OR: [
            { diemDonChuyenXe: { chuyenXeId: trip.chuyenXeId } },
            { diemTraChuyenXe: { chuyenXeId: trip.chuyenXeId } },
          ],
        },
      });
      if (hasTicketStopRef > 0) continue;
      tripIdsToReset.push(trip.chuyenXeId);
    }

    updatedTripsCount++;
    for (const stop of routeStops) {
      rowsToInsert.push({
        chuyenXeId: trip.chuyenXeId,
        diemDonTraId: stop.diemDonTraId,
        loaiDiem: stop.loaiDiem,
        thoiGianDuKien: calculateClockTime(trip.gioKhoiHanh, stop.phutLech),
        phutLech: stop.phutLech,
        thuTu: stop.thuTu,
        phuPhi: stop.phuPhi,
        phutCoMatTruoc: stop.phutCoMatTruoc,
        nhanKhach: stop.nhanKhach,
        ghiChu: stop.ghiChu,
      });
    }
  }

  if (tripIdsToReset.length > 0) {
    await prisma.diemDonTraChuyenXe.deleteMany({
      where: { chuyenXeId: { in: tripIdsToReset } },
    });
  }

  const CHUNK_SIZE = 2500;
  let insertedRows = 0;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    const res = await prisma.diemDonTraChuyenXe.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    insertedRows += res.count;
  }

  console.log(
    `   ✓ Đã đồng bộ ${insertedRows} bản ghi mới (Toàn bộ ${allTrips.length}/${allTrips.length} chuyến xe đã có đầy đủ DiemDonTraChuyenXe).`,
  );
}

export async function runSyncAllRouteAndTripStops() {
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseConfig()) });
  try {
    await deduplicateCoreTables(prisma);
    await rebalanceSimultaneousVehicles(prisma);
    await configureAllRouteStopTemplates(prisma);
    await syncAllTripStopsFromRoutes(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('prisma/sync-all-route-and-trip-stops.mjs')) {
  runSyncAllRouteAndTripStops().catch((err) => {
    console.error('Lỗi khi đồng bộ lộ trình điểm dừng:', err);
    process.exit(1);
  });
}
