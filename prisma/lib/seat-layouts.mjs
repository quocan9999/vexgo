/**
 * Định nghĩa chuẩn sơ đồ ghế thực tế của các nhà xe (FUTA, Thành Bưởi, Hoa Mai):
 *
 * 1. FUTA Limousine ghế ngả 28 chỗ (Hình 1):
 *    - 1 tầng (tang = 1)
 *    - 28 ghế: '01' -> '28'
 *    - 8 hàng đầu x 3 ghế (2 ghế dãy trái x=180, 400; lối đi ở giữa; 1 ghế dãy phải x=820)
 *    - Hàng 9 cuối x 4 ghế (x=160, 380, 620, 840)
 *
 * 2. Thành Bưởi Giường Nằm 34 phòng (Hình 2):
 *    - 2 tầng (tang = 1: 1A-17A, tang = 2: 1B-17B)
 *    - Bố trí 3 dãy (trái x=180, giữa x=500, phải x=820)
 *    - Hàng 1-4: 3 phòng/hàng
 *    - Hàng 5: khuyết vị trí giữa (chỉ có dãy trái 13A/B và dãy phải 14A/B)
 *    - Hàng 6: 3 phòng/hàng (15A/B, 16A/B, 17A/B)
 *
 * 3. FUTA Giường Nằm 34 chỗ:
 *    - 2 tầng (tang = 1: A01-A17, tang = 2: B01-B17)
 *    - Cấu trúc tọa độ tương tự Thành Bưởi 34 phòng.
 *
 * 4. Cabin VIP 22 phòng (Cung điện di động Thành Bưởi / FUTA):
 *    - 2 tầng (tang = 1: 1A-11A, tang = 2: 1B-11B)
 *    - 2 dãy cabin đôi/đơn (trái x=220, phải x=780)
 *
 * 5. Hoa Mai Limousine VIP 16 chỗ (Ford Transit / Solati):
 *    - 1 tầng, 16 ghế (01 -> 16)
 *
 * 6. Hoa Mai Limousine VIP 9 chỗ (Dcar President):
 *    - 1 tầng, 9 ghế (01 -> 09)
 *
 * 7. Xe Ghế Ngồi 45 chỗ Universe:
 *    - 1 tầng, 45 ghế (A01 -> A45)
 */

export function getFutaLimousine28Seats() {
  const seats = [];
  // 8 hàng đầu: 3 ghế/hàng (2 ghế dãy trái, lối đi ở giữa, 1 ghế dãy phải)
  for (let row = 0; row < 8; row++) {
    const y = 1000 + row * 1000;
    const s1 = String(row * 3 + 1).padStart(2, '0');
    const s2 = String(row * 3 + 2).padStart(2, '0');
    const s3 = String(row * 3 + 3).padStart(2, '0');

    seats.push({ tenGhe: s1, viTri: 'Dãy trái', tang: 1, toaDoX: 180, toaDoY: y });
    seats.push({ tenGhe: s2, viTri: 'Dãy trái', tang: 1, toaDoX: 400, toaDoY: y });
    seats.push({ tenGhe: s3, viTri: 'Dãy phải', tang: 1, toaDoX: 820, toaDoY: y });
  }

  // Hàng cuối 4 ghế liền nhau
  const yBack = 9000;
  seats.push({ tenGhe: '25', viTri: 'Băng cuối', tang: 1, toaDoX: 160, toaDoY: yBack });
  seats.push({ tenGhe: '26', viTri: 'Băng cuối', tang: 1, toaDoX: 380, toaDoY: yBack });
  seats.push({ tenGhe: '27', viTri: 'Băng cuối', tang: 1, toaDoX: 620, toaDoY: yBack });
  seats.push({ tenGhe: '28', viTri: 'Băng cuối', tang: 1, toaDoX: 840, toaDoY: yBack });

  return seats;
}

export function getThanhBuoiGiuongNam34Seats() {
  const seats = [];
  const floors = [
    { tang: 1, suffix: 'A' },
    { tang: 2, suffix: 'B' },
  ];

  for (const { tang, suffix } of floors) {
    // Row 1: 1, 2, 3
    seats.push({ tenGhe: `1${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 1000 });
    seats.push({ tenGhe: `2${suffix}`, viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 1000 });
    seats.push({ tenGhe: `3${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 1000 });

    // Row 2: 4, 5, 6
    seats.push({ tenGhe: `4${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 2000 });
    seats.push({ tenGhe: `5${suffix}`, viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 2000 });
    seats.push({ tenGhe: `6${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 2000 });

    // Row 3: 7, 8, 9
    seats.push({ tenGhe: `7${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 3000 });
    seats.push({ tenGhe: `8${suffix}`, viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 3000 });
    seats.push({ tenGhe: `9${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 3000 });

    // Row 4: 10, 11, 12
    seats.push({ tenGhe: `10${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 4000 });
    seats.push({ tenGhe: `11${suffix}`, viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 4000 });
    seats.push({ tenGhe: `12${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 4000 });

    // Row 5: 13, [trống ở giữa], 14
    seats.push({ tenGhe: `13${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 5000 });
    seats.push({ tenGhe: `14${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 5000 });

    // Row 6: 15, 16, 17
    seats.push({ tenGhe: `15${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 6000 });
    seats.push({ tenGhe: `16${suffix}`, viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 6000 });
    seats.push({ tenGhe: `17${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 6000 });
  }

  return seats;
}

export function getFutaGiuongNam34Seats() {
  const seats = [];
  const floors = [
    { tang: 1, prefix: 'A' },
    { tang: 2, prefix: 'B' },
  ];

  for (const { tang, prefix } of floors) {
    const pad = (n) => `${prefix}${String(n).padStart(2, '0')}`;

    seats.push({ tenGhe: pad(1), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 1000 });
    seats.push({ tenGhe: pad(2), viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 1000 });
    seats.push({ tenGhe: pad(3), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 1000 });

    seats.push({ tenGhe: pad(4), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 2000 });
    seats.push({ tenGhe: pad(5), viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 2000 });
    seats.push({ tenGhe: pad(6), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 2000 });

    seats.push({ tenGhe: pad(7), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 3000 });
    seats.push({ tenGhe: pad(8), viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 3000 });
    seats.push({ tenGhe: pad(9), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 3000 });

    seats.push({ tenGhe: pad(10), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 4000 });
    seats.push({ tenGhe: pad(11), viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 4000 });
    seats.push({ tenGhe: pad(12), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 4000 });

    seats.push({ tenGhe: pad(13), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 5000 });
    seats.push({ tenGhe: pad(14), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 5000 });

    seats.push({ tenGhe: pad(15), viTri: 'Dãy trái', tang, toaDoX: 180, toaDoY: 6000 });
    seats.push({ tenGhe: pad(16), viTri: 'Dãy giữa', tang, toaDoX: 500, toaDoY: 6000 });
    seats.push({ tenGhe: pad(17), viTri: 'Dãy phải', tang, toaDoX: 820, toaDoY: 6000 });
  }

  return seats;
}

export function getCabinVip22Seats() {
  const seats = [];
  const floors = [
    { tang: 1, suffix: 'A' },
    { tang: 2, suffix: 'B' },
  ];

  for (const { tang, suffix } of floors) {
    seats.push({ tenGhe: `1${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 220, toaDoY: 1000 });
    seats.push({ tenGhe: `2${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 780, toaDoY: 1000 });

    seats.push({ tenGhe: `3${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 220, toaDoY: 2000 });
    seats.push({ tenGhe: `4${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 780, toaDoY: 2000 });

    seats.push({ tenGhe: `5${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 220, toaDoY: 3000 });
    seats.push({ tenGhe: `6${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 780, toaDoY: 3000 });

    seats.push({ tenGhe: `7${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 220, toaDoY: 4000 });
    seats.push({ tenGhe: `8${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 780, toaDoY: 4000 });

    seats.push({ tenGhe: `9${suffix}`, viTri: 'Dãy trái', tang, toaDoX: 220, toaDoY: 5000 });
    seats.push({ tenGhe: `10${suffix}`, viTri: 'Dãy phải', tang, toaDoX: 780, toaDoY: 5000 });

    seats.push({ tenGhe: `11${suffix}`, viTri: 'Phòng VIP cuối xe', tang, toaDoX: 500, toaDoY: 6000 });
  }

  return seats;
}

export function getHoaMaiLimousine16Seats() {
  const seats = [];
  // Hàng 1 (phụ lái)
  seats.push({ tenGhe: '01', viTri: 'Ghế phụ lái', tang: 1, toaDoX: 500, toaDoY: 1000 });
  seats.push({ tenGhe: '02', viTri: 'Ghế phụ lái', tang: 1, toaDoX: 820, toaDoY: 1000 });

  // Hàng 2
  seats.push({ tenGhe: '03', viTri: 'Dãy trái', tang: 1, toaDoX: 200, toaDoY: 2500 });
  seats.push({ tenGhe: '04', viTri: 'Dãy giữa', tang: 1, toaDoX: 500, toaDoY: 2500 });
  seats.push({ tenGhe: '05', viTri: 'Dãy phải', tang: 1, toaDoX: 820, toaDoY: 2500 });

  // Hàng 3
  seats.push({ tenGhe: '06', viTri: 'Dãy trái', tang: 1, toaDoX: 200, toaDoY: 4000 });
  seats.push({ tenGhe: '07', viTri: 'Dãy giữa', tang: 1, toaDoX: 500, toaDoY: 4000 });
  seats.push({ tenGhe: '08', viTri: 'Dãy phải', tang: 1, toaDoX: 820, toaDoY: 4000 });

  // Hàng 4
  seats.push({ tenGhe: '09', viTri: 'Dãy trái', tang: 1, toaDoX: 200, toaDoY: 5500 });
  seats.push({ tenGhe: '10', viTri: 'Dãy giữa', tang: 1, toaDoX: 500, toaDoY: 5500 });
  seats.push({ tenGhe: '11', viTri: 'Dãy phải', tang: 1, toaDoX: 820, toaDoY: 5500 });

  // Hàng 5 (băng cuối 5 ghế)
  seats.push({ tenGhe: '12', viTri: 'Băng cuối', tang: 1, toaDoX: 160, toaDoY: 7000 });
  seats.push({ tenGhe: '13', viTri: 'Băng cuối', tang: 1, toaDoX: 330, toaDoY: 7000 });
  seats.push({ tenGhe: '14', viTri: 'Băng cuối', tang: 1, toaDoX: 500, toaDoY: 7000 });
  seats.push({ tenGhe: '15', viTri: 'Băng cuối', tang: 1, toaDoX: 670, toaDoY: 7000 });
  seats.push({ tenGhe: '16', viTri: 'Băng cuối', tang: 1, toaDoX: 840, toaDoY: 7000 });

  return seats;
}

export function getHoaMaiLimousine9Seats() {
  const seats = [];
  seats.push({ tenGhe: '01', viTri: 'Ghế phụ lái', tang: 1, toaDoX: 450, toaDoY: 1000 });
  seats.push({ tenGhe: '02', viTri: 'Ghế phụ lái', tang: 1, toaDoX: 800, toaDoY: 1000 });

  seats.push({ tenGhe: '03', viTri: 'VIP thương gia', tang: 1, toaDoX: 250, toaDoY: 2500 });
  seats.push({ tenGhe: '04', viTri: 'VIP thương gia', tang: 1, toaDoX: 750, toaDoY: 2500 });

  seats.push({ tenGhe: '05', viTri: 'VIP thương gia', tang: 1, toaDoX: 250, toaDoY: 4000 });
  seats.push({ tenGhe: '06', viTri: 'VIP thương gia', tang: 1, toaDoX: 750, toaDoY: 4000 });

  seats.push({ tenGhe: '07', viTri: 'Băng cuối', tang: 1, toaDoX: 200, toaDoY: 5500 });
  seats.push({ tenGhe: '08', viTri: 'Băng cuối', tang: 1, toaDoX: 500, toaDoY: 5500 });
  seats.push({ tenGhe: '09', viTri: 'Băng cuối', tang: 1, toaDoX: 800, toaDoY: 5500 });

  return seats;
}

export function getGheNgoi45Seats() {
  const seats = [];
  let seatNum = 1;
  for (let row = 0; row < 10; row++) {
    const y = 1000 + row * 1000;
    const p = (n) => `A${String(n).padStart(2, '0')}`;
    seats.push({ tenGhe: p(seatNum++), viTri: 'Dãy trái', tang: 1, toaDoX: 180, toaDoY: y });
    seats.push({ tenGhe: p(seatNum++), viTri: 'Dãy trái', tang: 1, toaDoX: 360, toaDoY: y });
    seats.push({ tenGhe: p(seatNum++), viTri: 'Dãy phải', tang: 1, toaDoX: 640, toaDoY: y });
    seats.push({ tenGhe: p(seatNum++), viTri: 'Dãy phải', tang: 1, toaDoX: 820, toaDoY: y });
  }

  const yBack = 11000;
  const p = (n) => `A${String(n).padStart(2, '0')}`;
  seats.push({ tenGhe: p(41), viTri: 'Băng cuối', tang: 1, toaDoX: 160, toaDoY: yBack });
  seats.push({ tenGhe: p(42), viTri: 'Băng cuối', tang: 1, toaDoX: 330, toaDoY: yBack });
  seats.push({ tenGhe: p(43), viTri: 'Băng cuối', tang: 1, toaDoX: 500, toaDoY: yBack });
  seats.push({ tenGhe: p(44), viTri: 'Băng cuối', tang: 1, toaDoX: 670, toaDoY: yBack });
  seats.push({ tenGhe: p(45), viTri: 'Băng cuối', tang: 1, toaDoX: 840, toaDoY: yBack });

  return seats;
}

export function getVehicleSeatLayout(operatorCode, typeName, seatCount) {
  if (operatorCode === 'FUTA') {
    if (typeName === 'LIMOUSINE') return getFutaLimousine28Seats(); // Hình 1
    if (typeName === 'GIƯỜNG NẰM') {
      if (seatCount === 22) return getCabinVip22Seats();
      return getFutaGiuongNam34Seats(); // 34 chỗ
    }
    if (typeName === 'GHẾ NGỒI') {
      if (seatCount === 45) return getGheNgoi45Seats();
      return getFutaLimousine28Seats();
    }
  }

  if (operatorCode === 'TB') {
    if (typeName === 'GIƯỜNG NẰM') {
      if (seatCount === 22) return getCabinVip22Seats();
      return getThanhBuoiGiuongNam34Seats(); // Hình 2
    }
    if (typeName === 'LIMOUSINE') {
      if (seatCount === 22) return getCabinVip22Seats();
      return getThanhBuoiGiuongNam34Seats();
    }
    if (typeName === 'GHẾ NGỒI') {
      if (seatCount === 45) return getGheNgoi45Seats();
      return getFutaLimousine28Seats();
    }
  }

  if (operatorCode === 'HM') {
    if (typeName === 'LIMOUSINE') {
      if (seatCount === 9) return getHoaMaiLimousine9Seats();
      return getHoaMaiLimousine16Seats();
    }
    if (typeName === 'GHẾ NGỒI') {
      return getFutaLimousine28Seats();
    }
    if (typeName === 'GIƯỜNG NẰM') {
      return getThanhBuoiGiuongNam34Seats();
    }
  }

  // Fallback chung
  if (typeName === 'GIƯỜNG NẰM') return getThanhBuoiGiuongNam34Seats();
  if (typeName === 'LIMOUSINE') return getFutaLimousine28Seats();
  return getGheNgoi45Seats();
}
