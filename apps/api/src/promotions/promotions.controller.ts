import {
  Body,
  Controller,
  Get,
  Param,
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
import { OptionalAuth } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';
import { AvailablePromotionsQueryDto } from './dto/available-promotions-query.dto.js';
import { CreatePromotionDto } from './dto/create-promotion.dto.js';
import { PromotionIdParamsDto } from './dto/promotion-id-params.dto.js';
import { PromotionListQueryDto } from './dto/promotion-list-query.dto.js';
import { UpdatePromotionDto } from './dto/update-promotion.dto.js';
import { UpdatePromotionStatusDto } from './dto/update-promotion-status.dto.js';
import { PromotionsService } from './promotions.service.js';

@ApiTags('Chương trình khuyến mãi & Mã giảm giá (Promotions)')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('available')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Danh sách khuyến mãi khả dụng cho khách hàng',
    description:
      'Tra cứu các mã khuyến mãi đang có hiệu lực, còn lượt dùng, phù hợp theo chuyến xe hoặc nhà xe được chỉ định.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách khuyến mãi khả dụng thành công.',
  })
  findAvailable(@Query() query: AvailablePromotionsQueryDto) {
    return this.promotionsService.findAvailablePromotions(query);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:read')
  @ApiOperation({
    summary: 'Danh sách chương trình khuyến mãi (Quản trị)',
    description:
      'Lấy danh sách tất cả các mã khuyến mãi theo quyền quản trị (Super Admin hoặc Admin Nhà xe), hỗ trợ tìm kiếm, lọc trạng thái, ngày áp dụng và phân trang.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách khuyến mãi thành công.',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền xem danh sách khuyến mãi (cần promotion:read).',
    type: ApiErrorResponseDto,
  })
  findAll(
    @Query() query: PromotionListQueryDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findAll(query, principal);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:read')
  @ApiOperation({
    summary: 'Chi tiết chương trình khuyến mãi',
    description:
      'Lấy thông tin chi tiết của một mã khuyến mãi bao gồm thể lệ, loại giảm giá, số tiền tối thiểu, hạn mức và số lượt đã sử dụng.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID chương trình khuyến mãi',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy chi tiết khuyến mãi thành công.',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy chương trình khuyến mãi hoặc ngoài phạm vi quản lý.',
    type: ApiErrorResponseDto,
  })
  findOne(
    @Param() params: PromotionIdParamsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.findOne(params.id, principal);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:create')
  @ApiOperation({
    summary: 'Tạo mới chương trình khuyến mãi',
    description:
      'Tạo mã khuyến mãi mới. Nhà xe chỉ tạo mã trong phạm vi nhà xe của mình; Super Admin có thể tạo mã toàn sàn.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tạo chương trình khuyến mãi thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu đầu vào không hợp lệ hoặc mã khuyến mãi đã tồn tại.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa xác thực hoặc token không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Không có quyền tạo khuyến mãi (cần promotion:create).',
    type: ApiErrorResponseDto,
  })
  create(
    @Body() body: CreatePromotionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.create(body, principal);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @RequirePermissions('promotion:update')
  @ApiOperation({
    summary: 'Cập nhật chương trình khuyến mãi',
    description:
      'Thay đổi các thông tin cấu hình của mã khuyến mãi như tên, giá trị giảm, hạn mức, ngày hiệu lực.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID chương trình khuyến mãi',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật khuyến mãi thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu cập nhật không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy khuyến mãi hoặc ngoài phạm vi quyền hạn.',
    type: ApiErrorResponseDto,
  })
  update(
    @Param() params: PromotionIdParamsDto,
    @Body() body: UpdatePromotionDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.update(params.id, body, principal);
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @RequireRoles(...TENANT_PRINCIPAL_ROLES)
  @RequirePermissions('promotion:update')
  @ApiOperation({
    summary: 'Thay đổi trạng thái khuyến mãi',
    description:
      'Chuyển đổi trạng thái hoạt động của mã khuyến mãi (HOAT_DONG hoặc TAM_NGUNG).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID chương trình khuyến mãi',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật trạng thái khuyến mãi thành công.',
  })
  @ApiResponse({
    status: 400,
    description: 'Trạng thái không hợp lệ.',
    type: ApiErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy khuyến mãi.',
    type: ApiErrorResponseDto,
  })
  updateStatus(
    @Param() params: PromotionIdParamsDto,
    @Body() body: UpdatePromotionStatusDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.promotionsService.updateStatus(
      params.id,
      body.status,
      principal,
    );
  }
}
