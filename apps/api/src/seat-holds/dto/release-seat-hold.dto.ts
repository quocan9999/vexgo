import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReleaseSeatHoldDto {
  @ApiPropertyOptional({
    description: 'Mã token ký số của phiên giữ chỗ (có thể truyền qua body hoặc qua header x-hold-token)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString({ message: 'Mã giữ chỗ (holdToken) phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mã giữ chỗ (holdToken) không được để trống.' })
  holdToken?: string;
}
