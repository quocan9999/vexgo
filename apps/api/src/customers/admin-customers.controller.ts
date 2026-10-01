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
}
