import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PromotionsService } from './promotions.service.js';
import { CreatePromotionDto } from './dto/create-promotion.dto.js';
import { PromotionIdParamsDto } from './dto/promotion-id-params.dto.js';
import { PromotionListQueryDto } from './dto/promotion-list-query.dto.js';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto.js';

@Controller('promotions')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @RequirePermissions('promotion:read')
  findAll(
    @Query() query: PromotionListQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findAll(query, principal);
  }

  @Get(':id')
  @RequirePermissions('promotion:read')
  findOne(
    @Param() params: PromotionIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findOne(params.id, principal);
  }

  @Post()
  @RequirePermissions('promotion:create')
  create(
    @Body() body: CreatePromotionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.create(body, principal);
  }

  @Patch(':id/status')
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
