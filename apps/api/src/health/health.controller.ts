import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}
