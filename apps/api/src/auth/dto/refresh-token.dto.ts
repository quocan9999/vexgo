import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString({ message: 'refreshToken must be a string' })
  @IsNotEmpty({ message: 'refreshToken should not be empty' })
  @MaxLength(512, { message: 'refreshToken is too long' })
  refreshToken!: string;
}
