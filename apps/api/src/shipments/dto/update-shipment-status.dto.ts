import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrangThaiPhieuGuiHang } from '../../generated/prisma/client.js';

const MANUALLY_UPDATABLE_SHIPMENT_STATUSES = [
  TrangThaiPhieuGuiHang.MOI_TAO,
  TrangThaiPhieuGuiHang.DA_TIEP_NHAN,
  TrangThaiPhieuGuiHang.DANG_VAN_CHUYEN,
  TrangThaiPhieuGuiHang.DA_GIAO,
] as const;

type ManuallyUpdatableShipmentStatus =
  (typeof MANUALLY_UPDATABLE_SHIPMENT_STATUSES)[number];

export class UpdateShipmentStatusDto {
  @ApiProperty({
    description: 'Trạng thái vận chuyển mới của bưu kiện',
    enum: MANUALLY_UPDATABLE_SHIPMENT_STATUSES,
    example: 'DA_TIEP_NHAN',
  })
  @IsIn(MANUALLY_UPDATABLE_SHIPMENT_STATUSES, {
    message: 'Trạng thái phiếu gửi hàng không hợp lệ.',
  })
  status!: ManuallyUpdatableShipmentStatus;

  @ApiPropertyOptional({
    description: 'Ghi chú cập nhật trạng thái',
    example: 'Hàng đã được bốc lên xe thành công.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự.' })
  note?: string;
}
