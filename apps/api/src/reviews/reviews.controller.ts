import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Đánh giá & Nhận xét chất lượng (Reviews)')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Gửi đánh giá và nhận xét chuyến đi',
    description:
      'Hành khách sau khi hoàn thành chuyến đi có thể gửi đánh giá từ 1 đến 5 sao kèm bình luận nhận xét về chất lượng phục vụ.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gửi đánh giá thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc khách hàng chưa hoàn thành chuyến đi này.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập.',
    type: ApiErrorResponseDto,
  })
  async createReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(principal.taiKhoanId, dto);
  }

  @Public()
  @Get('bus-companies/:busCompanyId')
  @ApiOperation({
    summary: 'Xem đánh giá của nhà xe',
    description: 'Lấy danh sách các nhận xét, đánh giá sao của khách hàng dành cho một nhà xe cụ thể.',
  })
  @ApiParam({
    name: 'busCompanyId',
    type: Number,
    description: 'ID nhà xe',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách đánh giá nhà xe thành công.',
  })
  async getBusCompanyReviews(
    @Param('busCompanyId', ParseIntPipe) busCompanyId: number,
  ) {
    return this.reviewsService.getBusCompanyReviews(busCompanyId);
  }

  @Public()
  @Get('trips/:tripId')
  @ApiOperation({
    summary: 'Xem đánh giá của chuyến xe',
    description: 'Lấy danh sách đánh giá từ hành khách đối với một chuyến xe cụ thể.',
  })
  @ApiParam({
    name: 'tripId',
    type: Number,
    description: 'ID chuyến xe',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách đánh giá chuyến xe thành công.',
  })
  async getTripReviews(
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.reviewsService.getTripReviews(tripId);
  }
}
