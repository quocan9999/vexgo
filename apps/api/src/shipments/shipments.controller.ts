import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequireTenantPermissionsIfAuthenticated } from '../auth/decorators/require-tenant-permissions-if-authenticated.decorator.js';
import {
  hasTenantRole,
  TENANT_PRINCIPAL_ROLES,
} from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  PUBLIC_RATE_LIMIT_TTL_MS,
  PUBLIC_SHIPMENT_LOOKUP_RATE_LIMIT,
} from '../common/rate-limit-policy.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { LookupShipmentDto } from './dto/lookup-shipment.dto.js';
import { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto.js';
import { ShipmentsService } from './shipments.service.js';

@ApiTags('Gửi hàng hóa & Bưu kiện (Shipments)')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @OptionalAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo đơn gửi hàng hóa / bưu kiện',
    description:
      'Tạo phiếu gửi hàng kèm danh sách kiện hàng, tính cước phí tự động theo khối lượng, kích thước và loại hàng hóa.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo đơn gửi hàng thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu hàng hóa hoặc chuyến xe không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  async createShipment(
    @Body() dto: CreateShipmentDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.shipmentsService.createShipment(
      dto,
      principal?.taiKhoanId,
    );
    return { data };
  }

  @Post('lookup')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_SHIPMENT_LOOKUP_RATE_LIMIT,
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Tra cứu tiến trình bưu kiện (Công khai có rate limit)',
    description:
      'Tra cứu thông tin trạng thái vận chuyển của kiện hàng bằng mã vận đơn và số điện thoại người gửi/nhận.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tra cứu bưu kiện thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bưu kiện với thông tin cung cấp.',
    type: ApiErrorResponseDto,
  })
  async lookupShipment(@Body() dto: LookupShipmentDto) {
    const data = await this.shipmentsService.lookupShipment(dto);
    return { data };
  }

  @Get('categories')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Danh mục các loại hàng hóa',
    description: 'Lấy danh sách các phân loại hàng hóa phục vụ báo giá cước vận chuyển.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh mục hàng hóa thành công.',
  })
  async getCargoCategories() {
    const data = await this.shipmentsService.getCargoCategories();
    return { data };
  }

  @Get('trips/:tripId/route-points')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Danh sách điểm gửi/nhận hàng của chuyến xe',
    description: 'Lấy danh sách các trạm dừng, bến xe tiếp nhận và trả hàng hóa trên lộ trình chuyến xe.',
  })
  @ApiParam({
    name: 'tripId',
    type: Number,
    description: 'ID chuyến xe',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách điểm gửi nhận thành công.',
  })
  async getRoutePoints(@Param('tripId', ParseIntPipe) tripId: number) {
    const data = await this.shipmentsService.getRoutePoints(tripId);
    return { data };
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES, 'KHACH_HANG')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
  @ApiOperation({
    summary: 'Chi tiết phiếu gửi hàng',
    description:
      'Xem thông tin chi tiết của phiếu gửi hàng (người gửi, người nhận, các kiện hàng, cước phí, trạng thái vận chuyển).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID phiếu gửi hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết phiếu gửi hàng thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiếu gửi hàng.',
    type: ApiErrorResponseDto,
  })
  async getShipmentDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    if (hasTenantRole(principal.roles)) {
      return this.shipmentsService.findOne(id, principal);
    }

    const data = await this.shipmentsService.getShipmentDetail(id, principal);
    return { data };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES, 'KHACH_HANG')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
  @ApiOperation({
    summary: 'Danh sách phiếu gửi hàng',
    description:
      'Lấy danh sách phiếu gửi hàng có phân trang. Khách hàng chỉ xem phiếu gửi của mình; Quản trị viên nhà xe xem danh sách phiếu thuộc phạm vi nhà xe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách phiếu gửi hàng thành công.',
  })
  async listShipments(
    @Query() query: ShipmentQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    if (hasTenantRole(principal.roles)) {
      return this.shipmentsService.findAll(query, principal);
    }

    return this.shipmentsService.listShipments(query, principal);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  @ApiOperation({
    summary: 'Cập nhật trạng thái phiếu gửi hàng',
    description:
      'Cập nhật tiến trình vận chuyển của hàng hóa (Đã tiếp nhận, Đang vận chuyển, Đã giao) và ghi chú.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID phiếu gửi hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Trạng thái chuyển đổi không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy phiếu gửi hàng.',
    type: ApiErrorResponseDto,
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.updateStatus(id, dto, principal);
  }
}
