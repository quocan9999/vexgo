import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto.js';
import { VehicleTypeIdParamsDto } from './dto/vehicle-type-id-params.dto.js';
import { VehicleTypeQueryDto } from './dto/vehicle-type-query.dto.js';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto.js';
import { VehicleTypesService } from './vehicle-types.service.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Loại phương tiện (Vehicle Types)')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-types')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class VehicleTypesController {
  constructor(private readonly vehicleTypesService: VehicleTypesService) {}

  @Get()
  @RequirePermissions('vehicle-type:read')
  @ApiOperation({
    summary: 'Danh sách các loại xe',
    description:
      'Lấy danh sách các dòng loại xe (Giường nằm, Limousine, Ghế ngồi...) của nhà xe đang đăng nhập.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle-type:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách loại xe thành công.' })
  findAll(
    @Query() query: VehicleTypeQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.findAll(query, principal);
  }

  @Get(':id')
  @RequirePermissions('vehicle-type:read')
  @ApiOperation({
    summary: 'Chi tiết loại xe',
    description:
      'Xem thông tin chi tiết một loại xe và các thông số cấu hình khoang hàng mặc định.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle-type:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID loại xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết loại xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại xe.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: VehicleTypeIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.findOne(params.id, principal);
  }

  @Post()
  @RequirePermissions('vehicle-type:create')
  @ApiOperation({
    summary: 'Tạo loại xe mới',
    description:
      'Định nghĩa dòng loại xe mới cho nhà xe kèm định mức sức chứa hàng hóa mặc định.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle-type:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo loại xe thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ.', type: ApiErrorResponseDto })
  create(
    @Body() body: CreateVehicleTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.create(body, principal);
  }

  @Patch(':id')
  @RequirePermissions('vehicle-type:update')
  @ApiOperation({
    summary: 'Cập nhật loại xe',
    description:
      'Chỉnh sửa tên loại xe, tiện ích mô tả hoặc dung tích khoang hàng mặc định.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle-type:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID loại xe cần cập nhật', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật loại xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy loại xe.', type: ApiErrorResponseDto })
  update(
    @Param() params: VehicleTypeIdParamsDto,
    @Body() body: UpdateVehicleTypeDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehicleTypesService.update(params.id, body, principal);
  }
}
