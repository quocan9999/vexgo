import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateBusCompanyDto } from './dto/create-bus-company.dto.js';
import { BusCompanyIdParamsDto } from './dto/bus-company-id-params.dto.js';
import { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { UpdateBusCompanyDto } from './dto/update-bus-company.dto.js';
import { UpdateBusCompanyStatusDto } from './dto/update-bus-company-status.dto.js';
import { UpdateLuggageRatesDto } from './dto/luggage-rates.dto.js';
import { BusCompaniesService } from './bus-companies.service.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import {
  assertTenantScope,
  requireTenantPrincipal,
} from '../auth/tenant-scope.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Nhà xe & Đối tác vận tải (Bus Companies)')
@Controller('bus-companies')
export class BusCompaniesController {
  constructor(private readonly busCompaniesService: BusCompaniesService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:create')
  @ApiOperation({
    summary: 'Tạo đối tác nhà xe mới',
    description:
      'Đăng ký một đơn vị vận tải / nhà xe mới vào nền tảng VexGo.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `bus-company:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo nhà xe thành công.' })
  @ApiResponse({ status: 400, description: 'Mã nhà xe hoặc thông tin không hợp lệ.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Không đủ quyền hạn.', type: ApiErrorResponseDto })
  create(@Body() body: CreateBusCompanyDto) {
    return this.busCompaniesService.create(body);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin nhà xe',
    description:
      'Chỉnh sửa tên thương hiệu, mã định danh hoặc thông tin liên hệ của nhà xe.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `bus-company:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID nhà xe cần cập nhật', example: 1 })
  @ApiResponse({ status: 200, description: 'Cập nhật nhà xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhà xe.', type: ApiErrorResponseDto })
  update(
    @Param() params: BusCompanyIdParamsDto,
    @Body() body: UpdateBusCompanyDto,
  ) {
    return this.busCompaniesService.update(params.id, body);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('bus-company:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái hoạt động của nhà xe',
    description:
      'Chuyển đổi trạng thái hoạt động: `HOAT_DONG` hoặc tạm ngừng dịch vụ `TAM_NGUNG`.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `bus-company:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID nhà xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Đổi trạng thái thành công.' })
  updateStatus(
    @Param() params: BusCompanyIdParamsDto,
    @Body() body: UpdateBusCompanyStatusDto,
  ) {
    return this.busCompaniesService.updateStatus(params.id, body);
  }

  @Get()
  @OptionalAuth()
  @ApiOperation({
    summary: 'Danh sách nhà xe',
    description:
      'Lấy danh sách các nhà xe đối tác trên nền tảng, có hỗ trợ tìm kiếm theo tên/mã, lọc theo trạng thái và phân trang.\n\n- **Quyền truy cập**: Công khai (Public). Quản trị viên khi đăng nhập sẽ thấy thêm thông tin quản trị.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách nhà xe thành công.' })
  findAll(
    @Query() query: BusCompanyQueryDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.busCompaniesService.findAll(query, principal);
  }

  @Get(':id')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Chi tiết thông tin nhà xe',
    description:
      'Xem thông tin chi tiết của một nhà xe, chính sách dịch vụ và điểm đánh giá trung bình.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID nhà xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết nhà xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy nhà xe.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: BusCompanyIdParamsDto,
    @OptionalPrincipal() principal: AuthPrincipal | undefined,
  ) {
    return this.busCompaniesService.findOne(params.id, principal);
  }

  @Get('my/luggage-rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('luggage-rate:read')
  @ApiOperation({
    summary: 'Lấy cấu hình cước hành lý của nhà xe hiện tại',
  })
  getMyLuggageRates(@CurrentPrincipal() principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    return this.busCompaniesService.getLuggageRates(nhaXeId, principal);
  }

  @Put('my/luggage-rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('luggage-rate:update')
  @ApiOperation({
    summary: 'Cập nhật cấu hình cước hành lý của nhà xe hiện tại',
  })
  updateMyLuggageRates(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() body: UpdateLuggageRatesDto,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    return this.busCompaniesService.updateLuggageRates(
      nhaXeId,
      body,
      principal,
    );
  }

  @Get(':id/luggage-rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('luggage-rate:read')
  @ApiOperation({
    summary: 'Lấy cấu hình cước hành lý theo ID nhà xe',
  })
  getLuggageRates(
    @Param() params: BusCompanyIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const trustedNhaXeId = requireTenantPrincipal(principal);
    assertTenantScope(params.id, trustedNhaXeId);
    return this.busCompaniesService.getLuggageRates(params.id, principal);
  }

  @Put(':id/luggage-rates')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('luggage-rate:update')
  @ApiOperation({
    summary: 'Cập nhật cấu hình cước hành lý theo ID nhà xe',
  })
  updateLuggageRates(
    @Param() params: BusCompanyIdParamsDto,
    @Body() body: UpdateLuggageRatesDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    const trustedNhaXeId = requireTenantPrincipal(principal);
    assertTenantScope(params.id, trustedNhaXeId);
    return this.busCompaniesService.updateLuggageRates(
      params.id,
      body,
      principal,
    );
  }

  @Get('trips/:tripId/luggage-packages')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Lấy bảng giá gói hành lý áp dụng cho chuyến xe (Public)',
  })
  getTripLuggagePackages(@Param('tripId') tripId: string) {
    return this.busCompaniesService.getTripLuggageRates(Number(tripId));
  }
}
