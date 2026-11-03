import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseIntPipe,
  Query,
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
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CustomersService } from './customers.service.js';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto.js';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto.js';
import { AdminCustomerShipmentsQueryDto } from './dto/admin-customer-shipments-query.dto.js';
import { AdminCustomerTicketsQueryDto } from './dto/admin-customer-tickets-query.dto.js';
import { AdminCustomerTransactionsQueryDto } from './dto/admin-customer-transactions-query.dto.js';

@ApiTags('Khách hàng - Quản trị (Admin Customers)')
@ApiBearerAuth('JWT-auth')
@Controller('customers')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('customer:read')
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách khách hàng',
    description:
      'Lấy danh sách khách hàng trong hệ thống có phân trang, hỗ trợ tìm kiếm theo họ tên, số điện thoại, mã khách hàng và lọc theo trạng thái tài khoản.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách khách hàng thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem thông tin khách hàng (cần customer:read).',
    type: ApiErrorResponseDto,
  })
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminCustomerQueryDto,
  ) {
    return this.customersService.listAdminCustomers(principal, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết khách hàng',
    description:
      'Xem thông tin hồ sơ chi tiết của một khách hàng bao gồm mã KH, họ tên, số điện thoại, email, điểm tích lũy, CCCD và ngày tạo.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID tài khoản khách hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin chi tiết khách hàng thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mã khách hàng không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy khách hàng.',
    type: ApiErrorResponseDto,
  })
  getById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER_ID',
        message: 'Mã khách hàng không hợp lệ.',
      });
    }
    return this.customersService.getAdminCustomerById(principal, id);
  }

  @Patch(':id/status')
  @RequirePermissions('customer:update_status')
  @ApiOperation({
    summary: 'Cập nhật trạng thái tài khoản khách hàng',
    description:
      'Khóa hoặc mở khóa tài khoản khách hàng trong hệ thống kèm lý do bắt buộc.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID tài khoản khách hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái tài khoản khách hàng thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc mã khách hàng không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy khách hàng.',
    type: ApiErrorResponseDto,
  })
  updateStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerStatusDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER_ID',
        message: 'Mã khách hàng không hợp lệ.',
      });
    }
    return this.customersService.updateCustomerStatus(principal, id, dto);
  }

  @Get(':id/transactions')
  @ApiOperation({
    summary: 'Lịch sử giao dịch thanh toán của khách hàng',
    description:
      'Truy vấn lịch sử các giao dịch thanh toán đã phát sinh của khách hàng, có phân trang.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID tài khoản khách hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách giao dịch thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mã khách hàng không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  getTransactions(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminCustomerTransactionsQueryDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER_ID',
        message: 'Mã khách hàng không hợp lệ.',
      });
    }
    return this.customersService.listAdminCustomerTransactions(
      principal,
      id,
      query,
    );
  }

  @Get(':id/tickets')
  @ApiOperation({
    summary: 'Danh sách vé xe của khách hàng',
    description:
      'Truy vấn lịch sử tất cả các vé xe mà khách hàng này đã từng đặt hoặc mua, có phân trang.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID tài khoản khách hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách vé xe thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mã khách hàng không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  getTickets(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminCustomerTicketsQueryDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER_ID',
        message: 'Mã khách hàng không hợp lệ.',
      });
    }
    return this.customersService.listAdminCustomerTickets(
      principal,
      id,
      query,
    );
  }

  @Get(':id/shipments')
  @ApiOperation({
    summary: 'Danh sách đơn gửi hàng của khách hàng',
    description:
      'Truy vấn danh sách các bưu kiện/kiện hàng mà khách hàng này đã gửi hoặc nhận, có phân trang.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID tài khoản khách hàng',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách đơn gửi hàng thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Mã khách hàng không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  getShipments(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AdminCustomerShipmentsQueryDto,
  ) {
    if (id <= 0) {
      throw new BadRequestException({
        error: 'INVALID_CUSTOMER_ID',
        message: 'Mã khách hàng không hợp lệ.',
      });
    }
    return this.customersService.listAdminCustomerShipments(
      principal,
      id,
      query,
    );
  }
}
