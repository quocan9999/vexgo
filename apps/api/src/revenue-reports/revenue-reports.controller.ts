import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { RevenueReportQueryDto } from './dto/revenue-report-query.dto.js';
import { RevenueReportsService } from './revenue-reports.service.js';

@ApiTags('Báo cáo thống kê & Doanh thu (Revenue Reports)')
@ApiBearerAuth('JWT-auth')
@Controller('revenue-reports')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class RevenueReportsController {
  constructor(private readonly revenueReportsService: RevenueReportsService) {}

  @Get()
  @RequirePermissions('revenue:read')
  @ApiOperation({
    summary: 'Báo cáo doanh thu nhà xe',
    description:
      'Tổng hợp số liệu doanh thu bán vé, gửi hàng hóa theo khoảng thời gian tùy chọn và nhóm theo ngày, tháng hoặc quý.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy báo cáo doanh thu thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Khoảng thời gian báo cáo không hợp lệ hoặc vượt quá giới hạn 366 ngày.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem báo cáo doanh thu (cần revenue:read).',
    type: ApiErrorResponseDto,
  })
  getReport(
    @Query() query: RevenueReportQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.revenueReportsService.getReport(query, principal);
  }
}
