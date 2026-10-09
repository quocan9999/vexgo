import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrangThaiPhieuGuiHang } from '../../generated/prisma/client.js';

export class UpdateShipmentStatusDto {
  @IsEnum(TrangThaiPhieuGuiHang, {
    message: 'Trạng thái phiếu gửi hàng không hợp lệ.',
  })
  status!: TrangThaiPhieuGuiHang;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự.' })
  @MaxLength(500, { message: 'Ghi chú không được vượt quá 500 ký tự.' })
  note?: string;
}
