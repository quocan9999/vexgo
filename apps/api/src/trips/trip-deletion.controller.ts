import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
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
import { TripIdParamsDto } from './dto/trip-id-params.dto.js';
import { TripDeletionService } from './trip-deletion.service.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Chuyến xe & Lịch trình (Trips)')
@ApiBearerAuth('JWT-auth')
@Controller('trips')
export class TripDeletionController {
  constructor(private readonly tripDeletionService: TripDeletionService) {}

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:delete')
  @ApiOperation({
    summary: 'Xóa chuyến xe',
    description:
      'Xóa vĩnh viễn chuyến xe khỏi hệ thống (chỉ được phép khi chuyến xe chưa phát sinh vé bán hoặc giao dịch nào).\n\n- **Quyền hạn yêu cầu**: Quyền `trip:delete`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe cần xóa', example: 101 })
  @ApiResponse({ status: 200, description: 'Xóa chuyến xe thành công.' })
  @ApiResponse({ status: 400, description: 'Chuyến xe đã có vé được bán, không thể xóa.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chuyến xe.', type: ApiErrorResponseDto })
  delete(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripDeletionService.delete(params.id, principal);
  }
}
