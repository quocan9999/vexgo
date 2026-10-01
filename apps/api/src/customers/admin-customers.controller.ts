import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { CustomersService } from './customers.service.js';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto.js';
import { AdminCustomerTransactionsQueryDto } from './dto/admin-customer-transactions-query.dto.js';
import { AdminCustomerTicketsQueryDto } from './dto/admin-customer-tickets-query.dto.js';

@Controller('customers')
@RequireRoles(...TENANT_PRINCIPAL_ROLES)
@RequirePermissions('customer:read')
export class AdminCustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminCustomerQueryDto,
  ) {
    return this.customersService.listAdminCustomers(principal, query);
  }

  @Get(':id')
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

  @Get(':id/transactions')
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
}
