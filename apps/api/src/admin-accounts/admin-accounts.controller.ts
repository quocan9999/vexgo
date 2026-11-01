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
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AdminAccountsService } from './admin-accounts.service.js';
import { AdminAccountIdParamsDto } from './dto/admin-account-id-params.dto.js';
import { AdminAccountQueryDto } from './dto/admin-account-query.dto.js';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto.js';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto.js';
import { UpdateAdminAccountStatusDto } from './dto/update-admin-account-status.dto.js';
import { UpdateAdminAccountRolesDto } from './dto/update-admin-account-roles.dto.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Quản trị tài khoản Admin (Admin Accounts)')
@ApiBearerAuth('JWT-auth')
@Controller('admin-accounts')
@RequireRoles('SUPER_ADMIN')
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  @RequirePermissions('admin-account:read')
  @ApiOperation({
    summary: 'Danh sách tài khoản quản trị và nhân viên',
    description:
      'Lấy danh sách các tài khoản quản trị viên và nhân viên nhà xe trong toàn hệ thống, hỗ trợ lọc theo nhà xe, vai trò, trạng thái và ngày tạo.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:read`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tài khoản thành công kèm thông tin phân trang `meta`.',
  })
  @ApiResponse({
    status: 403,
    description: 'Không đủ quyền hạn truy cập.',
    type: ApiErrorResponseDto,
  })
  findAll(@Query() query: AdminAccountQueryDto) {
    return this.adminAccountsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('admin-account:read')
  @ApiOperation({
    summary: 'Chi tiết một tài khoản quản trị',
    description:
      'Truy vấn thông tin chi tiết của một tài khoản nhân viên hoặc quản trị viên theo ID.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:read`.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID tài khoản quản trị',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết tài khoản bao gồm danh sách vai trò và thông tin nhà xe.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tài khoản quản trị.',
    type: ApiErrorResponseDto,
  })
  findOne(@Param() params: AdminAccountIdParamsDto) {
    return this.adminAccountsService.findOne(params.id);
  }

  @Post()
  @RequirePermissions('admin-account:create')
  @ApiOperation({
    summary: 'Tạo tài khoản nhân viên/quản trị viên mới',
    description:
      'Khởi tạo tài khoản cho nhân viên thuộc một nhà xe chỉ định, cấp mã nhân viên và phân bổ vai trò ban đầu.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:create`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc số điện thoại đã tồn tại.',
    type: ApiErrorResponseDto,
  })
  create(@Body() body: CreateAdminAccountDto) {
    return this.adminAccountsService.create(body);
  }

  @Patch(':id')
  @RequirePermissions('admin-account:update')
  @ApiOperation({
    summary: 'Cập nhật thông tin tài khoản',
    description:
      'Chỉnh sửa các trường thông tin cơ bản của nhân viên: họ tên, ngày sinh, email, căn cước công dân.\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:update`.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID tài khoản cần cập nhật',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tài khoản thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tài khoản.',
    type: ApiErrorResponseDto,
  })
  update(
    @Param() params: AdminAccountIdParamsDto,
    @Body() body: UpdateAdminAccountDto,
  ) {
    return this.adminAccountsService.update(params.id, body);
  }

  @Patch(':id/status')
  @RequirePermissions('admin-account:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái hoạt động của tài khoản',
    description:
      'Khóa tài khoản (`TAM_KHOA`) để ngăn nhân viên đăng nhập hoặc mở khóa kích hoạt lại (`HOAT_DONG`).\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:update`.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID tài khoản',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Đổi trạng thái tài khoản thành công.',
  })
  updateStatus(
    @Param() params: AdminAccountIdParamsDto,
    @Body() body: UpdateAdminAccountStatusDto,
  ) {
    return this.adminAccountsService.updateStatus(params.id, body);
  }

  @Put(':id/roles')
  @RequirePermissions('admin-account:update')
  @ApiOperation({
    summary: 'Thay thế danh sách vai trò của tài khoản',
    description:
      'Cập nhật lại toàn bộ ma trận vai trò cho nhân viên (ví dụ: gán thêm quyền ĐIỀU_HÀNH hoặc BÁN_VÉ).\n\n- **Quyền hạn yêu cầu**: `SUPER_ADMIN` có quyền `admin-account:update`.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID tài khoản',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật vai trò thành công.',
  })
  replaceRoles(
    @Param() params: AdminAccountIdParamsDto,
    @Body() body: UpdateAdminAccountRolesDto,
  ) {
    return this.adminAccountsService.replaceRoles(params.id, body.roleNames);
  }
}
