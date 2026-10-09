import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import { ShipmentsService } from './shipments.service.js';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:read')
  findAll(
    @Query() query: ShipmentQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.findAll(query, principal);
  }

  @Get(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('shipment:read')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.shipmentsService.findOne(id, principal);
  }
}
