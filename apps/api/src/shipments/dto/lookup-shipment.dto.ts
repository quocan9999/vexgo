import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LookupShipmentDto {
  @ApiProperty({
    description: 'Mã vận đơn bưu kiện cần tra cứu',
    example: 'WB12345678',
  })
  @IsString()
  @IsNotEmpty({ message: 'Mã vận đơn không được để trống.' })
  waybillCode!: string;

  @ApiProperty({
    description: 'Số điện thoại của người gửi hoặc người nhận để xác minh',
    example: '0901234567',
  })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  phoneNumber!: string;
}
