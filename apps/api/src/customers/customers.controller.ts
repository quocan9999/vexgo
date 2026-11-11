import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CustomersService } from './customers.service.js';
import { UpdateMeDto } from './dto/update-me.dto.js';

@ApiTags('Thông tin cá nhân khách hàng (Customer Profile)')
@ApiBearerAuth('JWT-auth')
@Controller()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Lấy thông tin tài khoản cá nhân',
    description:
      'Trả về thông tin hồ sơ của tài khoản khách hàng đang đăng nhập, bao gồm họ tên, số điện thoại, email, ngày sinh, CCCD và điểm tích lũy.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin hồ sơ cá nhân thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  getMe(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.customersService.getMe(principal.taiKhoanId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Cập nhật thông tin tài khoản cá nhân',
    description:
      'Cập nhật thông tin cá nhân của khách hàng như họ tên, ngày sinh, email liên hệ hoặc số căn cước công dân.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thông tin cá nhân thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu cập nhật không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  updateMe(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: UpdateMeDto,
  ) {
    return this.customersService.updateMe(principal.taiKhoanId, dto);
  }
}
