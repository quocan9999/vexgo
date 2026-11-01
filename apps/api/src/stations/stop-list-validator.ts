export interface StopListItemInput {
  diemDonTraId: number;
  loaiDiem: 'DON' | 'TRA' | 'NGHI';
  phutLech?: number;
  thuTu?: number;
  phuPhi?: number;
  phutCoMatTruoc?: number;
  nhanKhach?: boolean;
  ghiChu?: string | null;
}

export interface StationValidationInfo {
  diemDonTraId: number;
  tenDiem: string;
  loaiDiem: string;
  trangThai: string;
  nhaXeId: number;
  benTrungChuyenId?: number | null;
}

export interface StopValidationError {
  index: number;
  field?: string;
  code: string;
  message: string;
  diemDonTraId?: number;
}

/**
 * Kiểm định danh sách điểm dừng của lộ trình tuyến hoặc chuyến xe.
 * Hàm thuần (pure function) không truy vấn trực tiếp DB, dùng chung cho cả Tuyến và Chuyến.
 *
 * Quy tắc:
 * 1. Không trùng (diemDonTraId, loaiDiem).
 * 2. NGHI chỉ dùng điểm TRAM_NGHI và ngược lại (TRAM_NGHI chỉ được làm NGHI).
 * 3. TRUNG_CHUYEN chỉ làm DON/TRA và phải kèm bến đích cùng chiều trong danh sách:
 *    - Điểm hẹn DON phải có phutLech < bến đích DON.
 *    - Điểm hẹn TRA phải có phutLech > bến đích TRA.
 * 4. Điểm thuộc cùng nhà xe với tuyến/chuyến, trạng thái HOAT_DONG.
 * 5. KHÔNG kiểm tra dấu của phutLech (âm, 0, dương đều hợp lệ).
 */
export function validateStopList(
  stops: StopListItemInput[],
  stationsMap: Map<number, StationValidationInfo>,
  operatorNhaXeId: number,
): StopValidationError[] {
  const errors: StopValidationError[] = [];
  const seenPointAndRole = new Set<string>();

  // Map điểm dừng theo (diemDonTraId, loaiDiem) để tra cứu bến đích trung chuyển
  const stopMapByPointAndRole = new Map<string, { stop: StopListItemInput; index: number }>();

  // 1. Kiểm tra trùng lặp & ánh xạ map
  for (let i = 0; i < stops.length; i++) {
    const item = stops[i];
    const key = `${item.diemDonTraId}_${item.loaiDiem}`;
    if (seenPointAndRole.has(key)) {
      errors.push({
        index: i,
        field: 'diemDonTraId',
        code: 'DUPLICATE_STOP',
        message: `Điểm dừng #${item.diemDonTraId} đã xuất hiện với vai trò ${item.loaiDiem} trong danh sách.`,
        diemDonTraId: item.diemDonTraId,
      });
    } else {
      seenPointAndRole.add(key);
      stopMapByPointAndRole.set(key, { stop: item, index: i });
    }
  }

  // 2. Kiểm tra tính hợp lệ của từng điểm
  for (let i = 0; i < stops.length; i++) {
    const item = stops[i];
    const station = stationsMap.get(item.diemDonTraId);

    if (!station) {
      errors.push({
        index: i,
        field: 'diemDonTraId',
        code: 'STATION_NOT_FOUND',
        message: `Không tìm thấy điểm đón/trả #${item.diemDonTraId}.`,
        diemDonTraId: item.diemDonTraId,
      });
      continue;
    }

    // Active status check
    if (station.trangThai !== 'HOAT_DONG') {
      errors.push({
        index: i,
        field: 'diemDonTraId',
        code: 'STATION_INACTIVE',
        message: `Điểm đón/trả #${item.diemDonTraId} (${station.tenDiem}) đang ngưng hoạt động hoặc không khả dụng.`,
        diemDonTraId: item.diemDonTraId,
      });
    }

    // Tenant check
    if (station.nhaXeId !== operatorNhaXeId) {
      errors.push({
        index: i,
        field: 'diemDonTraId',
        code: 'STATION_TENANT_MISMATCH',
        message: `Điểm đón/trả #${item.diemDonTraId} (${station.tenDiem}) không thuộc nhà xe của chuyến xe này.`,
        diemDonTraId: item.diemDonTraId,
      });
    }

    // Trạm nghỉ rule: NGHI chỉ dùng cho TRAM_NGHI và ngược lại
    if (item.loaiDiem === 'NGHI' && station.loaiDiem !== 'TRAM_NGHI') {
      errors.push({
        index: i,
        field: 'loaiDiem',
        code: 'INVALID_REST_STOP_TYPE',
        message: `Vai trò NGHI chỉ được áp dụng cho điểm thuộc loại Trạm nghỉ (TRAM_NGHI). Điểm '${station.tenDiem}' đang là ${station.loaiDiem}.`,
        diemDonTraId: item.diemDonTraId,
      });
    }

    if (station.loaiDiem === 'TRAM_NGHI' && item.loaiDiem !== 'NGHI') {
      errors.push({
        index: i,
        field: 'loaiDiem',
        code: 'REST_STOP_CANNOT_BE_PICKUP_DROPOFF',
        message: `Điểm '${station.tenDiem}' là Trạm nghỉ (TRAM_NGHI), chỉ được dùng làm trạm dừng NGHI, không được đón hoặc trả khách.`,
        diemDonTraId: item.diemDonTraId,
      });
    }

    // Trung chuyển rule
    if (station.loaiDiem === 'TRUNG_CHUYEN') {
      if (item.loaiDiem === 'NGHI') {
        errors.push({
          index: i,
          field: 'loaiDiem',
          code: 'TRANSFER_CANNOT_BE_REST_STOP',
          message: `Điểm trung chuyển '${station.tenDiem}' không thể làm trạm nghỉ (NGHI).`,
          diemDonTraId: item.diemDonTraId,
        });
      } else {
        const destId = station.benTrungChuyenId;
        if (!destId) {
          errors.push({
            index: i,
            field: 'diemDonTraId',
            code: 'TRANSFER_DESTINATION_NOT_CONFIGURED',
            message: `Điểm trung chuyển '${station.tenDiem}' chưa được cấu hình bến kết nối đích trong danh mục.`,
            diemDonTraId: item.diemDonTraId,
          });
        } else {
          // Bến đích phải có mặt trong cùng danh sách với cùng vai trò loaiDiem
          const targetKey = `${destId}_${item.loaiDiem}`;
          const targetEntry = stopMapByPointAndRole.get(targetKey);

          if (!targetEntry) {
            errors.push({
              index: i,
              field: 'diemDonTraId',
              code: 'TRANSFER_DESTINATION_MISSING',
              message: `Điểm trung chuyển '${station.tenDiem}' (${item.loaiDiem}) bắt buộc phải có bến đích #${destId} cùng chiều ${item.loaiDiem} trong lộ trình.`,
              diemDonTraId: item.diemDonTraId,
            });
          } else {
            const targetStop = targetEntry.stop;
            const itemPhutLech = item.phutLech ?? 0;
            const targetPhutLech = targetStop.phutLech ?? 0;
            if (item.loaiDiem === 'DON') {
              if (itemPhutLech >= targetPhutLech) {
                errors.push({
                  index: i,
                  field: 'phutLech',
                  code: 'TRANSFER_PICKUP_TIME_INVALID',
                  message: `Điểm hẹn trung chuyển đón '${station.tenDiem}' (phút ${itemPhutLech}) phải có phút lệch nhỏ hơn bến đích (phút ${targetPhutLech}).`,
                  diemDonTraId: item.diemDonTraId,
                });
              }
            } else if (item.loaiDiem === 'TRA') {
              if (itemPhutLech <= targetPhutLech) {
                errors.push({
                  index: i,
                  field: 'phutLech',
                  code: 'TRANSFER_DROPOFF_TIME_INVALID',
                  message: `Điểm hẹn trung chuyển trả '${station.tenDiem}' (phút ${itemPhutLech}) phải có phút lệch lớn hơn bến đích (phút ${targetPhutLech}).`,
                  diemDonTraId: item.diemDonTraId,
                });
              }
            }
          }
        }
      }
    }
  }

  return errors;
}
