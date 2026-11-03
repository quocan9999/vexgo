import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { LocationsService } from './locations.service.js';

@ApiTags('Địa điểm & Tỉnh thành (Locations)')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Danh sách tỉnh thành và địa điểm hành chính',
    description:
      'Lấy toàn bộ danh mục các tỉnh/thành phố và quận/huyện phục vụ chức năng tìm kiếm điểm đi và điểm đến cho khách hàng.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách địa điểm hành chính trên toàn quốc.',
  })
  list() {
    return this.locations.list();
  }
}
