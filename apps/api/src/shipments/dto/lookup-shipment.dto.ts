import { IsNotEmpty, IsString } from 'class-validator';

export class LookupShipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã vận đơn không được để trống.' })
  waybillCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống.' })
  phoneNumber!: string;
}
