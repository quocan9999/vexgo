import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateKnowledgeDocumentDto {
  @ApiPropertyOptional({
    description: 'Mã định danh duy nhất của tài liệu (tự sinh nếu để trống)',
    example: 'DOC-PET-POLICY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentCode?: string;

  @ApiProperty({
    description: 'Tiêu đề quy chế hoặc câu hỏi thường gặp',
    example: 'Quy định vận chuyển thú cưng trên xe giường nằm',
  })
  @IsNotEmpty({ message: 'Tiêu đề không được để trống.' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Danh mục quy chuẩn',
    example: 'VAN_CHUYEN_HANG_HOA',
  })
  @IsNotEmpty({ message: 'Danh mục không được để trống.' })
  @IsString()
  @MaxLength(50)
  category!: string;

  @ApiPropertyOptional({
    description: 'Phạm vi áp dụng (GLOBAL hoặc TENANT)',
    enum: ['GLOBAL', 'TENANT'],
    default: 'GLOBAL',
  })
  @IsOptional()
  @IsIn(['GLOBAL', 'TENANT'])
  scope?: 'GLOBAL' | 'TENANT';

  @ApiPropertyOptional({
    description: 'ID nhà xe sở hữu quy chế (bắt buộc nếu scope là TENANT)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nhaXeId?: number;

  @ApiProperty({
    description: 'Đường dẫn phân cấp cấu trúc tài liệu',
    example: '[Quy chế Nhà xe Phương Trang] > [Chương IV: Vận chuyển đặc biệt]',
  })
  @IsNotEmpty({ message: 'Đường dẫn phân cấp không được để trống.' })
  @IsString()
  @MaxLength(500)
  hierarchyPath!: string;

  @ApiProperty({
    description: 'Nội dung chi tiết của quy chế (định dạng Markdown)',
    example: '1. Quy định chung: Thú cưng phải được nhốt trong lồng chuyên dụng và để dưới hầm hàng...',
  })
  @IsNotEmpty({ message: 'Nội dung quy chế không được để trống.' })
  @IsString()
  rawContent!: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
