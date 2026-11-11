import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import {
  AdminReplyReviewDto,
  AdminReviewQueryDto,
  AdminUpdateReviewStatusDto,
} from './dto/admin-review.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('Đánh giá & Nhận xét chất lượng (Reviews)')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ================= ADMIN REVIEW ENDPOINTS =================

  @Get('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Danh sách đánh giá dành cho Admin/Nhà xe (phân trang & bộ lọc)',
    description:
      'Lấy danh sách đánh giá của khách hàng, hỗ trợ lọc theo số sao, trạng thái (HIEN_THI/DA_AN), từ khóa tìm kiếm và nhà xe.',
  })
  async getAdminReviews(
    @Query() query: AdminReviewQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.reviewsService.getAdminReviews(query, principal);
  }

  @Get('admin/stats')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Thống kê tổng quan CSAT và đánh giá cho Admin',
    description:
      'Trả về điểm trung bình, tổng số đánh giá, tỷ lệ hài lòng (>= 4 sao), số lượng tiêu cực (<= 2 sao) và số lượng đã ẩn.',
  })
  async getAdminReviewStats(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query('busCompanyId') busCompanyId?: string,
  ) {
    const numericCompanyId = busCompanyId ? Number(busCompanyId) : undefined;
    return this.reviewsService.getAdminReviewStats(principal, numericCompanyId);
  }

  @Patch('admin/:id/status')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Kiểm duyệt trạng thái đánh giá (Ẩn / Hiện)',
    description:
      'Chuyển đổi trạng thái hiển thị của đánh giá (HIEN_THI hoặc DA_AN).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID đánh giá (phanHoiId)',
    example: 1,
  })
  async updateAdminReviewStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateReviewStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.reviewsService.updateAdminReviewStatus(id, dto, principal);
  }

  @Patch('admin/:id/reply')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Nhà xe phản hồi đánh giá của khách hàng',
    description:
      'Gửi, chỉnh sửa hoặc xóa phản hồi từ nhà xe đối với nhận xét của hành khách.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID đánh giá (phanHoiId)',
    example: 1,
  })
  async replyAdminReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminReplyReviewDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.reviewsService.replyAdminReview(id, dto, principal);
  }

  // ================= CUSTOMER & PUBLIC REVIEW ENDPOINTS =================

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
  async getTripReviews(@Param('tripId', ParseIntPipe) tripId: number) {
    return this.reviewsService.getTripReviews(tripId);
  }

  @Get('my')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Danh sách đánh giá của tôi',
    description: 'Lấy danh sách tất cả các đánh giá mà tài khoản khách hàng hiện tại đã gửi.',
  })
  async getMyReviews(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.reviewsService.getMyReviews(principal.taiKhoanId);
  }

  @Delete('trip/:tripId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xóa đánh giá của tôi theo chuyến xe',
    description: 'Khách hàng xóa đánh giá mình đã gửi cho một chuyến xe cụ thể.',
  })
  @ApiParam({
    name: 'tripId',
    type: Number,
    description: 'ID chuyến xe',
    example: 10,
  })
  async deleteTripReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.reviewsService.deleteTripReview(principal.taiKhoanId, tripId);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Xóa đánh giá theo ID',
    description: 'Khách hàng xóa đánh giá của chính mình theo reviewId.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID đánh giá',
    example: 1,
  })
  async deleteReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.reviewsService.deleteReview(principal.taiKhoanId, id);
  }

  @Patch('trip/:tripId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chỉnh sửa đánh giá của tôi theo chuyến xe',
    description: 'Khách hàng cập nhật số sao hoặc nhận xét của mình cho chuyến xe.',
  })
  @ApiParam({
    name: 'tripId',
    type: Number,
    description: 'ID chuyến xe',
    example: 10,
  })
  async updateTripReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateTripReview(
      principal.taiKhoanId,
      tripId,
      dto,
    );
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chỉnh sửa đánh giá theo ID',
    description: 'Khách hàng cập nhật số sao hoặc nhận xét theo ID đánh giá.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID đánh giá',
    example: 1,
  })
  async updateReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateReview(principal.taiKhoanId, id, dto);
  }
}
