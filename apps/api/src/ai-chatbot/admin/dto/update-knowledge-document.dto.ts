import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateKnowledgeDocumentDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề quy chế hoặc câu hỏi thường gặp',
    example: 'Quy định đổi trả vé cập nhật 2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Danh mục quy chuẩn',
    example: 'CHINH_SACH_HOAN_HUY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    description: 'Phạm vi áp dụng (GLOBAL hoặc TENANT)',
    enum: ['GLOBAL', 'TENANT'],
  })
  @IsOptional()
  @IsIn(['GLOBAL', 'TENANT'])
  scope?: 'GLOBAL' | 'TENANT';

  @ApiPropertyOptional({
    description: 'ID nhà xe sở hữu quy chế',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  nhaXeId?: number;

  @ApiPropertyOptional({
    description: 'Đường dẫn phân cấp cấu trúc tài liệu',
    example: '[Quy chế VexGo] > [Chương II: Đổi trả vé]',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hierarchyPath?: string;

  @ApiPropertyOptional({
    description: 'Nội dung chi tiết của quy chế (Markdown)',
  })
  @IsOptional()
  @IsString()
  rawContent?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái hoạt động',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
