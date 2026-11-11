import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

export class AdminAccountIdParamsDto {
  @ApiProperty({ description: 'ID định danh tài khoản quản trị viên', example: 1 })
  @Transform(({ value }) => strictInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  id!: number;
}
