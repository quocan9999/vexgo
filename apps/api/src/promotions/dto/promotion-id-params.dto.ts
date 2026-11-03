import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PromotionIdParamsDto {
  @ApiProperty({
    description: 'ID chương trình khuyến mãi',
    example: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;
}
