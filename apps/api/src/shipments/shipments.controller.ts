import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
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
import { CancelShipmentDto } from './dto/cancel-shipment.dto.js';
import { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto.js';
import { ShipmentsService } from './shipments.service.js';
import { ShipmentRatesService } from './shipment-rates.service.js';
import {
  ShipmentOptionsQueryDto,
  ShipmentQuoteDto,
  AcceptShipmentDto,
  AssignShipmentDto,
  CollectShipmentPaymentDto,
} from './dto/shipment-operations.dto.js';
import {
  CreateShipmentRateDto,
  QueryShipmentRatesDto,
  UpdateShipmentRateDto,
  UpdateShipmentRateStatusDto,
} from './dto/shipment-rates.dto.js';

function assertShipmentRateReadPermission(principal: AuthPrincipal): void {
  const canRead =
    principal.permissions?.includes('shipment:read') ||
    principal.permissions?.includes('fare-price:read');
  if (!canRead) {
    throw new ForbiddenException({
      error: 'PERMISSION_FORBIDDEN',
      message: 'Tài khoản không có quyền xem bảng cước gửi hàng.',
    });
  }
}

function assertShipmentRateWritePermission(principal: AuthPrincipal): void {
  const canWrite =
    principal.permissions?.includes('shipment:update') ||
    principal.permissions?.includes('fare-price:create') ||
    principal.permissions?.includes('fare-price:update');
  if (!canWrite) {
    throw new ForbiddenException({
      error: 'PERMISSION_FORBIDDEN',
      message: 'Tài khoản không có quyền cấu hình bảng cước gửi hàng.',
    });
  }
}

@ApiTags('Gửi hàng hóa & Bưu kiện (Shipments)')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly shipmentRatesService?: ShipmentRatesService,
  ) {}

  @Post()
  @RequireTenantPermissionsIfAuthenticated('shipment:update')
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
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const data = await this.shipmentsService.createShipment(
      dto,
      principal,
      idempotencyKey,
    );
    return { data };
  }

  @Get('options')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
  @OptionalAuth()
  getShipmentOptions(
    @Query() query: ShipmentOptionsQueryDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return this.shipmentsService.getShipmentOptions(query, principal);
  }

  @Get('routes/:routeId/route-points')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
  @OptionalAuth()
  async getRoutePointsByRoute(
    @Param('routeId', ParseIntPipe) routeId: number,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return {
      data: await this.shipmentsService.getRoutePointsByRoute(
        routeId,
        principal,
      ),
    };
  }

  @Post('quotes')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  async quoteShipment(
    @Body() dto: ShipmentQuoteDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return { data: await this.shipmentsService.quoteShipment(dto, principal) };
  }

  @Get('rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @ApiOperation({
    summary: 'Danh sách bảng cước gửi hàng của nhà xe',
    description:
      'Truy vấn danh sách các mức cước gửi hàng theo tuyến xe, loại hàng hóa, nấc cân nặng và trạng thái hiệu lực.',
  })
  listShipmentRates(
    @Query() query: QueryShipmentRatesDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    assertShipmentRateReadPermission(principal);
    return this.shipmentRatesService!.findAll(query, principal);
  }

  @Get('rates/:rateId')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @ApiOperation({
    summary: 'Chi tiết một mức cước gửi hàng',
    description: 'Xem chi tiết mức cước gửi hàng theo ID trong phạm vi nhà xe.',
  })
  getShipmentRateDetail(
    @Param('rateId', ParseIntPipe) rateId: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    assertShipmentRateReadPermission(principal);
    return this.shipmentRatesService!.findOne(rateId, principal);
  }

  @Post('rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo mới mức cước gửi hàng',
    description:
      'Thiết lập mức cước gửi hàng theo tuyến xe, loại hàng hóa, nấc khối lượng và thời gian hiệu lực.',
  })
  createShipmentRate(
    @Body() dto: CreateShipmentRateDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    assertShipmentRateWritePermission(principal);
    return this.shipmentRatesService!.create(dto, principal);
  }

  @Patch('rates/:rateId')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @ApiOperation({
    summary: 'Cập nhật mức cước gửi hàng',
    description:
      'Chỉnh sửa mức cước, nấc khối lượng hoặc khoảng ngày hiệu lực của bảng cước gửi hàng.',
  })
  updateShipmentRate(
    @Param('rateId', ParseIntPipe) rateId: number,
    @Body() dto: UpdateShipmentRateDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    assertShipmentRateWritePermission(principal);
    return this.shipmentRatesService!.update(rateId, dto, principal);
  }

  @Patch('rates/:rateId/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @ApiOperation({
    summary: 'Đổi trạng thái mức cước gửi hàng',
    description:
      'Kích hoạt (HOAT_DONG) hoặc tạm ngưng (TAM_NGUNG) mức cước gửi hàng.',
  })
  updateShipmentRateStatus(
    @Param('rateId', ParseIntPipe) rateId: number,
    @Body() dto: UpdateShipmentRateStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    assertShipmentRateWritePermission(principal);
    return this.shipmentRatesService!.updateStatus(
      rateId,
      dto.status,
      principal,
    );
  }

  @Post(':id/accept')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  acceptShipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AcceptShipmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.acceptShipment(id, dto, principal);
  }

  @Get(':id/available-trips')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:read')
  availableTrips(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.availableTrips(id, principal);
  }

  @Patch(':id/assignment')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  assignShipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignShipmentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.assignShipment(id, dto, principal);
  }

  @Post(':id/collect-payment')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  collectPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CollectShipmentPaymentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.collectPayment(id, dto, principal);
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

  @Post('cancel')
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
    summary: 'Khách hàng chủ động hủy đơn gửi hàng (khi còn ở trạng thái Mới tạo)',
    description:
      'Cho phép khách hàng hủy phiếu gửi hàng trực tuyến khi đơn còn ở trạng thái Mới tạo (chưa mang hàng ra bến).',
  })
  @ApiResponse({
    status: 200,
    description: 'Hủy đơn gửi hàng thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy bưu kiện hoặc số điện thoại không khớp.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Đơn gửi hàng đã tiếp nhận hoặc không đủ điều kiện hủy trực tuyến.',
    type: ApiErrorResponseDto,
  })
  async cancelShipment(
    @Body() dto: CancelShipmentDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.shipmentsService.cancelCustomerShipment(
      dto,
      principal,
    );
    return { data };
  }

  @Get('categories')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Danh mục các loại hàng hóa',
    description:
      'Lấy danh sách các phân loại hàng hóa phục vụ báo giá cước vận chuyển.',
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
    description:
      'Lấy danh sách các trạm dừng, bến xe tiếp nhận và trả hàng hóa trên lộ trình chuyến xe.',
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
