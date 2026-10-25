import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PromotionsService } from './promotions.service.js';
import { AvailablePromotionsQueryDto } from './dto/available-promotions-query.dto.js';
import { CreatePromotionDto } from './dto/create-promotion.dto.js';
import { PromotionIdParamsDto } from './dto/promotion-id-params.dto.js';
import { PromotionListQueryDto } from './dto/promotion-list-query.dto.js';
import { UpdatePromotionDto } from './dto/update-promotion.dto.js';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto.js';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('available')
  @OptionalAuth()
  findAvailable(@Query() query: AvailablePromotionsQueryDto) {
    return this.promotionsService.findAvailablePromotions(query);
  }

  @Get()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:read')
  findAll(
    @Query() query: PromotionListQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findAll(query, principal);
  }

  @Get(':id')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:read')
  findOne(
    @Param() params: PromotionIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findOne(params.id, principal);
  }

  @Post()
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:create')
  create(
    @Body() body: CreatePromotionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.create(body, principal);
  }

  @Patch(':id')
  @RequirePermissions('promotion:update')
  update(
    @Param() params: PromotionIdParamsDto,
    @Body() body: UpdatePromotionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:update')
  updateStatus(
    @Param() params: PromotionIdParamsDto,
    @Body() body: UpdatePromotionStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.updateStatus(
      params.id,
      body.status,
      principal,
    );
  }
}

