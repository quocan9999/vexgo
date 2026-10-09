import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty({ message: 'tripId không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'tripId phải là số nguyên.' })
  @Min(1, { message: 'tripId phải lớn hơn 0.' })
  tripId: number;

  @IsNotEmpty({ message: 'Đánh giá rating không được để trống.' })
  @Type(() => Number)
  @IsInt({ message: 'Mức đánh giá phải là số nguyên từ 1 đến 5 sao.' })
  @Min(1, { message: 'Mức đánh giá tối thiểu là 1 sao.' })
  @Max(5, { message: 'Mức đánh giá tối đa là 5 sao.' })
  rating: number;

  @IsOptional()
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi.' })
  @MaxLength(1000, { message: 'Nội dung nhận xét không được vượt quá 1000 ký tự.' })
  comment?: string;
}
