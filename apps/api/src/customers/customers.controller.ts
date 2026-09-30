import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { CustomersService } from './customers.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

@Controller()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  getMe(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.customersService.getMe(principal.taiKhoanId);
  }

  @Patch('me')
  updateMe(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: UpdateMeDto,
  ) {
    return this.customersService.updateMe(principal.taiKhoanId, dto);
  }
}
