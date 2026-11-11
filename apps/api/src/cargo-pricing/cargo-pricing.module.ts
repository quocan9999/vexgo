import { Module } from '@nestjs/common';
import { CargoPricingService } from './cargo-pricing.service.js';

@Module({
  providers: [CargoPricingService],
  exports: [CargoPricingService],
})
export class CargoPricingModule {}
