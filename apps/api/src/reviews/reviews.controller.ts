import { Body, Controller, Post } from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { ReviewsService } from './reviews.service.js';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async createReview(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(principal.taiKhoanId, dto);
  }
}
