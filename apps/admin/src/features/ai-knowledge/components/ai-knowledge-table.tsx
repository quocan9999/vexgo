'use client';

import {
  Eye,
  FileText,
  Globe2,
  Pencil,
  Power,
  Store,
  Trash2,
} from 'lucide-react';
import { ResourceStatusBadge } from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type AiKnowledgeDocumentItem,
} from '../types/ai-knowledge';

interface AiKnowledgeTableProps {
  documents: AiKnowledgeDocumentItem[];
  onViewDetail: (doc: AiKnowledgeDocumentItem) => void;
  onEdit: (doc: AiKnowledgeDocumentItem) => void;
  onToggleStatus: (doc: AiKnowledgeDocumentItem) => void;
  onDelete: (doc: AiKnowledgeDocumentItem) => void;
  isTenantScope?: boolean;
}

export function AiKnowledgeTable({
  documents,
  onViewDetail,
  onEdit,
  onToggleStatus,
  onDelete,
  isTenantScope = false,
}: AiKnowledgeTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--admin-radius-card)] border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[340px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tài liệu & Phân cấp
            </TableHead>
            <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Danh mục
            </TableHead>
            <TableHead className="w-[180px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phạm vi áp dụng
            </TableHead>
            <TableHead className="w-[110px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Phân đoạn
            </TableHead>
            <TableHead className="w-[130px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Trạng thái
            </TableHead>
            <TableHead className="w-[160px] text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const categoryLabel =
              KNOWLEDGE_CATEGORY_LABELS[doc.category] ?? doc.category;
            const chunkCount = doc._count?.chunks ?? 0;

            return (
              <TableRow
                key={doc.id}
                className="transition-colors hover:bg-muted/30"
              >
                {/* 1. Mã & Tiêu đề */}
                <TableCell className="align-top py-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                      <FileText className="size-3.5 text-primary/70 shrink-0" />
                      <span>{doc.documentCode}</span>
                    </div>
                    <span className="font-semibold text-foreground text-sm leading-snug">
                      {doc.title}
                    </span>
                    <span
                      className="text-xs text-muted-foreground line-clamp-1"
                      title={doc.hierarchyPath}
                    >
                      {doc.hierarchyPath}
                    </span>
                  </div>
                </TableCell>

                {/* 2. Danh mục */}
                <TableCell className="align-top py-3.5">
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {categoryLabel}
                  </span>
                </TableCell>

                {/* 3. Phạm vi */}
                <TableCell className="align-top py-3.5">
                  {doc.scope === 'GLOBAL' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      <Globe2 className="size-3 text-blue-600" />
                      Toàn hệ thống (Super Admin)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      <Store className="size-3 text-amber-600" />
                      {doc.nhaXe?.tenNhaXe || 'Của nhà xe này'}
                    </span>
                  )}
                </TableCell>

                {/* 4. Số chunks */}
                <TableCell className="align-top py-3.5 text-center">
                  <span className="inline-flex items-center justify-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                    {chunkCount} đoạn
                  </span>
                </TableCell>

                {/* 5. Trạng thái */}
                <TableCell className="align-top py-3.5">
                  <ResourceStatusBadge tone={doc.isActive ? 'active' : 'muted'}>
                    {doc.isActive ? 'Đang áp dụng' : 'Tạm ngưng'}
                  </ResourceStatusBadge>
                </TableCell>

                {/* 6. Thao tác */}
                <TableCell className="align-top py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Xem chi tiết & đối soát Chunks"
                      onClick={() => onViewDetail(doc)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Xem chi tiết</span>
                    </Button>

                    {isTenantScope && doc.scope === 'GLOBAL' ? (
                      <span
                        className="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded bg-muted/60 cursor-default"
                        title="Tài liệu toàn hệ thống do Super Admin ban hành (Chỉ xem)"
                      >
                        Chỉ xem
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Chỉnh sửa quy chế"
                          onClick={() => onEdit(doc)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                          <span className="sr-only">Chỉnh sửa</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={doc.isActive ? 'Tạm ngưng quy chế' : 'Kích hoạt quy chế'}
                          onClick={() => onToggleStatus(doc)}
                          className={
                            doc.isActive
                              ? 'text-emerald-600 hover:text-amber-600'
                              : 'text-muted-foreground hover:text-emerald-600'
                          }
                        >
                          <Power className="size-4" />
                          <span className="sr-only">Bật/Tắt trạng thái</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Xóa quy chế"
                          onClick={() => onDelete(doc)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          <span className="sr-only">Xóa</span>
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
