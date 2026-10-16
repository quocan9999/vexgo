import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { BookingsModule } from '../../../src/bookings/bookings.module.js';
import { CargoCapacityModule } from '../../../src/cargo-capacity/cargo-capacity.module.js';
import { CargoPricingModule } from '../../../src/cargo-pricing/cargo-pricing.module.js';
import { NotificationsModule } from '../../../src/notifications/notifications.module.js';
import { PaymentsModule } from '../../../src/payments/payments.module.js';
import { PaymentsController } from '../../../src/payments/payments.controller.js';
import { PaymentsService } from '../../../src/payments/payments.service.js';
import { PaymentSettlementService } from '../../../src/payments/payment-settlement.service.js';
import { PrismaModule } from '../../../src/prisma/prisma.module.js';
import { PromotionsModule } from '../../../src/promotions/promotions.module.js';
import { RefundProcessorService } from '../../../src/payments/refund-processor.service.js';
import { ReviewsModule } from '../../../src/reviews/reviews.module.js';
import { SeatHoldsModule } from '../../../src/seat-holds/seat-holds.module.js';
import { ShipmentPersistenceService } from '../../../src/shipments/shipment-persistence.service.js';
import { ShipmentsController } from '../../../src/shipments/shipments.controller.js';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';
import { ShipmentsModule } from '../../../src/shipments/shipments.module.js';
import { TicketsModule } from '../../../src/tickets/tickets.module.js';

vi.mock('../../../src/shipments/shipments.service.js', () => ({
  ShipmentsService: class ShipmentsService {},
}));

function moduleMetadata<T>(key: string, moduleType: Function): T[] {
  return Reflect.getMetadata(key, moduleType) as T[];
}

describe('shipment-related module wiring', () => {
  it('keeps shipment and PR #36 modules reachable from AppModule exactly once', () => {
    const imports = moduleMetadata<unknown>(MODULE_METADATA.IMPORTS, AppModule);

    for (const featureModule of [
      ShipmentsModule,
      SeatHoldsModule,
      PromotionsModule,
      BookingsModule,
      PaymentsModule,
      NotificationsModule,
      ReviewsModule,
      TicketsModule,
    ]) {
      expect(
        imports.filter((candidate) => candidate === featureModule),
      ).toHaveLength(1);
    }
  });

  it('provides shipment dependencies and keeps Auth, Prisma, pricing and capacity modules', () => {
    const imports = moduleMetadata<unknown>(
      MODULE_METADATA.IMPORTS,
      ShipmentsModule,
    );
    const controllers = moduleMetadata<unknown>(
      MODULE_METADATA.CONTROLLERS,
      ShipmentsModule,
    );
    const providers = moduleMetadata<unknown>(
      MODULE_METADATA.PROVIDERS,
      ShipmentsModule,
    );
    const exports = moduleMetadata<unknown>(
      MODULE_METADATA.EXPORTS,
      ShipmentsModule,
    );

    expect(imports).toEqual(
      expect.arrayContaining([
        AuthModule,
        PrismaModule,
        CargoPricingModule,
        CargoCapacityModule,
      ]),
    );
    expect(controllers).toEqual([ShipmentsController]);
    expect(providers).toEqual(
      expect.arrayContaining([ShipmentsService, ShipmentPersistenceService]),
    );
    expect(exports).toEqual(
      expect.arrayContaining([ShipmentsService, ShipmentPersistenceService]),
    );
  });

  it('keeps the real payment controller and all production settlement providers exported', () => {
    const imports = moduleMetadata<unknown>(
      MODULE_METADATA.IMPORTS,
      PaymentsModule,
    );
    const controllers = moduleMetadata<unknown>(
      MODULE_METADATA.CONTROLLERS,
      PaymentsModule,
    );
    const providers = moduleMetadata<unknown>(
      MODULE_METADATA.PROVIDERS,
      PaymentsModule,
    );
    const exports = moduleMetadata<unknown>(
      MODULE_METADATA.EXPORTS,
      PaymentsModule,
    );

    expect(imports).toContain(PrismaModule);
    expect(controllers).toEqual([PaymentsController]);
    expect(providers).toEqual(
      expect.arrayContaining([
        PaymentsService,
        PaymentSettlementService,
        RefundProcessorService,
      ]),
    );
    expect(exports).toEqual(
      expect.arrayContaining([
        PaymentsService,
        PaymentSettlementService,
        RefundProcessorService,
      ]),
    );
  });
});
