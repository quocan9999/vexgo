'use client';

import { useEffect, useState } from 'react';
import {
  BookOpen,
  Cpu,
  Globe2,
  Hash,
  Layers,
  Loader2,
  Store,
} from 'lucide-react';
import { ResourceStatusBadge } from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getKnowledgeDocumentDetail } from '../services/ai-knowledge-service';
import {
  KNOWLEDGE_CATEGORY_LABELS,
  type AiKnowledgeDocumentItem,
} from '../types/ai-knowledge';

interface AiKnowledgeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: AiKnowledgeDocumentItem | null;
}

export function AiKnowledgeDetailDialog({
  open,
  onOpenChange,
  document,
}: AiKnowledgeDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'chunks'>('chunks');
  const [detail, setDetail] = useState<AiKnowledgeDocumentItem | null>(null);

  useEffect(() => {
    if (!open || !document) return;
    const controller = new AbortController();
    let active = true;

    getKnowledgeDocumentDetail(document.id, controller.signal)
      .then((res) => {
        if (active) setDetail(res);
      })
      .catch(() => {
        if (active) setDetail(document);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, document]);

  if (!document) return null;

  const isDetailLoaded = detail?.id === document.id;
  const currentDoc = isDetailLoaded ? detail : document;
  const chunks = currentDoc.chunks ?? [];
  const categoryLabel =
    KNOWLEDGE_CATEGORY_LABELS[currentDoc.category] ?? currentDoc.category;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col h-full p-0"
      >
        <SheetHeader className="p-5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
              {currentDoc.documentCode}
            </span>
            <ResourceStatusBadge tone={currentDoc.isActive ? 'active' : 'muted'}>
              {currentDoc.isActive ? 'Đang áp dụng' : 'Tạm ngưng'}
            </ResourceStatusBadge>
          </div>
          <SheetTitle className="text-base font-bold text-foreground mt-1.5 leading-snug">
            {currentDoc.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground line-clamp-1">
            {currentDoc.hierarchyPath}
          </SheetDescription>
        </SheetHeader>

        {/* Thông số tổng quan */}
        <div className="px-5 py-3 border-b border-border/60 bg-muted/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Danh mục:</span>
            <span className="font-medium text-foreground mt-0.5 block truncate">
              {categoryLabel}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Phạm vi:</span>
            <div className="font-medium text-foreground mt-0.5 flex items-center gap-1">
              {currentDoc.scope === 'GLOBAL' ? (
                <>
                  <Globe2 className="size-3 text-blue-600 shrink-0" />
                  <span>Toàn sàn</span>
                </>
              ) : (
                <>
                  <Store className="size-3 text-amber-600 shrink-0" />
                  <span className="truncate">
                    {currentDoc.nhaXe?.tenNhaXe || `#${currentDoc.nhaXeId}`}
                  </span>
                </>
              )}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Số phân đoạn:</span>
            <span className="font-mono font-semibold text-foreground mt-0.5 block">
              {chunks.length || currentDoc._count?.chunks || 0} chunks
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Cập nhật:</span>
            <span className="font-mono text-[11px] text-muted-foreground mt-0.5 block">
              {new Date(currentDoc.updatedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border px-5 gap-4 bg-card shrink-0">
          <button
            type="button"
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'chunks'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('chunks')}
          >
            <Layers className="size-3.5" />
            Đối soát Chunks ({chunks.length})
          </button>
          <button
            type="button"
            className={`py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'content'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('content')}
          >
            <BookOpen className="size-3.5" />
            Nội dung gốc (Markdown)
          </button>
        </div>

        {/* Nội dung tab cuộn độc lập */}
        <div className="flex-1 overflow-y-auto p-5">
          {!isDetailLoaded ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <span className="text-xs">Đang tải cấu trúc phân đoạn RAG...</span>
            </div>
          ) : activeTab === 'chunks' ? (
            <div className="flex flex-col gap-4">
              {chunks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  Chưa có phân đoạn nào được lưu trữ cho tài liệu này.
                </div>
              ) : (
                chunks.map((chunk, index) => (
                  <div
                    key={chunk.id || index}
                    className="rounded-lg border border-border bg-card p-4 shadow-2xs flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          <Hash className="size-3 text-slate-500" />
                          Đoạn #{chunk.chunkIndex}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          ID: {chunk.id}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
                        <Cpu className="size-3 text-primary" />
                        {chunk.embeddingModel || 'jina-embeddings-v3'}
                      </span>
                    </div>

                    {/* Ngữ cảnh phân cấp */}
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground block mb-0.5">
                        Contextual Header Prefix (H_i):
                      </span>
                      <div className="rounded bg-muted/50 px-2.5 py-1 text-xs text-foreground font-medium">
                        {chunk.headerPrefix}
                      </div>
                    </div>

                    {/* Nội dung văn bản thô */}
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground block mb-0.5">
                        Nội dung đoạn cắt thô (C_i):
                      </span>
                      <p className="rounded border border-border/40 bg-slate-50/60 dark:bg-slate-900/60 p-2.5 text-xs text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                        {chunk.rawContent}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-slate-50/50 dark:bg-slate-900/50 p-4 font-sans text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {currentDoc.rawContent}
            </div>
          )}
        </div>

        <SheetFooter className="p-4 border-t border-border bg-muted/20 flex justify-end shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
