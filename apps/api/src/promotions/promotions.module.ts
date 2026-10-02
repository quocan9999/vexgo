import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PromotionsService } from './promotions.service.js';

@Module({
  imports: [PrismaModule],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
