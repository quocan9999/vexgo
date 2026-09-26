import { Transform } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateRouteDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  origin!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  destination!: string;
}
