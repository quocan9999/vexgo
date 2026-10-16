import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TrangThaiPhieuGuiHang } from '../../../src/generated/prisma/client.js';
import { UpdateShipmentStatusDto } from '../../../src/shipments/dto/update-shipment-status.dto.js';

describe('UpdateShipmentStatusDto', () => {
  it('rejects DA_HUY because manual shipment cancellation is disabled', async () => {
    const dto = plainToInstance(UpdateShipmentStatusDto, {
      status: TrangThaiPhieuGuiHang.DA_HUY,
      note: 'Hủy thủ công không được phép',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('status');
    expect(errors[0]?.constraints).toHaveProperty('isIn');
  });

  it('accepts an operational status update with an optional note', async () => {
    const dto = plainToInstance(UpdateShipmentStatusDto, {
      status: TrangThaiPhieuGuiHang.DA_TIEP_NHAN,
      note: 'Đã nhận hàng tại quầy',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
