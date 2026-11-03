import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentPrincipal,
  OptionalPrincipal,
} from '../auth/decorators/current-principal.decorator.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from './bookings.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { BookingQuoteDto } from './dto/booking-quote.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Đặt vé & Báo giá (Bookings)')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @OptionalAuth()
  @Post('quote')
  @ApiOperation({
    summary: 'Tính toán trước báo giá đặt vé',
    description:
      'Tính tổng tiền vé, kiểm tra và tính toán mức giảm trừ của mã khuyến mãi (nếu có), phụ phí điểm đón/trả và trả về báo giá chi tiết trước khi đặt vé.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({ status: 200, description: 'Báo giá thành công.' })
  @ApiResponse({ status: 400, description: 'Thông tin chuyến hoặc ghế không hợp lệ.', type: ApiErrorResponseDto })
  async getBookingQuote(
    @Body() dto: BookingQuoteDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.bookingsService.getBookingQuote(
      dto.tripId,
      dto.seatIds,
      dto.promotionCode,
      dto.contactPhone,
      principal,
      dto.diemDonChuyenXeId,
      dto.diemTraChuyenXeId,
    );
    return { data };
  }

  @Post()
  @OptionalAuth()
  @ApiOperation({
    summary: 'Khởi tạo đơn đặt vé chính thức',
    description:
      'Khởi tạo đơn đặt vé từ phiên giữ chỗ ghế hợp lệ (`holdToken`), lưu thông tin hành khách, điểm đón/trả và khởi tạo trạng thái `CHO_THANH_TOAN`.\n\n- **Quyền truy cập**: Công khai (Public) hoặc Khách hàng.',
  })
  @ApiResponse({ status: 201, description: 'Tạo đơn đặt vé thành công, trả về thông tin đơn và hạn chót thanh toán.' })
  @ApiResponse({ status: 400, description: 'Phiên giữ chỗ hết hạn hoặc dữ liệu không hợp lệ.', type: ApiErrorResponseDto })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @OptionalPrincipal() principal?: AuthPrincipal,
  ) {
    const data = await this.bookingsService.createBooking(dto, principal);
    return { data };
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Lịch sử đơn đặt vé của khách hàng',
    description:
      'Truy vấn danh sách các đơn đặt vé của tài khoản khách hàng đang đăng nhập kèm phân trang và lọc theo trạng thái/ngày đi.\n\n- **Quyền hạn yêu cầu**: Khách hàng đã đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Lấy lịch sử đơn đặt vé thành công.' })
  findCustomerBookings(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: BookingQueryDto,
  ) {
    return this.bookingsService.findCustomerBookings(
      principal.taiKhoanId,
      query,
    );
  }

  @Get(':bookingId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chi tiết đơn đặt vé của khách hàng',
    description:
      'Xem thông tin chi tiết một đơn đặt vé: mã đặt chỗ, danh sách vé điện tử, thông tin chuyến và trạng thái thanh toán.\n\n- **Quyền hạn yêu cầu**: Khách hàng sở hữu đơn hàng.',
  })
  @ApiParam({ name: 'bookingId', description: 'ID đơn đặt vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn đặt vé.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đặt vé.', type: ApiErrorResponseDto })
  findCustomerBookingById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.bookingsService.findCustomerBookingById(
      principal.taiKhoanId,
      bookingId,
    );
  }

  @OptionalAuth()
  @Get(':bookingId/detail')
  @ApiHeader({
    name: 'x-booking-code',
    required: false,
    description: 'Mã đơn đặt chỗ (ví dụ: BK-2026-001) phục vụ xác thực tra cứu công khai',
  })
  @ApiHeader({
    name: 'x-booking-phone',
    required: false,
    description: 'Số điện thoại người đặt vé phục vụ xác thực tra cứu công khai',
  })
  @ApiOperation({
    summary: 'Tra cứu công khai chi tiết đơn đặt vé',
    description:
      'Cho phép khách hàng vãng lai tra cứu đơn đặt chỗ mà không cần đăng nhập thông qua cặp mã `x-booking-code` và `x-booking-phone` trong headers.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiParam({ name: 'bookingId', description: 'ID đơn đặt vé', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn đặt vé công khai.' })
  @ApiResponse({ status: 403, description: 'Thông tin xác thực tra cứu không khớp.', type: ApiErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn đặt vé.', type: ApiErrorResponseDto })
  findPublicBookingDetail(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @OptionalPrincipal() principal?: AuthPrincipal,
    @Headers('x-booking-code') bookingCode?: string,
    @Headers('x-booking-phone') phoneNumber?: string,
  ) {
    return this.bookingsService.findPublicBookingById(
      bookingId,
      principal,
      bookingCode,
      phoneNumber,
    );
  }
}
