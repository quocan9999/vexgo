import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator.js';
import { AiChatbotSettingsService } from './ai-chatbot-settings.service.js';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto.js';
import { ApiErrorResponseDto } from '../../common/swagger/api-response-envelope.dto.js';

@ApiTags('Admin - Cấu hình Hệ thống AI (AI Settings Management)')
@ApiBearerAuth('JWT-auth')
@Controller('ai-chatbot/admin/settings')
@RequireRoles('SUPER_ADMIN')
export class AiChatbotSettingsController {
  constructor(
    private readonly settingsService: AiChatbotSettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Đọc cấu hình hệ thống AI hiện hành',
    description:
      'Chỉ Super Admin có quyền xem các tham số hệ thống AI: TTL chống gửi trùng, thời hạn lease crash window, giới hạn ngữ cảnh và nhiệt độ sinh.',
  })
  @ApiResponse({
    status: 200,
    description: 'Thông tin cấu hình hệ thống AI hiện hành.',
  })
  async getSettings() {
    const data = await this.settingsService.getSettings();
    return { data };
  }

  @Put()
  @ApiOperation({
    summary: 'Cập nhật cấu hình hệ thống AI',
    description:
      'Chỉ Super Admin có quyền cập nhật các tham số hệ thống AI: TTL chống gửi trùng (1-90 ngày), thời hạn lease (10-300 giây), giới hạn ngữ cảnh (0-50 tin), nhiệt độ sinh (0.0-1.0).',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật cấu hình hệ thống AI thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu cấu hình không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  async updateSettings(@Body() dto: UpdateAiSettingsDto) {
    const data = await this.settingsService.updateSettings(dto);
    return { data };
  }
}
