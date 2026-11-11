import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StationsService } from './stations.service.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';
import { StationQueryDto } from './dto/station-query.dto.js';
import { UpdateTripPassengerPointsDto } from './dto/trip-passenger-points.dto.js';
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

@ApiTags('Bến bãi & Điểm đón trả (Stations)')
@Controller()
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get('stations')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  @ApiOperation({
    summary: 'Danh sách bến xe và điểm đón trả',
    description:
      'Lấy danh sách bến xe trung tâm, văn phòng đại diện và điểm đón trả khách, có hỗ trợ tìm kiếm, lọc theo loại điểm, tỉnh thành và phân trang.\n\n- **Quyền truy cập**: Công khai (Public). Nếu đã đăng nhập, yêu cầu quyền `route:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách điểm đón trả thành công.' })
  list(
    @Query() query: StationQueryDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.list(query, principal);
  }

  @Post('stations')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:create')
  @ApiOperation({
    summary: 'Tạo mới bến xe hoặc điểm đón trả',
    description:
      'Thêm một bến xe, văn phòng nhà xe hoặc điểm đón trả dọc đường mới vào cơ sở dữ liệu.\n\n- **Quyền hạn yêu cầu**: Nhân viên nhà xe có quyền `route:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo bến bãi thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc trùng mã điểm.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Không đủ quyền hạn.', type: ApiErrorResponseDto })
  create(
    @Body() body: CreateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.create(body, principal);
  }

  @Get('stations/:id')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  @ApiOperation({
    summary: 'Chi tiết bến xe / điểm đón trả',
    description:
      'Lấy thông tin chi tiết của một bến xe hoặc trạm đón trả khách: tên, địa chỉ, tọa độ GPS, số điện thoại.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID của điểm đón trả', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết điểm đón trả.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm đón trả.', type: ApiErrorResponseDto })
  findById(
    @Param('id', ParseIntPipe) id: number,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    return this.stationsService.findById(id, principal);
  }

  @Patch('stations/:id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin điểm đón trả',
    description:
      'Chỉnh sửa tên, địa chỉ, số điện thoại hoặc trạng thái hoạt động của bến bãi.\n\n- **Quyền hạn yêu cầu**: Quyền `route:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID điểm đón trả cần cập nhật', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật điểm đón trả thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy điểm đón trả.', type: ApiErrorResponseDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStationDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.update(id, body, principal);
  }

  @Delete('stations/:id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  @ApiOperation({
    summary: 'Xóa điểm đón trả',
    description:
      'Thực hiện xóa hoặc ngưng hoạt động điểm đón trả nếu không còn sử dụng.\n\n- **Quyền hạn yêu cầu**: Quyền `route:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID điểm đón trả cần xóa', example: 1 })
  @ApiResponse({ status: 200, description: 'Xóa điểm đón trả thành công.' })
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.delete(id, principal);
  }

  @Get('trips/:id/passenger-points')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  @ApiOperation({
    summary: 'Quản trị viên lấy danh sách điểm đón trả của chuyến xe',
    description:
      'Xem cấu hình chi tiết các điểm đón và trả khách của chuyến xe bao gồm thứ tự và giờ dự kiến.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Danh sách điểm đón trả của chuyến xe.' })
  getTripPointsForAdmin(
    @Param('id', ParseIntPipe) tripId: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.getTripPassengerPointsForAdmin(tripId, principal);
  }

  @Get('trips/:id/passenger-points/public')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Khách hàng xem danh sách điểm đón trả của chuyến xe',
    description:
      'Lấy danh sách các điểm đón và trả khách của một chuyến xe công khai để hành khách chọn điểm lên/xuống khi đặt vé.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Danh sách các điểm đón và trả khách kèm giờ dự kiến và phụ phí.' })
  getTripPointsPublic(@Param('id', ParseIntPipe) tripId: number) {
    return this.stationsService.getTripPassengerPointsPublic(tripId);
  }

  @Put('trips/:id/passenger-points')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  @ApiOperation({
    summary: 'Thiết lập danh sách điểm đón trả cho chuyến xe',
    description:
      'Cập nhật toàn bộ các điểm đón, điểm trả khách, thứ tự và phụ phí đón trả cho một chuyến xe.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Cập nhật danh sách điểm đón trả thành công.' })
  updateTripPoints(
    @Param('id', ParseIntPipe) tripId: number,
    @Body() body: UpdateTripPassengerPointsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.updateTripPassengerPoints(tripId, body, principal);
  }

  @Post('trips/:id/passenger-points/apply-route-template')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  @ApiOperation({
    summary: 'Áp dụng khuôn lộ trình tuyến xe cho chuyến xe',
    description:
      'Sao chép toàn bộ các điểm dừng đón/trả từ khuôn lộ trình của tuyến xe sang chuyến xe hiện tại.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Áp dụng khuôn lộ trình thành công.' })
  applyRouteTemplate(
    @Param('id', ParseIntPipe) tripId: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.stationsService.applyRouteTemplateToTrip(tripId, principal);
  }
}
