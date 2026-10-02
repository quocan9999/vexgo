import { Body, Controller, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Public()
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  async validatePromotion(
    @Body()
    body: {
      code: string;
      tripId?: number | string;
      seatCount?: number | string;
      totalAmount?: number | string;
    },
  ) {
    return this.promotionsService.validatePromotion({
      code: body.code,
      tripId: body.tripId ? Number(body.tripId) : undefined,
      seatCount: body.seatCount ? Number(body.seatCount) : undefined,
      totalAmount: body.totalAmount ? Number(body.totalAmount) : undefined,
    });
  }
}
