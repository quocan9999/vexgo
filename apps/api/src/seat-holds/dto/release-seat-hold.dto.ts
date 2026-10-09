import { IsNotEmpty, IsString } from 'class-validator';

export class ReleaseSeatHoldDto {
  @IsString({ message: 'Mã giữ chỗ (holdToken) phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mã giữ chỗ (holdToken) không được để trống.' })
  holdToken!: string;
}
