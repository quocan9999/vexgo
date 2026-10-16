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

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @OptionalAuth()
  @HttpCode(HttpStatus.CREATED)
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
