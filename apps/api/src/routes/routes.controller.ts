import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { RouteIdParamsDto } from './dto/route-id-params.dto.js';
import { RouteQueryDto } from './dto/route-query.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto.js';
import { RoutesService } from './routes.service.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireTenantPermissionsIfAuthenticated } from '../auth/decorators/require-tenant-permissions-if-authenticated.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Tuyến xe (Routes)')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('code-preview')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:create')
  @ApiOperation({
    summary: 'Xem trước mã tuyến xe tự sinh',
    description:
      'Gợi ý mã tuyến xe tiếp theo dựa trên quy tắc sinh mã tự động của nhà xe.\n\n- **Quyền hạn yêu cầu**: Nhân viên nhà xe có quyền `route:create`.',
  })
  @ApiResponse({ status: 200, description: 'Gợi ý mã tuyến xe thành công.' })
  previewCode(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.routesService.previewCode(principal);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:create')
  @ApiOperation({
    summary: 'Tạo mới tuyến xe',
    description:
      'Thiết lập tuyến đường di chuyển mới: điểm xuất phát, điểm đến, thời gian chạy dự kiến và nhà xe khai thác.\n\n- **Quyền hạn yêu cầu**: Quyền `route:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo tuyến xe thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Không đủ quyền hạn.', type: ApiErrorResponseDto })
  create(
    @Body() body: CreateRouteDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.routesService.create(body, principal);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin tuyến xe',
    description:
      'Chỉnh sửa điểm khởi hành, điểm kết thúc hoặc thời gian hành trình dự kiến của tuyến xe.\n\n- **Quyền hạn yêu cầu**: Quyền `route:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID tuyến xe cần cập nhật', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật tuyến xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến xe.', type: ApiErrorResponseDto })
  update(
    @Param() params: RouteIdParamsDto,
    @Body() body: UpdateRouteDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.routesService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái tuyến xe',
    description:
      'Chuyển trạng thái hoạt động: `HOAT_DONG` hoặc tạm ngưng chạy `TAM_NGUNG`.\n\n- **Quyền hạn yêu cầu**: Quyền `route:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID tuyến xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Đổi trạng thái tuyến xe thành công.' })
  updateStatus(
    @Param() params: RouteIdParamsDto,
    @Body() body: UpdateRouteStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.routesService.updateStatus(params.id, body.status, principal);
  }

  @Get()
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  @ApiOperation({
    summary: 'Danh sách tuyến xe',
    description:
      'Truy vấn danh sách các tuyến xe đang hoạt động kèm lọc theo nhà xe, trạng thái và phân trang.\n\n- **Quyền truy cập**: Công khai (Public). Nếu đã đăng nhập thì kiểm tra quyền `route:read`.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách tuyến xe.' })
  findAll(
    @Query() query: RouteQueryDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.routesService.findAll(query, principal);
  }

  @Get(':id')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  @ApiOperation({
    summary: 'Chi tiết tuyến xe',
    description:
      'Xem thông tin chi tiết một tuyến xe cụ thể.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID tuyến xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết tuyến xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến xe.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: RouteIdParamsDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.routesService.findOne(params.id, principal);
  }
}
