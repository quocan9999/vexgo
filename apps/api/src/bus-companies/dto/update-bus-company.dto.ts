import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateBusCompanyDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const contactInfo = value.trim();
    return contactInfo || null;
  })
  @IsOptional()
  @IsString()
  contactInfo?: string | null;
}
