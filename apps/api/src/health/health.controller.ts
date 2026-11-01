import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';

@ApiTags('Trạng thái hệ thống (Health Check)')
@Controller('health')
@Public()
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Kiểm tra trạng thái hoạt động của API (Health Check)',
    description:
      'Endpoint công khai không yêu cầu token, phục vụ health probe hoặc uptime monitoring để kiểm tra server backend đang chạy tốt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Server API đang hoạt động bình thường ({ status: "ok" }).',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  getHealth() {
    return { status: 'ok' };
  }
}
