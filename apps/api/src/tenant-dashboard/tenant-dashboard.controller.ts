import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { TenantDashboardService } from './tenant-dashboard.service.js';
import { TenantDashboardOverviewDto } from './dto/tenant-dashboard-overview.dto.js';

@ApiTags('Bảng điều khiển nhà xe (Tenant Dashboard)')
@ApiBearerAuth('JWT-auth')
@Controller('tenant-dashboard')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class TenantDashboardController {
  constructor(private readonly dashboardService: TenantDashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Tổng quan chỉ số vận hành nhà xe',
    description:
      'Lấy số liệu vận hành thời gian thực trong ngày hôm nay của nhà xe: chuyến xe, vé, kiện hàng, doanh thu ước tính và chuyến sắp xuất bến.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy dữ liệu tổng quan thành công.',
    type: TenantDashboardOverviewDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Chỉ dành cho tài khoản thuộc phạm vi nhà xe.',
    type: ApiErrorResponseDto,
  })
  async getOverview(@CurrentPrincipal() principal: AuthPrincipal) {
    const data = await this.dashboardService.getOverview(principal);
    return { data };
  }
}
