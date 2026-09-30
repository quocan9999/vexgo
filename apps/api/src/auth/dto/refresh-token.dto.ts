import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsOptional()
  @IsString({ message: 'Refresh token phải là chuỗi.' })
  @MaxLength(128, { message: 'Refresh token quá dài.' })
  refreshToken?: string;
}
