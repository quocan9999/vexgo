import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { PlatformDashboardService } from './platform-dashboard.service.js';

@ApiTags('Bảng điều khiển sàn - Super Admin (Platform Dashboard)')
@ApiBearerAuth('JWT-auth')
@Controller('super-admin/dashboard')
@RequireRoles('SUPER_ADMIN')
@RequirePermissions('bus-company:read', 'admin-account:read')
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Tổng quan số liệu toàn hệ thống',
    description:
      'Lấy thống kê tổng quan toàn bộ nền tảng VexGo (tổng số nhà xe, người dùng, tài khoản quản trị, số chuyến xe và doanh số chung).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy dữ liệu tổng quan thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ dành riêng cho Super Admin.',
    type: ApiErrorResponseDto,
  })
  getOverview() {
    return this.dashboard.getOverview();
  }
}
