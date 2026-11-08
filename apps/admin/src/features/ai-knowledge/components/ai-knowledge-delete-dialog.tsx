'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { AiKnowledgeDocumentItem } from '../types/ai-knowledge';

interface AiKnowledgeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: AiKnowledgeDocumentItem | null;
  onConfirm: (id: number) => Promise<unknown>;
}

export function AiKnowledgeDeleteDialog({
  open,
  onOpenChange,
  document,
  onConfirm,
}: AiKnowledgeDeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  if (!document) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm(document.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-600 shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-foreground">
                Xác nhận xóa tài liệu tri thức?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
                Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="rounded-md border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-800 leading-relaxed my-2">
          Bạn sắp xóa tài liệu{' '}
          <strong className="font-semibold text-rose-900">
            [{document.documentCode}] {document.title}
          </strong>
          . Toàn bộ các đoạn phân mảnh vector (chunks) liên kết trong CSDL sẽ bị
          xóa vĩnh viễn và trợ lý ảo AI sẽ không thể tra cứu thông tin từ tài liệu
          này nữa.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                Đang xóa...
              </>
            ) : (
              'Xác nhận xóa'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
