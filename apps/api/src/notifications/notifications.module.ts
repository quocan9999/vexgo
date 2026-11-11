import { EmailDeliveryService } from './email-delivery.service.js';
import { DepartureRemindersService } from './departure-reminders.service.js';
import {
  PushDevicesController,
  PushDevicesService,
} from './push-devices.controller.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController, PushDevicesController],
  providers: [
    NotificationsService,
    EmailDeliveryService,
    DepartureRemindersService,
    PushDevicesService,
    PushDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
