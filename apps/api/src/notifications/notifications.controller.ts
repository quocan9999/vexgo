import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Thông báo người dùng (Notifications)')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách thông báo của người dùng',
    description:
      'Lấy danh sách thông báo gửi đến tài khoản đang đăng nhập, hỗ trợ lọc thông báo chưa đọc và phân trang.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách thông báo thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
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
  @ApiOperation({
    summary: 'Đánh dấu tất cả thông báo đã đọc',
    description: 'Cập nhật trạng thái đã đọc cho toàn bộ thông báo của tài khoản hiện tại.',
  })
  @ApiResponse({
    status: 200,
    description: 'Đã đánh dấu đọc tất cả thông báo thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập.',
    type: ApiErrorResponseDto,
  })
  async markAllAsRead(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.notificationsService.markAllAsRead(principal.taiKhoanId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Đánh dấu một thông báo đã đọc',
    description: 'Cập nhật trạng thái đã đọc cho một thông báo cụ thể theo ID.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID thông báo cần đánh dấu đọc',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Đã đánh dấu đọc thông báo thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy thông báo.',
    type: ApiErrorResponseDto,
  })
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.notificationsService.markAsRead(principal.taiKhoanId, id);
  }
}
