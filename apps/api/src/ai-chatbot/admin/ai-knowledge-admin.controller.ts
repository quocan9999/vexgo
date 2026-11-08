import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRoles } from '../../auth/decorators/require-roles.decorator.js';
import { TENANT_PRINCIPAL_ROLES } from '../../auth/principal-scope.js';
import { CurrentPrincipal } from '../../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../../auth/tokens/auth-principal.js';
import { AiKnowledgeAdminService } from './ai-knowledge-admin.service.js';
import { QueryKnowledgeDocumentsDto } from './dto/query-knowledge-documents.dto.js';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto.js';
import { UpdateKnowledgeDocumentDto } from './dto/update-knowledge-document.dto.js';

@ApiTags('Admin - Quản trị Tri thức AI (AI Knowledge Management)')
@ApiBearerAuth('JWT-auth')
@Controller('ai-chatbot/admin/documents')
@RequireRoles('SUPER_ADMIN', ...TENANT_PRINCIPAL_ROLES)
export class AiKnowledgeAdminController {
  constructor(private readonly knowledgeAdminService: AiKnowledgeAdminService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách tài liệu tri thức (phân trang, tìm kiếm & lọc)',
    description:
      'Lấy danh sách các tài liệu quy chuẩn, chính sách, điều khoản và FAQ. Super Admin xem toàn bộ, Quản trị viên nhà xe xem tài liệu toàn sàn (GLOBAL) và tài liệu của nhà xe mình.',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách tài liệu kèm thông tin phân trang `meta` và số lượng chunks.',
  })
  async getDocuments(
    @Query() query: QueryKnowledgeDocumentsDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.getDocuments(query, principal);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Chi tiết tài liệu tri thức và danh sách phân đoạn (chunks)',
    description:
      'Truy vấn nội dung đầy đủ của tài liệu và toàn bộ các chunks đã được cắt phục vụ đối soát RAG.',
  })
  @ApiParam({ name: 'id', description: 'ID số của tài liệu', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết tài liệu kèm mảng chunks sắp xếp theo chunkIndex.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài liệu.' })
  async getDocumentDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.getDocumentDetail(id, principal);
  }

  @Post()
  @ApiOperation({
    summary: 'Tạo mới tài liệu tri thức & tự động đánh chỉ mục vector',
    description:
      'Thêm tài liệu mới vào cơ sở tri thức. Hệ thống tự động phân đoạn văn bản và gọi mô hình embedding để nhúng vector vào CSDL.',
  })
  @ApiResponse({
    status: 201,
    description: 'Khởi tạo và lập chỉ mục tài liệu thành công.',
  })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ.' })
  @ApiResponse({ status: 409, description: 'Mã tài liệu documentCode đã tồn tại.' })
  async createDocument(
    @Body() dto: CreateKnowledgeDocumentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.createDocument(dto, principal);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Cập nhật tài liệu tri thức (tự động re-index nếu nội dung thay đổi)',
    description:
      'Chỉnh sửa thông tin tài liệu. Nếu nội dung `rawContent` hoặc đường dẫn `hierarchyPath` thay đổi, hệ thống tự động xóa chunks cũ và tạo bộ chunks/embeddings mới.',
  })
  @ApiParam({ name: 'id', description: 'ID số của tài liệu', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tài liệu thành công.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài liệu.' })
  async updateDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKnowledgeDocumentDto,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.updateDocument(id, dto, principal);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Bật / Tắt trạng thái hoạt động của tài liệu',
    description:
      'Chuyển đổi trạng thái isActive giữa true và false. Khi isActive = false, tài liệu này sẽ bị loại khỏi pipeline RAG của chatbot.',
  })
  @ApiParam({ name: 'id', description: 'ID số của tài liệu', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Đổi trạng thái tài liệu thành công.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài liệu.' })
  async toggleDocumentStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.toggleDocumentStatus(id, principal);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa tài liệu tri thức và các phân đoạn liên quan',
    description:
      'Xóa vĩnh viễn tài liệu khỏi hệ thống. Các chunks liên kết trong AiKnowledgeChunk sẽ tự động bị xóa theo Cascade.',
  })
  @ApiParam({ name: 'id', description: 'ID số của tài liệu', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Xóa tài liệu thành công.',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy tài liệu.' })
  async deleteDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentPrincipal() principal: AuthPrincipal,
  ) {
    return this.knowledgeAdminService.deleteDocument(id, principal);
  }
}
