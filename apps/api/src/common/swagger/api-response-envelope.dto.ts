import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Trang hiện tại (bắt đầu từ 1)', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Số lượng mục trên mỗi trang', example: 10 })
  pageSize!: number;

  @ApiProperty({ description: 'Tổng số mục tìm thấy', example: 45 })
  totalItems!: number;

  @ApiProperty({ description: 'Tổng số trang', example: 5 })
  totalPages!: number;
}

export class ValidationErrorDetailDto {
  @ApiProperty({ description: 'Tên trường bị lỗi', example: 'phoneNumber' })
  field!: string;

  @ApiProperty({ description: 'Chi tiết thông báo lỗi', example: 'Số điện thoại không hợp lệ.' })
  message!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ description: 'Mã trạng thái HTTP', example: 400 })
  statusCode!: number;

  @ApiProperty({ description: 'Mã lỗi nghiệp vụ chuẩn', example: 'BAD_REQUEST' })
  error!: string;

  @ApiProperty({ description: 'Thông báo lỗi chi tiết dễ hiểu bằng tiếng Việt', example: 'Yêu cầu không hợp lệ.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Danh sách chi tiết các trường bị lỗi validation (nếu có)',
    type: [ValidationErrorDetailDto],
  })
  details?: ValidationErrorDetailDto[];
}
