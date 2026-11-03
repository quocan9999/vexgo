import {
  Body,
  Controller,
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
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { LookupShipmentDto } from './dto/lookup-shipment.dto.js';
import { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto.js';
import { ShipmentsService } from './shipments.service.js';
import {
  ShipmentOptionsQueryDto,
  ShipmentQuoteDto,
  AcceptShipmentDto,
  AssignShipmentDto,
  CollectShipmentPaymentDto,
  ResolveShipmentMoneyCaseDto,
} from './dto/shipment-operations.dto.js';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @OptionalAuth()
  @HttpCode(HttpStatus.CREATED)
  async createShipment(
    @Body() dto: CreateShipmentDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const data = await this.shipmentsService.createShipment(
      dto,
      principal?.taiKhoanId,
      idempotencyKey,
    );
    return { data };
  }

  @Get('options')
  @OptionalAuth()
  getShipmentOptions(@Query() query: ShipmentOptionsQueryDto) {
    return this.shipmentsService.getShipmentOptions(query);
  }

  @Get('routes/:routeId/route-points')
  @OptionalAuth()
  async getRoutePointsByRoute(@Param('routeId', ParseIntPipe) routeId: number) {
    return { data: await this.shipmentsService.getRoutePointsByRoute(routeId) };
  }

  @Post('quotes')
  @OptionalAuth()
  @HttpCode(HttpStatus.OK)
  async quoteShipment(@Body() dto: ShipmentQuoteDto) {
    return { data: await this.shipmentsService.quoteShipment(dto) };
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

  @Post(':id/money-cases/:caseId/resolve')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  resolveMoneyCase(
    @Param('id', ParseIntPipe) id: number,
    @Param('caseId', ParseIntPipe) caseId: number,
    @Body() dto: ResolveShipmentMoneyCaseDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.resolveMoneyCase(id, caseId, dto, principal);
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
  async lookupShipment(@Body() dto: LookupShipmentDto) {
    const data = await this.shipmentsService.lookupShipment(dto);
    return { data };
  }

  @Get('categories')
  @OptionalAuth()
  async getCargoCategories() {
    const data = await this.shipmentsService.getCargoCategories();
    return { data };
  }

  @Get('trips/:tripId/route-points')
  @OptionalAuth()
  async getRoutePoints(@Param('tripId', ParseIntPipe) tripId: number) {
    const data = await this.shipmentsService.getRoutePoints(tripId);
    return { data };
  }

  @Get(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES, 'KHACH_HANG')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
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
  @RequireRoles(...TENANT_PRINCIPAL_ROLES, 'KHACH_HANG')
  @RequireTenantPermissionsIfAuthenticated('shipment:read')
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
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:update')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShipmentStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.updateStatus(id, dto, principal);
  }
}
