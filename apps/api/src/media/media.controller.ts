import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  MediaItemParamsDto,
  MediaVehicleParamsDto,
  UploadVehicleImageDto,
} from './dto/media.dto.js';
import { MAX_IMAGE_BYTES } from './media-image.js';
import { MediaService } from './media.service.js';

@ApiTags('Media')
@Controller('media/vehicles')
export class PublicVehicleMediaController {
  constructor(private readonly media: MediaService) {}

  @Public()
  @Get(':vehicleId/images')
  @ApiOperation({ summary: 'Ảnh công khai của xe, dùng chung Web/Mobile' })
  list(@Param() params: MediaVehicleParamsDto) {
    return this.media.listPublic(params.vehicleId);
  }
}

@ApiTags('Media')
@ApiBearerAuth('JWT-auth')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@Controller('media/vehicles')
export class VehicleMediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':vehicleId/images/manage')
  @RequirePermissions('vehicle:read')
  listManaged(
    @Param() params: MediaVehicleParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.media.listManaged(params.vehicleId, principal);
  }

  @Post(':vehicleId/images')
  @RequirePermissions('vehicle:update')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_IMAGE_BYTES,
        files: 1,
        fields: 1,
        fieldSize: 128,
        parts: 2,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'requestId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        requestId: { type: 'string', format: 'uuid' },
      },
    },
  })
  upload(
    @Param() params: MediaVehicleParamsDto,
    @Body() body: UploadVehicleImageDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.media.upload(params.vehicleId, body.requestId, file, principal);
  }

  @Post(':vehicleId/images/:mediaId/reconcile')
  @HttpCode(200)
  @RequirePermissions('vehicle:update')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reconcile(
    @Param() params: MediaItemParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.media.reconcile(params.vehicleId, params.mediaId, principal);
  }

  @Delete(':vehicleId/images/:mediaId')
  @HttpCode(204)
  @RequirePermissions('vehicle:update')
  remove(
    @Param() params: MediaItemParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.media.remove(params.vehicleId, params.mediaId, principal);
  }
}
