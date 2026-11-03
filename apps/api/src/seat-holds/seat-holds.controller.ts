import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SeatHoldsService } from './seat-holds.service.js';
import { CreateSeatHoldDto } from './dto/create-seat-hold.dto.js';
import { ReleaseSeatHoldDto } from './dto/release-seat-hold.dto.js';
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Giữ chỗ tạm thời (Seat Holds)')
@OptionalAuth()
@Controller('seat-holds')
export class SeatHoldsController {
  constructor(private readonly seatHoldsService: SeatHoldsService) {}

  @Post()
  @ApiOperation({
    summary: 'Khởi tạo phiên giữ chỗ tạm thời',
    description:
      'Khóa giữ tạm thời các ghế đã chọn trong khoảng 10-15 phút để chuẩn bị thanh toán. Hệ thống xử lý race condition atomic ngăn chặn đặt trùng ghế. Trả về `holdToken` dùng để tạo booking.\n\n- **Quyền truy cập**: Công khai (Public) hoặc Khách hàng.',
  })
  @ApiResponse({
    status: 201,
    description: 'Giữ chỗ thành công, trả về `holdToken` và thời gian hết hạn.',
  })
  @ApiResponse({
    status: 409,
    description: 'Ghế vừa được người khác giữ hoặc đặt mua (SEAT_UNAVAILABLE).',
    type: ApiErrorResponseDto,
  })
  async createSeatHold(
    @Body() dto: CreateSeatHoldDto,
    @CurrentPrincipal() principal?: AuthPrincipal,
  ) {
    return this.seatHoldsService.createSeatHold(
      dto.tripId,
      dto.seatIds,
      principal,
    );
  }

  @Delete()
  @ApiHeader({
    name: 'x-hold-token',
    required: false,
    description: 'Mã token phiên giữ chỗ cần giải phóng',
  })
  @ApiOperation({
    summary: 'Hủy/nhả phiên giữ chỗ',
    description:
      'Giải phóng ngay lập tức các ghế đang được giữ chỗ khi khách hàng hủy bỏ thao tác hoặc đổi ghế khác.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({
    status: 200,
    description: 'Nhả ghế thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Thiếu mã giữ chỗ `holdToken`.',
    type: ApiErrorResponseDto,
  })
  async releaseSeatHoldDirect(
    @Headers('x-hold-token') headerToken?: string,
    @Body() body?: ReleaseSeatHoldDto,
  ) {
    const token = headerToken || body?.holdToken;
    if (!token || token.trim().length === 0) {
      throw new BadRequestException('Mã giữ chỗ (holdToken) là bắt buộc.');
    }
    return this.seatHoldsService.releaseSeatHold(token.trim());
  }
}
