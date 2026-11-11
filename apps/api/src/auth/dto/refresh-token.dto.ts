import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token chuỗi dài được cấp từ phiên đăng nhập (bỏ trống nếu dùng Cookie transport)',
    example: 'd9b139e8a846c4f061d763bc75344d9f65d1d6a...',
  })
  @IsOptional()
  @IsString({ message: 'Refresh token phải là chuỗi.' })
  @MaxLength(128, { message: 'Refresh token quá dài.' })
  refreshToken?: string;
}
