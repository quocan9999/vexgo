import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateAiSettingsDto {
  @ApiPropertyOptional({
    description: 'Thời gian lưu vết yêu cầu chống gửi trùng (ngày)',
    example: 7,
    minimum: 1,
    maximum: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'idempotencyTtlDays phải là số nguyên.' })
  @Min(1, { message: 'Thời gian lưu vết tối thiểu 1 ngày.' })
  @Max(90, { message: 'Thời gian lưu vết tối đa 90 ngày.' })
  idempotencyTtlDays?: number;

  @ApiPropertyOptional({
    description: 'Thời hạn khóa xử lý yêu cầu (giây) để xử lý crash window',
    example: 60,
    minimum: 10,
    maximum: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'leaseDurationSeconds phải là số nguyên.' })
  @Min(10, { message: 'Thời hạn khóa tối thiểu 10 giây.' })
  @Max(300, { message: 'Thời hạn khóa tối đa 300 giây.' })
  leaseDurationSeconds?: number;

  @ApiPropertyOptional({
    description: 'Giới hạn số tin nhắn ngữ cảnh lịch sử nạp vào LLM',
    example: 10,
    minimum: 0,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'contextHistoryLimit phải là số nguyên.' })
  @Min(0, { message: 'Số tin nhắn ngữ cảnh không được âm.' })
  @Max(50, { message: 'Số tin nhắn ngữ cảnh tối đa 50 tin.' })
  contextHistoryLimit?: number;

  @ApiPropertyOptional({
    description: 'Nhiệt độ sinh phản hồi của mô hình LLM (0.0 đến 1.0)',
    example: 0.15,
    minimum: 0.0,
    maximum: 1.0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'temperature phải là số thực.' })
  @Min(0.0, { message: 'Nhiệt độ tối thiểu 0.0.' })
  @Max(1.0, { message: 'Nhiệt độ tối đa 1.0.' })
  temperature?: number;
}
