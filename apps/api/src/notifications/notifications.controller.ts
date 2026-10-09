import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: GetNotificationsQueryDto,
  ) {
    return this.notificationsService.getMyNotifications(
      principal.taiKhoanId,
      query,
    );
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.notificationsService.markAllAsRead(principal.taiKhoanId);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.notificationsService.markAsRead(principal.taiKhoanId, id);
  }
}
