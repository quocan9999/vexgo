import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TripIdParamsDto } from './dto/trip-id-params.dto.js';
import { TripDeletionService } from './trip-deletion.service.js';

@Controller('trips')
export class TripDeletionController {
  constructor(private readonly tripDeletionService: TripDeletionService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:delete')
  delete(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripDeletionService.delete(params.id, principal);
  }
}
