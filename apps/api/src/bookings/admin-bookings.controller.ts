import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  AdminBookingQueryDto,
  AdminHistoryQueryDto,
} from './dto/admin-booking-query.dto.js';
import { AdminBookingsService } from './admin-bookings.service.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Đặt vé - Quản trị (Admin Bookings)')
@ApiBearerAuth('JWT-auth')
@Controller('admin/bookings')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('booking:read')
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Quản lý danh sách đơn đặt vé',
    description:
      'Truy vấn danh sách các đơn đặt vé thuộc phạm vi nhà xe quản lý kèm bộ lọc theo trạng thái, ngày đặt, ngày khởi hành và phân trang.\n\n- **Quyền hạn yêu cầu**: Quyền `booking:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách đơn đặt vé thành công.' })
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminBookingQueryDto,
  ) {
    return this.adminBookingsService.list(principal, query);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Xem lịch sử thay đổi trạng thái đơn đặt vé',
    description:
      'Lấy nhật ký kiểm tra (audit log) ghi lại toàn bộ các lần chuyển đổi trạng thái và sự kiện của đơn hàng.\n\n- **Quyền hạn yêu cầu**: Quyền `booking:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn đặt vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Lịch sử thay đổi đơn hàng.' })
  history(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminBookingsService.history(principal, id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết đơn đặt vé (Góc nhìn Quản trị)',
    description:
      'Xem thông tin chi tiết đơn đặt chỗ: thông tin khách hàng, ghế, vé điện tử và trạng thái thanh toán.\n\n- **Quyền hạn yêu cầu**: Quyền `booking:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID đơn đặt vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn đặt vé.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đặt vé.', type: ApiErrorResponseDto })
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminBookingsService.detail(principal, id);
  }
}
