import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { VehicleIdParamsDto } from './dto/vehicle-id-params.dto.js';
import { VehicleQueryDto } from './dto/vehicle-query.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto.js';
import { CreateVehicleSeatDto } from './dto/create-vehicle-seat.dto.js';
import {
  VehicleSeatCollectionParamsDto,
  VehicleSeatParamsDto,
} from './dto/vehicle-seat-params.dto.js';
import { UpdateVehicleSeatDto } from './dto/update-vehicle-seat.dto.js';
import { UpdateVehicleSeatLayoutDto } from './dto/vehicle-seat-layout.dto.js';
import { VehicleSeatFloorParamsDto } from './dto/vehicle-seat-floor-params.dto.js';
import { VehiclesService } from './vehicles.service.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Xe khách & Sơ đồ ghế (Vehicles & Seats)')
@ApiBearerAuth('JWT-auth')
@Controller('vehicles')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions('vehicle:create')
  @ApiOperation({
    summary: 'Đăng ký xe mới vào đội xe',
    description:
      'Tạo xe khách mới kèm biển số, nhà xe sở hữu, loại phương tiện và danh sách ghế khởi tạo ban đầu.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:create`.',
  })
  @ApiResponse({ status: 201, description: 'Đăng ký xe thành công.' })
  @ApiResponse({ status: 400, description: 'Biển số trùng hoặc dữ liệu không hợp lệ.', type: ApiErrorResponseDto })
  create(
    @Body() body: CreateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.create(body, principal);
  }

  @Patch(':id')
  @RequirePermissions('vehicle:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin xe',
    description:
      'Chỉnh sửa biển số hoặc loại xe của phương tiện.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy xe.', type: ApiErrorResponseDto })
  update(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @RequirePermissions('vehicle:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái hoạt động của xe',
    description:
      'Chuyển trạng thái xe: `HOAT_DONG` (sẵn sàng vận hành) hoặc `BAO_TRI` (đang bảo dưỡng, không thể gán vào chuyến xe mới).\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái xe thành công.' })
  updateStatus(
    @Param() params: VehicleIdParamsDto,
    @Body() body: UpdateVehicleStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateStatus(params.id, body, principal);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('vehicle:delete')
  @ApiOperation({
    summary: 'Xóa xe khỏi hệ thống',
    description:
      'Xóa xe khỏi danh sách quản lý của nhà xe.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:delete`.',
  })
  @ApiParam({ name: 'id', description: 'ID xe cần xóa', example: 1 })
  @ApiResponse({ status: 204, description: 'Xóa xe thành công.' })
  delete(
    @Param() params: VehicleIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.delete(params.id, principal);
  }

  @Get()
  @RequirePermissions('vehicle:read')
  @ApiOperation({
    summary: 'Danh sách phương tiện của nhà xe',
    description:
      'Truy vấn danh sách đội xe thuộc nhà xe của tài khoản đang đăng nhập, hỗ trợ phân trang và lọc theo trạng thái/loại xe.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:read`.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách xe thành công.' })
  findAll(
    @Query() query: VehicleQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findAll(query, principal);
  }

  @Get(':id')
  @RequirePermissions('vehicle:read')
  @ApiOperation({
    summary: 'Chi tiết một phương tiện',
    description:
      'Xem thông tin cấu hình chi tiết và thông số kỹ thuật của xe.\n\n- **Quyền hạn yêu cầu**: Quyền `vehicle:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết thông tin xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy xe.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: VehicleIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findOne(params.id, principal);
  }

  @Get(':vehicleId/seats')
  @RequirePermissions('seat:read')
  @ApiOperation({
    summary: 'Lấy sơ đồ và danh sách ghế của xe',
    description:
      'Lấy toàn bộ danh sách ghế, mã ghế (A01, B02...), tầng và tọa độ bố trí sơ đồ của xe.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:read`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Danh sách ghế và sơ đồ bố trí thành công.' })
  findSeats(
    @Param() params: VehicleSeatCollectionParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.findSeats(params.vehicleId, principal);
  }

  @Post(':vehicleId/seats')
  @RequirePermissions('seat:create')
  @ApiOperation({
    summary: 'Thêm một ghế mới vào xe',
    description:
      'Thêm một ghế đơn lẻ vào sơ đồ xe với tên ghế và tọa độ vị trí.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:create`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 201, description: 'Thêm ghế thành công.' })
  @ApiResponse({ status: 400, description: 'Trùng tên ghế hoặc vị trí tọa độ.', type: ApiErrorResponseDto })
  createSeat(
    @Param() params: VehicleSeatCollectionParamsDto,
    @Body() body: CreateVehicleSeatDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.createSeat(params.vehicleId, body, principal);
  }

  @Patch(':vehicleId/seats/layout')
  @RequirePermissions('seat:update')
  @ApiOperation({
    summary: 'Cập nhật lại toàn bộ sơ đồ bố trí ghế',
    description:
      'Điều chỉnh hàng loạt vị trí tọa độ X, Y và tầng của các ghế trên xe.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:update`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật sơ đồ ghế thành công.' })
  updateSeatLayout(
    @Param() params: VehicleSeatCollectionParamsDto,
    @Body() body: UpdateVehicleSeatLayoutDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateSeatLayout(
      params.vehicleId,
      body,
      principal,
    );
  }

  @Delete(':vehicleId/seats/floors/:floor')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('seat:delete')
  @ApiOperation({
    summary: 'Xóa toàn bộ ghế của một tầng xe',
    description:
      'Xóa sạch các ghế thuộc tầng trên (tầng 2) khi cấu hình chuyển đổi sơ đồ xe.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:delete`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiParam({ name: 'floor', description: 'Số tầng cần xóa ghế (chỉ cho phép tầng 2)', example: 2 })
  @ApiResponse({ status: 200, description: 'Xóa tầng ghế thành công.' })
  deleteSeatFloor(
    @Param() params: VehicleSeatFloorParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.deleteSeatFloor(
      params.vehicleId,
      params.floor,
      principal,
    );
  }

  @Patch(':vehicleId/seats/:seatId')
  @RequirePermissions('seat:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin một ghế',
    description:
      'Chỉnh sửa tên ghế, vị trí mô tả hoặc tọa độ của một ghế đơn lẻ.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:update`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiParam({ name: 'seatId', description: 'ID ghế cần cập nhật', example: 10 })
  @ApiResponse({ status: 200, description: 'Cập nhật ghế thành công.' })
  updateSeat(
    @Param() params: VehicleSeatParamsDto,
    @Body() body: UpdateVehicleSeatDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.updateSeat(
      params.vehicleId,
      params.seatId,
      body,
      principal,
    );
  }

  @Delete(':vehicleId/seats/:seatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('seat:delete')
  @ApiOperation({
    summary: 'Xóa một ghế khỏi xe',
    description:
      'Xóa một vị trí ghế cụ thể khỏi sơ đồ xe.\n\n- **Quyền hạn yêu cầu**: Quyền `seat:delete`.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID xe', example: 1 })
  @ApiParam({ name: 'seatId', description: 'ID ghế cần xóa', example: 10 })
  @ApiResponse({ status: 204, description: 'Xóa ghế thành công.' })
  deleteSeat(
    @Param() params: VehicleSeatParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.vehiclesService.deleteSeat(
      params.vehicleId,
      params.seatId,
      principal,
    );
  }
}
