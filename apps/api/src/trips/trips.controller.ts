import { TripCodeQueryDto } from './dto/trip-code-query.dto.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TripsService } from './trips.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import { TripQueryDto } from './dto/trip-query.dto.js';
import { TripIdParamsDto } from './dto/trip-id-params.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto.js';
import { TripSeatsQueryDto } from './dto/trip-seats-query.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Chuyến xe & Lịch trình (Trips)')
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('search')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Tìm kiếm chuyến xe cho khách hàng',
    description:
      'Tìm kiếm các chuyến xe phù hợp theo điểm đi, điểm đến, ngày khởi hành, khoảng giá vé, loại xe, nhà xe và phân trang.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({ status: 200, description: 'Danh sách các chuyến xe tìm thấy kèm thông tin giá vé và số ghế trống.' })
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.search(query);
  }

  @Get('code-preview')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:create')
  @ApiOperation({
    summary: 'Xem trước mã chuyến xe tự động sinh',
    description:
      'Gợi ý mã chuyến xe tiếp theo dựa trên ngày khởi hành.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:create`.',
  })
  @ApiResponse({ status: 200, description: 'Gợi ý mã chuyến xe thành công.' })
  previewCode(@Query() query: TripCodeQueryDto, @CurrentPrincipal() principal: AuthPrincipal) {
    return this.tripsService.previewCode(query.departureDate, principal);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:create')
  @ApiOperation({
    summary: 'Lên lịch tạo chuyến xe mới',
    description:
      'Tạo chuyến xe mới, tự động khởi tạo danh sách ghế của chuyến dựa trên sơ đồ xe đã chọn và tính toán bảng giá áp dụng.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:create`.',
  })
  @ApiResponse({ status: 201, description: 'Tạo chuyến xe thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc xe/tài xế đã bận vào thời gian này.', type: ApiErrorResponseDto })
  create(
    @Body() body: CreateTripDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.create(body, principal);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  @ApiOperation({
    summary: 'Danh sách chuyến xe (Dành cho Quản trị)',
    description:
      'Lấy danh sách các chuyến xe thuộc nhà xe của tài khoản đang đăng nhập, hỗ trợ lọc theo tuyến xe, xe, ngày khởi hành và phân trang.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:read`.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách chuyến xe thành công.' })
  findAll(
    @Query() query: TripQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.findAll(query, principal);
  }

  @Get(':id/operational-detail')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  @ApiOperation({
    summary: 'Chi tiết vận hành chuyến xe',
    description:
      'Xem thông tin chi tiết điều độ vận hành của chuyến xe (tài xế, phụ xe, tổng số vé bán, doanh thu tạm tính, trạng thái xuất bến).\n\n- **Quyền hạn yêu cầu**: Quyền `trip:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Chi tiết vận hành chuyến xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chuyến xe.', type: ApiErrorResponseDto })
  findOne(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.findOne(params.id, principal);
  }

  @Get(':id/seat-inventory')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:read')
  @ApiOperation({
    summary: 'Xem tồn kho ghế chuyến xe (Dành cho Quản trị)',
    description:
      'Tra cứu toàn bộ ma trận ghế của chuyến xe và trạng thái chi tiết của từng ghế (trống, đang giữ, đã bán, thông tin khách đặt).\n\n- **Quyền hạn yêu cầu**: Quyền `trip:read`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Danh sách chi tiết trạng thái ghế.' })
  getSeatInventory(
    @Param() params: TripIdParamsDto,
    @Query() query: TripSeatsQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.getSeats(params.id, query, principal);
  }

  @Get(':id/cargo-capacity')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Kiểm tra sức chứa hàng hóa còn lại của chuyến xe',
    description:
      'Truy vấn tải trọng và dung tích khoang hàng còn lại của chuyến xe để xác nhận khả năng nhận thêm hàng ký gửi.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Thông tin sức chứa khoang hàng còn lại.' })
  getCargoCapacity(@Param() params: TripIdParamsDto) {
    return this.tripsService.getCargoCapacity(params.id);
  }

  @Get(':id/seats')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Sơ đồ ghế chuyến xe cho khách chọn chỗ',
    description:
      'Lấy danh sách ghế, mã ghế, giá vé và trạng thái (trống, đang giữ, đã đặt) để khách hàng chọn ghế khi mua vé.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Sơ đồ ghế chuyến xe.' })
  getCustomerSeats(@Param() params: TripIdParamsDto) {
    return this.tripsService.getCustomerSeats(params.id);
  }

  @Get(':id/alternatives')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Gợi ý các chuyến xe thay thế lân cận',
    description:
      'Gợi ý các chuyến xe cùng tuyến đường chạy lân cận (cùng nhà xe hoặc khác nhà xe) khi chuyến xe hiện tại đã hết vé hoặc khách muốn so sánh.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiQuery({ name: 'limit', required: false, description: 'Số lượng chuyến gợi ý tối đa', example: '5' })
  @ApiQuery({ name: 'otherOperatorsOnly', required: false, description: 'Chỉ tìm chuyến của nhà xe khác', example: 'true' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Mức giá tối đa cho chuyến thay thế', example: '350000' })
  @ApiResponse({ status: 200, description: 'Danh sách các chuyến xe thay thế.' })
  getTripAlternatives(
    @Param() params: TripIdParamsDto,
    @Query('limit') limit?: string,
    @Query('otherOperatorsOnly') otherOperatorsOnly?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    const onlyOther =
      otherOperatorsOnly !== undefined ? otherOperatorsOnly === 'true' : true;
    const maxP = maxPrice ? Number(maxPrice) : undefined;
    return this.tripsService.getTripAlternatives(
      params.id,
      limit ? Number(limit) : 5,
      onlyOther,
      maxP,
    );
  }

  @Get(':id')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Chi tiết chuyến xe công khai',
    description:
      'Lấy thông tin chi tiết một chuyến xe: thời gian khởi hành, dự kiến đến nơi, tuyến đường, điểm đón trả và thông tin nhà xe.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Chi tiết thông tin chuyến xe.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chuyến xe.', type: ApiErrorResponseDto })
  getDetails(@Param() params: TripIdParamsDto) {
    return this.tripsService.getDetails(params.id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  @ApiOperation({
    summary: 'Cập nhật lịch chạy chuyến xe',
    description:
      'Chỉnh sửa ngày hoặc giờ khởi hành của chuyến xe.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe cần cập nhật', example: 101 })
  @ApiResponse({ status: 200, description: 'Cập nhật chuyến xe thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy chuyến xe.', type: ApiErrorResponseDto })
  update(
    @Param() params: TripIdParamsDto,
    @Body() body: UpdateTripDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái vận hành của chuyến xe',
    description:
      'Cập nhật tiến trình chạy: `CHUA_KHOI_HANH` -> `DANG_CHAY` -> `HOAN_THANH`.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:update`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe', example: 101 })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công.' })
  updateStatus(
    @Param() params: TripIdParamsDto,
    @Body() body: UpdateTripStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.updateStatus(params.id, body, principal);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('trip:cancel')
  @ApiOperation({
    summary: 'Hủy chuyến xe chính thức',
    description:
      'Hủy bỏ chuyến xe và kích hoạt chính sách xử lý hoàn tiền hoặc dời vé tự động cho hành khách đã mua vé.\n\n- **Quyền hạn yêu cầu**: Quyền `trip:cancel`.',
  })
  @ApiParam({ name: 'id', description: 'ID chuyến xe cần hủy', example: 101 })
  @ApiResponse({ status: 200, description: 'Hủy chuyến xe thành công.' })
  cancel(
    @Param() params: TripIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.tripsService.cancel(params.id, principal);
  }
}
