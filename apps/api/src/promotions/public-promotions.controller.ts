import { Controller, GoneException, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Chương trình khuyến mãi & Mã giảm giá (Promotions)')
@Controller('promotions')
export class PublicPromotionsController {
  @Post('validate')
  @Public()
  @ApiOperation({
    summary: 'Xác thực mã khuyến mãi (Deprecated - Đã ngừng hỗ trợ)',
    description:
      'Endpoint này đã ngừng hoạt động. Vui lòng chuyển sang dùng API báo giá đơn đặt vé (POST /api/v1/bookings/quote) để kiểm tra tính hợp lệ và giá trị khấu trừ của mã khuyến mãi.',
    deprecated: true,
  })
  @ApiResponse({
    status: 410,
    description: 'Endpoint đã bị loại bỏ hoàn toàn (Gone).',
    type: ApiErrorResponseDto,
  })
  validateLegacyPromotion(): never {
    throw new GoneException({
      error: 'PROMOTION_VALIDATE_DEPRECATED',
      message: 'Vui lòng dùng API báo giá đặt vé để xác thực mã khuyến mãi.',
    });
  }
}
