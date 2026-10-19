import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PromotionsController } from './promotions.controller.js';
import { PublicPromotionsController } from './public-promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController, PublicPromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
