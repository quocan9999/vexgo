import { Transform } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class MediaVehicleParamsDto {
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleId!: number;
}

export class MediaItemParamsDto extends MediaVehicleParamsDto {
  @IsUUID('4')
  mediaId!: string;
}

export class UploadVehicleImageDto {
  @IsUUID('4', {
    message: 'requestId phải là UUID v4; giữ nguyên khi thử lại cùng ảnh.',
  })
  requestId!: string;
}
