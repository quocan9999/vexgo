import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class CreateSeatHoldDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một ghế để giữ chỗ.' })
  @IsString({ each: true })
  seatNumbers!: string[];
}
