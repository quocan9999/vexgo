import { Controller, GoneException, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('promotions')
export class PublicPromotionsController {
  @Post('validate')
  @Public()
  validateLegacyPromotion(): never {
    throw new GoneException({
      error: 'PROMOTION_VALIDATE_DEPRECATED',
      message: 'Vui lòng dùng API báo giá đặt vé để xác thực mã khuyến mãi.',
    });
  }
}
