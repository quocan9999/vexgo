import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:create')
  create(
    @Body() body: CreateRouteDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.routesService.create(body, principal);
  }

  @Patch(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
  update(
    @Param() params: RouteIdParamsDto,
    @Body() body: UpdateRouteDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.routesService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('route:update')
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
  findAll(
    @Query() query: RouteQueryDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.routesService.findAll(query, principal);
  }

  @Get(':id')
  @OptionalAuth()
  @RequireTenantPermissionsIfAuthenticated('route:read')
  findOne(
    @Param() params: RouteIdParamsDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.routesService.findOne(params.id, principal);
  }
}
