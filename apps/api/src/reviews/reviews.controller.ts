import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
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

  @Public()
  @Get('bus-companies/:busCompanyId')
  async getBusCompanyReviews(
    @Param('busCompanyId', ParseIntPipe) busCompanyId: number,
  ) {
    return this.reviewsService.getBusCompanyReviews(busCompanyId);
  }

  @Public()
  @Get('trips/:tripId')
  async getTripReviews(
    @Param('tripId', ParseIntPipe) tripId: number,
  ) {
    return this.reviewsService.getTripReviews(tripId);
  }
}

