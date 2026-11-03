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
  AdminHistoryQueryDto,
  AdminTicketQueryDto,
} from '../bookings/dto/admin-booking-query.dto.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { AdminTicketsService } from './admin-tickets.service.js';

@ApiTags('Vé xe điện tử - Quản trị (Admin Tickets)')
@ApiBearerAuth('JWT-auth')
@Controller('admin/tickets')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('booking:read')
export class AdminTicketsController {
  constructor(private readonly adminTicketsService: AdminTicketsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách vé xe dành cho quản trị nhà xe',
    description:
      'Lấy danh sách vé xe thuộc phạm vi nhà xe quản lý, hỗ trợ lọc theo trạng thái, khoảng ngày đặt, khoảng ngày khởi hành, từ khóa tìm kiếm và phân trang.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách vé xe thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập thông tin vé xe (cần booking:read).',
    type: ApiErrorResponseDto,
  })
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminTicketQueryDto,
  ) {
    return this.adminTicketsService.list(principal, query);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Xem lịch sử thay đổi vé xe',
    description:
      'Truy vấn nhật ký sự kiện, biến động trạng thái (đặt vé, thanh toán, hủy vé) của vé xe cụ thể.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID vé xe cần tra cứu lịch sử',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy lịch sử vé xe thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy vé xe hoặc vé không thuộc nhà xe quản lý.',
    type: ApiErrorResponseDto,
  })
  history(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminTicketsService.history(principal, id, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết vé xe dành cho quản trị',
    description:
      'Lấy thông tin chi tiết đầy đủ của một vé xe (thông tin hành khách, ghế ngồi, chuyến xe, lộ trình, giá vé, trạng thái) theo ID.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID vé xe',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết vé xe thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy vé xe hoặc không thuộc nhà xe quản lý.',
    type: ApiErrorResponseDto,
  })
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminTicketsService.detail(principal, id);
  }
}
