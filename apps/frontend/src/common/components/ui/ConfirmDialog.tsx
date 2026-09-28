// /src/common/components/ui/ConfirmDialog.tsx
'use client';

import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  type = 'warning',
  isLoading = false,
}) => {
  const icons = {
    danger: <AlertTriangle className="w-12 h-12 text-rose-600" />,
    warning: <AlertTriangle className="w-12 h-12 text-amber-600" />,
    info: <Info className="w-12 h-12 text-brand" />,
  };

  const confirmVariants: Record<'danger' | 'warning' | 'info', 'danger' | 'accent' | 'primary'> = {
    danger: 'danger',
    warning: 'accent',
    info: 'primary',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" showCloseButton={false}>
      <div className="flex flex-col items-center text-center p-2">
        <div className="mb-4">{icons[type]}</div>

        <h4 className="text-xl font-bold text-slate-900 mb-2">{title}</h4>
        <p className="text-base text-slate-600 mb-6">{message}</p>

        <div className="flex items-center gap-3 w-full">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>

          <Button
            variant={confirmVariants[type]}
            size="lg"
            className="flex-1"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
