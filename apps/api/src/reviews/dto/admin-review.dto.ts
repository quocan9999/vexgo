import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminReviewQueryDto {
  @ApiPropertyOptional({ description: 'Trang hiện tại (bắt đầu từ 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số bản ghi trên một trang (1-100)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (tên khách hàng, SĐT, nội dung)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc theo số sao đánh giá (1-5)', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái kiểm duyệt (HIEN_THI, DA_AN)', example: 'HIEN_THI' })
  @IsOptional()
  @IsString()
  @IsIn(['HIEN_THI', 'DA_AN'])
  status?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhà xe (dành cho Super Admin)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  busCompanyId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo tuyến xe (tuyenXeId)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo việc có nhận xét viết kèm hay không',
    enum: ['ALL', 'WITH_COMMENT', 'WITHOUT_COMMENT'],
    example: 'WITH_COMMENT',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'WITH_COMMENT', 'WITHOUT_COMMENT'])
  hasComment?: 'ALL' | 'WITH_COMMENT' | 'WITHOUT_COMMENT';

  @ApiPropertyOptional({
    description: 'Lọc theo khoảng thời gian gửi đánh giá',
    enum: ['ALL', '7_DAYS', '30_DAYS', 'THIS_MONTH'],
    example: '7_DAYS',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ALL', '7_DAYS', '30_DAYS', 'THIS_MONTH'])
  timeRange?: 'ALL' | '7_DAYS' | '30_DAYS' | 'THIS_MONTH';

  @ApiPropertyOptional({ description: 'Sắp xếp theo trường', example: 'thoiGian' })
  @IsOptional()
  @IsString()
  @IsIn(['thoiGian', 'mucDanhGia', 'createdAt'])
  sortBy?: string = 'thoiGian';

  @ApiPropertyOptional({ description: 'Hướng sắp xếp', example: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc' = 'desc';
}

export class AdminUpdateReviewStatusDto {
  @ApiPropertyOptional({ description: 'Trạng thái hiển thị mới', example: 'DA_AN' })
  @IsString()
  @IsIn(['HIEN_THI', 'DA_AN'])
  status!: string;
}

export class AdminReplyReviewDto {
  @ApiPropertyOptional({
    description: 'Nội dung phản hồi từ nhà xe (để trống hoặc rỗng nếu muốn xóa phản hồi)',
    example: 'Cảm ơn quý khách đã tin tưởng và góp ý. Nhà xe sẽ ghi nhận và cải thiện chất lượng phục vụ.',
  })
  @IsString({ message: 'Nội dung phản hồi phải là chuỗi ký tự.' })
  @IsOptional()
  @MaxLength(1000, { message: 'Nội dung phản hồi không được vượt quá 1000 ký tự.' })
  reply?: string;
}
