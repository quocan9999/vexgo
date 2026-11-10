'use client';

import { useState } from 'react';
import { Plus, Bot, Sliders } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  ResourceCreateAction,
  ResourcePagination,
  ResourceRefreshAction,
  ResourceState,
  ResourceTableSkeleton,
} from '@/components/admin/resource-ui';
import {
  FilterToolbar,
  SearchInput,
  SelectFilter,
} from '@/components/data-filters/resource-filters';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { useAiKnowledge } from '../hooks/use-ai-knowledge';
import {
  KNOWLEDGE_CATEGORY_OPTIONS,
  type AiKnowledgeDocumentItem,
  type AiKnowledgeScope,
} from '../types/ai-knowledge';
import { AiKnowledgeDeleteDialog } from './ai-knowledge-delete-dialog';
import { AiKnowledgeDetailDialog } from './ai-knowledge-detail-dialog';
import { AiKnowledgeFormDialog } from './ai-knowledge-form-dialog';
import { AiKnowledgeTable } from './ai-knowledge-table';
import { AiKnowledgeTestDialog } from './ai-knowledge-test-dialog';
import { AiSettingsDialog } from './ai-settings-dialog';

const TENANT_SCOPE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả nguồn tài liệu' },
  { value: 'GLOBAL', label: 'Toàn hệ thống (Super Admin)' },
  { value: 'TENANT', label: 'Của nhà xe này' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'true', label: 'Đang áp dụng' },
  { value: 'false', label: 'Tạm ngưng' },
];

export function AiKnowledgeManagement() {
  const authState = useAdminSession();
  const isTenantScope =
    authState.status === 'authenticated' &&
    getAdminAccessScope(authState.session) === 'tenant';

  const {
    documents,
    meta,
    loading,
    error,
    searchInput,
    setSearchInput,
    category,
    setCategory,
    scope,
    setScope,
    isActive,
    setIsActive,
    setPage,
    refresh,
    handleToggleStatus,
    handleDelete,
    handleCreate,
    handleUpdate,
  } = useAiKnowledge({ isTenantScope });

  const [formOpen, setFormOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<AiKnowledgeDocumentItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleOpenCreate = () => {
    setSelectedDoc(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (doc: AiKnowledgeDocumentItem) => {
    setSelectedDoc(doc);
    setFormOpen(true);
  };

  const handleOpenDetail = (doc: AiKnowledgeDocumentItem) => {
    setSelectedDoc(doc);
    setDetailOpen(true);
  };

  const handleOpenDelete = (doc: AiKnowledgeDocumentItem) => {
    setSelectedDoc(doc);
    setDeleteOpen(true);
  };

  const categoryFilterOptions = [
    { value: '', label: 'Tất cả danh mục' },
    ...KNOWLEDGE_CATEGORY_OPTIONS,
  ];

  return (
    <SuperAdminLayout
      activeSection="ai-knowledge"
      breadcrumbs={[{ label: 'Tri thức AI (RAG)' }]}
    >
      <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Header trang */}
        <AdminPageHeader
          title="Quản lý Tri thức AI (RAG Knowledge Base)"
          titleId="ai-knowledge-page-title"
          actions={
            <div className="flex items-center gap-2">
              {!isTenantScope && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold h-9"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Sliders className="size-4 text-primary" />
                  Cấu hình AI
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold h-9"
                onClick={() => setTestDialogOpen(true)}
              >
                <Bot className="size-4 text-primary" />
                Kiểm thử RAG
              </Button>
              <ResourceRefreshAction loading={loading} onClick={refresh} />
              <ResourceCreateAction
                label="Thêm quy chế mới"
                onClick={handleOpenCreate}
              />
            </div>
          }
        />

        {/* Thanh công cụ Tìm kiếm & Bộ lọc */}
        <Card className="p-4 border-border/80 shadow-xs">
          <FilterToolbar>
            <SearchInput
              label="Tìm kiếm"
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Tìm theo tiêu đề hoặc mã quy chế..."
              className="max-w-xs"
            />
            <SelectFilter
              label="DANH MỤC"
              value={category}
              onChange={setCategory}
              options={categoryFilterOptions}
            />
            {isTenantScope && (
              <SelectFilter
                label="NGUỒN TÀI LIỆU"
                value={scope}
                onChange={(val) => setScope(val as AiKnowledgeScope | '')}
                options={TENANT_SCOPE_FILTER_OPTIONS}
              />
            )}
            <SelectFilter
              label="TRẠNG THÁI"
              value={isActive}
              onChange={(val) => setIsActive(val as '' | 'true' | 'false')}
              options={STATUS_FILTER_OPTIONS}
            />
          </FilterToolbar>
        </Card>

        {/* Bảng dữ liệu và các trạng thái */}
        {loading ? (
          <ResourceTableSkeleton resourceLabel="tài liệu quy chế AI" />
        ) : error ? (
          <ResourceState error>
            <p className="font-semibold text-rose-700">Lỗi tải dữ liệu tri thức</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                Thử lại
              </Button>
            </div>
          </ResourceState>
        ) : documents.length === 0 ? (
          <ResourceState>
            <p className="font-semibold text-foreground">
              Không tìm thấy tài liệu tri thức nào
            </p>
            <p className="text-xs text-muted-foreground">
              {searchInput || category || scope || isActive
                ? 'Không có quy chế nào khớp với bộ lọc hiện tại. Vui lòng thử xóa bớt tiêu chí lọc.'
                : 'Kho tri thức AI hiện đang trống. Hãy thêm tài liệu quy chuẩn đầu tiên để trợ lý ảo AI bắt đầu học.'}
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={handleOpenCreate}>
                <Plus className="size-4 mr-1.5" />
                Thêm tài liệu ngay
              </Button>
            </div>
          </ResourceState>
        ) : (
          <div className="flex flex-col gap-4">
            <AiKnowledgeTable
              documents={documents}
              onViewDetail={handleOpenDetail}
              onEdit={handleOpenEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={handleOpenDelete}
              isTenantScope={isTenantScope}
            />

            {/* Phân trang */}
            <ResourcePagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={setPage}
              totalItems={meta.totalItems}
              pageSize={meta.pageSize}
              summaryLabel="tài liệu quy chế"
              disabled={loading}
            />
          </div>
        )}

        {/* Dialog thêm / sửa quy chế */}
        <AiKnowledgeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          document={selectedDoc}
          onSubmitCreate={handleCreate}
          onSubmitUpdate={handleUpdate}
          isTenantScope={isTenantScope}
        />

        {/* Drawer xem chi tiết & đối soát Chunks */}
        <AiKnowledgeDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          document={selectedDoc}
        />

        {/* Dialog xác nhận xóa */}
        <AiKnowledgeDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          document={selectedDoc}
          onConfirm={handleDelete}
        />

        {/* Drawer kiểm thử trợ lý AI (RAG Debug) */}
        <AiKnowledgeTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
        />

        {/* Dialog Cấu hình hệ thống AI (Super Admin only) */}
        {!isTenantScope && (
          <AiSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        )}
      </div>
    </SuperAdminLayout>
  );
}
