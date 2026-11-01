import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { VIETNAM_PHONE_NUMBER_REGEX } from '../../common/validation/vietnamese-phone.js';

export class CancelTicketDto {
  @ApiProperty({ description: 'Mã vé xe cần yêu cầu hủy', example: 'TK-202610-001' })
  @IsString()
  @IsNotEmpty()
  ticketCode!: string;

  @ApiPropertyOptional({
    description: 'Danh sách các mã vé cùng hủy chung một lượt',
    example: ['TK-202610-001', 'TK-202610-002'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticketCodes?: string[];

  @ApiProperty({ description: 'Số điện thoại của người đặt vé để xác thực quyền sở hữu', example: '0912345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(VIETNAM_PHONE_NUMBER_REGEX, {
    message: 'Số điện thoại không hợp lệ.',
  })
  phoneNumber!: string;

  @ApiPropertyOptional({ description: 'Lý do yêu cầu hủy vé', example: 'Có việc bận đột xuất' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Tỷ lệ phí hủy vé dự kiến khách chấp nhận (0: miễn phí, 0.1: 10%, 0.2: 20%)',
    example: 0.1,
    minimum: 0,
    maximum: 1,
  })
  @IsDefined()
  @IsNumber()
  @Min(0)
  @Max(1)
  expectedCancelFeeRate!: number;
}
