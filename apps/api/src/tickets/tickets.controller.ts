import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { TicketsService } from './tickets.service.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { TicketLookupQueryDto } from './dto/ticket-lookup-query.dto.js';
import { CancelTicketDto } from './dto/cancel-ticket.dto.js';
import {
  PUBLIC_RATE_LIMIT_TTL_MS,
  PUBLIC_TICKET_LOOKUP_RATE_LIMIT,
} from '../common/rate-limit-policy.js';
import { ApiErrorResponseDto } from '../common/swagger/api-response-envelope.dto.js';

@ApiTags('Vé xe điện tử (Tickets)')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Danh sách vé xe của khách hàng',
    description:
      'Lấy danh sách các vé xe điện tử thuộc tài khoản khách hàng đang đăng nhập kèm phân trang và lọc theo trạng thái/ngày khởi hành.\n\n- **Quyền hạn yêu cầu**: Khách hàng đã đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách vé xe thành công.' })
  findCustomerTickets(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: TicketQueryDto,
  ) {
    return this.ticketsService.findCustomerTickets(principal.taiKhoanId, query);
  }

  @Public()
  @Post('lookup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_TICKET_LOOKUP_RATE_LIMIT,
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Tra cứu thông tin vé xe công khai',
    description:
      'Cho phép hành khách tra cứu thông tin vé xe điện tử bằng mã vé (`ticketCode`) và số điện thoại đã dùng để mua vé mà không cần đăng nhập.\n\n- **Quyền truy cập**: Công khai (Public).',
  })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết vé xe điện tử.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vé xe hoặc số điện thoại không trùng khớp.', type: ApiErrorResponseDto })
  lookupTicket(@Body() dto: TicketLookupQueryDto) {
    return this.ticketsService.lookupTicket(dto);
  }

  @Public()
  @Post('cancel')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: PUBLIC_TICKET_LOOKUP_RATE_LIMIT,
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Yêu cầu hủy vé xe',
    description:
      'Gửi yêu cầu hủy vé xe theo chính sách hủy vé của nhà xe. Hệ thống tính toán phí hủy và hoàn trả phần tiền tương ứng.\n\n- **Quyền truy cập**: Công khai (Public) hoặc Khách hàng.',
  })
  @ApiResponse({ status: 200, description: 'Hủy vé thành công, trả về chi tiết số tiền hoàn lại.' })
  @ApiResponse({ status: 400, description: 'Vé không đủ điều kiện hủy (quá sát giờ chạy hoặc chuyến đã xuất bến).', type: ApiErrorResponseDto })
  cancelTicket(@Body() dto: CancelTicketDto) {
    return this.ticketsService.cancelTicket(dto);
  }

  @Get(':ticketId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Chi tiết một vé xe điện tử',
    description:
      'Xem thông tin chi tiết vé xe (vị trí ghế, mã QR soát vé, thông tin chuyến đi) của khách hàng đang đăng nhập.\n\n- **Quyền hạn yêu cầu**: Khách hàng sở hữu vé.',
  })
  @ApiParam({ name: 'ticketId', description: 'ID vé xe', example: 1 })
  @ApiResponse({ status: 200, description: 'Chi tiết vé xe điện tử.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy vé xe.', type: ApiErrorResponseDto })
  findCustomerTicketById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('ticketId', ParseIntPipe) ticketId: number,
  ) {
    return this.ticketsService.findCustomerTicketById(
      principal.taiKhoanId,
      ticketId,
    );
  }
}
