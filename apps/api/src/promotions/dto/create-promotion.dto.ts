import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { IsPromotionDateOnly } from './promotion-validators.js';

const DECIMAL_AMOUNT_PATTERN = /^\d{1,16}(?:\.\d{1,2})?$/;

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Tên chương trình khuyến mãi',
    example: 'Khuyến mãi mừng đại lễ 30/4',
    maxLength: 150,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 150)
  name!: string;

  @ApiProperty({
    description: 'Mã khuyến mãi (chỉ gồm chữ hoa, số, dấu gạch ngang và gạch dưới, từ 3 đến 50 ký tự)',
    example: 'VEXGO304',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{2,49}$/)
  code!: string;

  @ApiProperty({
    description: 'Loại giảm giá: theo phần trăm (PHAN_TRAM) hoặc số tiền cố định (SO_TIEN)',
    enum: ['PHAN_TRAM', 'SO_TIEN'],
    example: 'PHAN_TRAM',
  })
  @IsIn(['PHAN_TRAM', 'SO_TIEN'])
  discountType!: 'PHAN_TRAM' | 'SO_TIEN';

  @ApiProperty({
    description: 'Giá trị giảm giá (số tiền hoặc phần trăm, dạng chuỗi số thực thập phân)',
    example: '15.00',
  })
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  discountValue!: string;

  @ApiPropertyOptional({
    description: 'Số tiền giảm tối đa (bắt buộc khi loại giảm giá là PHAN_TRAM)',
    example: '50000.00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  maxDiscount?: string | null;

  @ApiPropertyOptional({
    description: 'Giá trị đơn vé tối thiểu để được áp dụng khuyến mãi',
    example: '200000.00',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_AMOUNT_PATTERN)
  minimumTicketAmount?: string | null;

  @ApiProperty({
    description: 'Ngày bắt đầu áp dụng khuyến mãi (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '01-05-2026',
  })
  @IsString()
  @IsPromotionDateOnly()
  startsOn!: string;

  @ApiProperty({
    description: 'Ngày kết thúc áp dụng khuyến mãi (định dạng DD-MM-YYYY hoặc YYYY-MM-DD)',
    example: '31-05-2026',
  })
  @IsString()
  @IsPromotionDateOnly()
  endsOn!: string;

  @ApiProperty({
    description: 'Tổng số lượt sử dụng tối đa của mã khuyến mãi',
    example: 100,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit!: number;
}
