import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TrangThaiPhieuGuiHang } from '../../../src/generated/prisma/client.js';
import { UpdateShipmentStatusDto } from '../../../src/shipments/dto/update-shipment-status.dto.js';

describe('UpdateShipmentStatusDto', () => {
  it('accepts DA_HUY with a cancellation note', async () => {
    const dto = plainToInstance(UpdateShipmentStatusDto, {
      status: TrangThaiPhieuGuiHang.DA_HUY,
      note: 'Từ chối tiếp nhận vì hàng cấm gửi',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts an operational status update with an optional note', async () => {
    const dto = plainToInstance(UpdateShipmentStatusDto, {
      status: TrangThaiPhieuGuiHang.DA_TIEP_NHAN,
      note: 'Đã nhận hàng tại quầy',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
