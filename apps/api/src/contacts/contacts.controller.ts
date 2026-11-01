import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import {
  PUBLIC_CONTACT_RATE_LIMIT,
  PUBLIC_RATE_LIMIT_TTL_MS,
} from '../common/rate-limit-policy.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { ContactsService } from './contacts.service.js';
import { ContactQueryDto } from './dto/contact-query.dto.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto.js';

@ApiTags('Liên hệ & Góp ý (Contacts)')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_CONTACT_RATE_LIMIT,
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Gửi yêu cầu liên hệ hoặc góp ý (Công khai có rate limit)',
    description:
      'Người dùng gửi biểu mẫu liên hệ, phản hồi hoặc yêu cầu hợp tác tới ban quản trị sàn VexGo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gửi liên hệ thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  create(@Body() body: CreateContactDto) {
    return this.contactsService.create(body);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Danh sách các yêu cầu liên hệ (Super Admin)',
    description:
      'Quản trị viên sàn xem danh sách tất cả các yêu cầu liên hệ gửi đến, hỗ trợ lọc theo trạng thái xử lý và phân trang.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách liên hệ thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền truy cập (yêu cầu SUPER_ADMIN).',
    type: ApiErrorResponseDto,
  })
  findAll(@Query() query: ContactQueryDto) {
    return this.contactsService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Chi tiết yêu cầu liên hệ (Super Admin)',
    description: 'Xem toàn bộ nội dung của một thư liên hệ / góp ý theo ID.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID liên hệ',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết liên hệ thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy liên hệ.',
    type: ApiErrorResponseDto,
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'Cập nhật trạng thái xử lý liên hệ (Super Admin)',
    description: 'Chuyển đổi trạng thái xử lý thư liên hệ (CHO_XU_LY, DANG_XU_LY, DA_XU_LY, HUY_BO).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID liên hệ',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái liên hệ thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Trạng thái không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateContactStatusDto,
  ) {
    return this.contactsService.updateStatus(id, body.status);
  }
}
