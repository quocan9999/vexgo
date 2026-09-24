import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class BusCompanyIdParamsDto {
  @Type(() => Number)
  @IsInt({ message: 'ID nhà xe phải là số nguyên.' })
  @Min(1, { message: 'ID nhà xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID nhà xe vượt giới hạn.' })
  id!: number;
}
