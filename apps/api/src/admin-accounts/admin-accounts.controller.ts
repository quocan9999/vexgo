import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { AdminAccountsService } from './admin-accounts.service.js';
import { AdminAccountIdParamsDto } from './dto/admin-account-id-params.dto.js';
import { AdminAccountQueryDto } from './dto/admin-account-query.dto.js';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto.js';
import { UpdateAdminAccountDto } from './dto/update-admin-account.dto.js';
import { UpdateAdminAccountStatusDto } from './dto/update-admin-account-status.dto.js';

@Controller('admin-accounts')
@RequireRoles('SUPER_ADMIN')
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  @RequirePermissions('admin-account:read')
  findAll(@Query() query: AdminAccountQueryDto) {
    return this.adminAccountsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('admin-account:read')
  findOne(@Param() params: AdminAccountIdParamsDto) {
    return this.adminAccountsService.findOne(params.id);
  }

  @Post()
  @RequirePermissions('admin-account:create')
  create(@Body() body: CreateAdminAccountDto) {
    return this.adminAccountsService.create(body);
  }

  @Patch(':id')
  @RequirePermissions('admin-account:update')
  update(
    @Param() params: AdminAccountIdParamsDto,
    @Body() body: UpdateAdminAccountDto,
  ) {
    return this.adminAccountsService.update(params.id, body);
  }

  @Patch(':id/status')
  @RequirePermissions('admin-account:update')
  updateStatus(
    @Param() params: AdminAccountIdParamsDto,
    @Body() body: UpdateAdminAccountStatusDto,
  ) {
    return this.adminAccountsService.updateStatus(params.id, body);
  }
}
