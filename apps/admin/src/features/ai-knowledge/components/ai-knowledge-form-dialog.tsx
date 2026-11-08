'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  KNOWLEDGE_CATEGORY_LABELS,
  KNOWLEDGE_CATEGORY_OPTIONS,
  type AiKnowledgeDocumentItem,
  type AiKnowledgeScope,
  type CreateKnowledgeDocumentInput,
  type UpdateKnowledgeDocumentInput,
} from '../types/ai-knowledge';
import { parseKnowledgeDocumentFile } from '../utils/document-parser';

interface AiKnowledgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: AiKnowledgeDocumentItem | null;
  onSubmitCreate: (input: CreateKnowledgeDocumentInput) => Promise<unknown>;
  onSubmitUpdate: (
    id: number,
    input: UpdateKnowledgeDocumentInput,
  ) => Promise<unknown>;
  isTenantScope?: boolean;
}

interface FormInnerProps {
  document: AiKnowledgeDocumentItem | null;
  onSubmitCreate: (input: CreateKnowledgeDocumentInput) => Promise<unknown>;
  onSubmitUpdate: (
    id: number,
    input: UpdateKnowledgeDocumentInput,
  ) => Promise<unknown>;
  isTenantScope: boolean;
  onClose: () => void;
}

function AiKnowledgeFormInner({
  document,
  onSubmitCreate,
  onSubmitUpdate,
  isTenantScope,
  onClose,
}: FormInnerProps) {
  const isEdit = Boolean(document);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(document?.title ?? '');
  const [documentCode, setDocumentCode] = useState(document?.documentCode ?? '');
  const [category, setCategory] = useState(
    document?.category ?? 'CHINH_SACH_HOAN_HUY',
  );
  const [hierarchyPath, setHierarchyPath] = useState(
    document?.hierarchyPath ??
      (isTenantScope
        ? '[Quy chế Nhà xe] > [Chương I: Quy định chung]'
        : '[Quy chế VexGo] > [Chương I: Quy định chung]'),
  );
  const [scope, setScope] = useState<AiKnowledgeScope>(
    document?.scope ?? (isTenantScope ? 'TENANT' : 'GLOBAL'),
  );
  const [rawContent, setRawContent] = useState(document?.rawContent ?? '');
  const [isActive, setIsActive] = useState(document?.isActive ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingFile(true);
    setValidationError(null);

    try {
      const result = await parseKnowledgeDocumentFile(file);
      setRawContent(result.content);
      if (!title.trim() && result.defaultTitle) {
        setTitle(result.defaultTitle);
      }
      toast.success(
        `Đã trích xuất thành công ${result.characterCount.toLocaleString('vi-VN')} ký tự từ tệp "${file.name}".`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể đọc tệp.';
      setValidationError(message);
      toast.error(message);
    } finally {
      setParsingFile(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedTitle = title.trim();
    const trimmedHierarchy = hierarchyPath.trim();
    const trimmedContent = rawContent.trim();

    if (!trimmedTitle) {
      setValidationError('Vui lòng nhập tiêu đề tài liệu quy chế.');
      return;
    }
    if (!trimmedHierarchy) {
      setValidationError('Vui lòng nhập đường dẫn phân cấp (hierarchyPath).');
      return;
    }
    if (!trimmedContent) {
      setValidationError('Vui lòng nhập nội dung chi tiết của quy chế.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && document) {
        await onSubmitUpdate(document.id, {
          title: trimmedTitle,
          category,
          scope,
          hierarchyPath: trimmedHierarchy,
          rawContent: trimmedContent,
          isActive,
        });
      } else {
        await onSubmitCreate({
          title: trimmedTitle,
          documentCode: documentCode.trim() || undefined,
          category,
          scope,
          hierarchyPath: trimmedHierarchy,
          rawContent: trimmedContent,
          isActive,
        });
      }
      onClose();
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
      {validationError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {validationError}
        </div>
      )}

      {/* 1. Tiêu đề */}
      <Field>
        <FieldLabel htmlFor="knowledge-title">
          Tiêu đề quy chế / câu hỏi *
        </FieldLabel>
        <Input
          id="knowledge-title"
          placeholder="Ví dụ: Chính sách hoàn hủy vé và biểu phí"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={submitting}
          autoFocus
        />
      </Field>

      {/* 2. Hàng: Mã tài liệu & Danh mục */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="knowledge-code">
            Mã tài liệu (tùy chọn)
          </FieldLabel>
          <Input
            id="knowledge-code"
            placeholder={isEdit ? '' : 'Để trống hệ thống sẽ tự sinh'}
            value={documentCode}
            onChange={(e) => setDocumentCode(e.target.value)}
            disabled={submitting || isEdit}
            className="font-mono text-xs"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="knowledge-category">Danh mục quy chuẩn *</FieldLabel>
          <Select
            value={category}
            onValueChange={(val) => setCategory(val ?? 'CHINH_SACH_HOAN_HUY')}
            disabled={submitting}
          >
            <SelectTrigger id="knowledge-category">
              <SelectValue placeholder="Chọn danh mục">
                {KNOWLEDGE_CATEGORY_LABELS[category] ?? category}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* 3. Đường dẫn phân cấp & Phạm vi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="knowledge-hierarchy">
            Đường dẫn phân cấp *
          </FieldLabel>
          <Input
            id="knowledge-hierarchy"
            placeholder="[Quy chế VexGo] > [Chương II: Đổi trả vé]"
            value={hierarchyPath}
            onChange={(e) => setHierarchyPath(e.target.value)}
            disabled={submitting}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="knowledge-scope">Phạm vi áp dụng</FieldLabel>
          <Select
            value={scope}
            onValueChange={(val) => setScope((val as AiKnowledgeScope) ?? 'GLOBAL')}
            disabled={submitting || isTenantScope}
          >
            <SelectTrigger id="knowledge-scope">
              <SelectValue placeholder="Chọn phạm vi">
                {scope === 'GLOBAL' ? 'Toàn hệ thống (Super Admin)' : 'Của nhà xe này'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOBAL">Toàn hệ thống (Super Admin)</SelectItem>
              <SelectItem value="TENANT">Của nhà xe này</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* 4. Nội dung Markdown */}
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="knowledge-content">
            Nội dung quy chế (Markdown) *
          </FieldLabel>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground">
              {rawContent.length} ký tự
            </span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt,.md,.docx,.pdf"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || parsingFile}
            >
              {parsingFile ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang trích xuất văn bản...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Nhập từ file (.txt, .md, .docx, .pdf)
                </>
              )}
            </Button>
          </div>
        </div>
        <Textarea
          id="knowledge-content"
          rows={9}
          placeholder="Nhập nội dung quy định, điều khoản hoặc câu hỏi thường gặp..."
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          disabled={submitting}
          className="font-sans text-sm leading-relaxed"
        />
      </Field>

      {/* 5. Cờ kích hoạt */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="knowledge-is-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={submitting}
          className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
        />
        <label
          htmlFor="knowledge-is-active"
          className="text-xs font-semibold text-foreground cursor-pointer select-none"
        >
          Kích hoạt ngay cho trợ lý ảo AI tra cứu
        </label>
      </div>

      <DialogFooter className="pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Đang đánh chỉ mục vector...
            </>
          ) : (
            'Lưu & Đánh chỉ mục AI'
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AiKnowledgeFormDialog({
  open,
  onOpenChange,
  document,
  onSubmitCreate,
  onSubmitUpdate,
  isTenantScope = false,
}: AiKnowledgeFormDialogProps) {
  const isEdit = Boolean(document);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary shrink-0" />
            {isEdit ? 'Chỉnh sửa tài liệu tri thức' : 'Thêm mới tài liệu tri thức AI'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit
              ? 'Chỉnh sửa nội dung quy chế. Nếu nội dung thay đổi, hệ thống sẽ tự động phân đoạn và đánh chỉ mục lại.'
              : 'Nạp quy chế, chính sách mới vào CSDL. Hệ thống sẽ tự động chạy pipeline cắt đoạn và nhúng vector.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <AiKnowledgeFormInner
            key={document ? `edit-${document.id}` : 'create'}
            document={document}
            onSubmitCreate={onSubmitCreate}
            onSubmitUpdate={onSubmitUpdate}
            isTenantScope={isTenantScope}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
