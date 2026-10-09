import { Body, Controller, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { ValidatePromotionDto } from './dto/validate-promotion.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  async validatePromotion(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validatePromotion({
      code: dto.code,
      tripId: dto.tripId,
      nhaXeId: dto.nhaXeId,
      seatCount: dto.seatCount,
      totalAmount: dto.totalAmount,
    });
  }
}
