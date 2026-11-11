import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { CreateFarePriceDto } from './dto/create-fare-price.dto.js';
import { FarePriceIdParamsDto } from './dto/fare-price-id-params.dto.js';
import { QueryFarePricesDto } from './dto/query-fare-prices.dto.js';
import { ResolveApplicableFareQueryDto } from './dto/resolve-applicable-fare-query.dto.js';
import { UpdateFarePriceDto } from './dto/update-fare-price.dto.js';
import { UpdateFarePriceStatusDto } from './dto/update-fare-price-status.dto.js';
import { FarePricesService } from './fare-prices.service.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Bảng giá vé (Fare Prices)')
@ApiBearerAuth('JWT-auth')
@Controller('fare-prices')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class FarePricesController {
  constructor(private readonly farePricesService: FarePricesService) {}

  @Post()
  @RequirePermissions('fare-price:create')
  @ApiOperation({
    summary: 'Tạo mới bảng giá vé',
    description:
      'Thiết lập mức giá vé niêm yết cho một tuyến xe và loại phương tiện cụ thể trong khoảng thời gian hiệu lực.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo bảng giá vé thành công.' })
  @ApiResponse({ status: 400, description: 'Khoảng thời gian trùng lặp hoặc dữ liệu không hợp lệ.', type: ApiErrorResponseDto })
  create(
    @Body() input: CreateFarePriceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.create(input, principal);
  }

  @Patch(':id')
  @RequirePermissions('fare-price:update')
  @ApiOperation({
    summary: 'Cập nhật bảng giá vé',
    description:
      'Chỉnh sửa mức giá vé niêm yết hoặc khoảng ngày áp dụng của bảng giá vé.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng giá vé cần cập nhật', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật bảng giá vé thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bảng giá vé.', type: ApiErrorResponseDto })
  update(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.update(params.id, input, principal);
  }

  @Patch(':id/status')
  @RequirePermissions('fare-price:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái bảng giá vé',
    description:
      'Chuyển đổi trạng thái hoạt động: `HOAT_DONG` hoặc ngưng áp dụng `NGUNG_HOAT_DONG`.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng giá vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Đổi trạng thái thành công.' })
  updateStatus(
    @Param() params: FarePriceIdParamsDto,
    @Body() input: UpdateFarePriceStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.updateStatus(params.id, input.status, principal);
  }

  @Get()
  @RequirePermissions('fare-price:read')
  @ApiOperation({
    summary: 'Danh sách các bảng giá vé',
    description:
      'Truy vấn danh sách bảng giá vé của nhà xe, lọc theo tuyến xe, loại xe, trạng thái hiệu lực và phân trang.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách bảng giá vé thành công.' })
  findAll(
    @Query() query: QueryFarePricesDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.findAll(query, principal);
  }

  @Get('applicable')
  @RequirePermissions('fare-price:read')
  @ApiOperation({
    summary: 'Giải quyết bảng giá áp dụng cho chuyến xe',
    description:
      'Tìm kiếm bảng giá vé hợp lệ có thể áp dụng cho một tuyến xe và loại phương tiện vào một ngày cụ thể.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:read`.',
  })
  @ApiResponse({ status: 200, description: 'Bảng giá vé áp dụng hợp lệ.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bảng giá vé phù hợp.', type: ApiErrorResponseDto })
  resolveApplicableFare(
    @Query() query: ResolveApplicableFareQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.resolveApplicableFare(query, principal);
  }

  @Get(':id')
  @RequirePermissions('fare-price:read')
  @ApiOperation({
    summary: 'Chi tiết một bảng giá vé',
    description:
      'Xem thông tin chi tiết một bảng giá vé theo ID.\n\n- **Quyền hạn yêu cầu**: Quyền `fare-price:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID bảng giá vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết bảng giá vé.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy bảng giá vé.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: FarePriceIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.farePricesService.findOne(params.id, principal);
  }
}
