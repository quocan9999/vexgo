'use client';

import React, { useEffect } from 'react';
import { Info, X } from 'lucide-react';

export interface FeaturePlaceholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export const FeaturePlaceholderModal: React.FC<FeaturePlaceholderModalProps> = ({
  isOpen,
  onClose,
  title = 'Tính năng sắp có',
  message = 'Thông tin xe/Chi tiết sẽ được bổ sung ở phiên bản sau.',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="placeholder-modal-title"
      className="fixed inset-0 z-[90] bg-black/45 px-4 py-6 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Đóng thông báo"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
            <Info className="w-6 h-6" />
          </div>

          <h3
            id="placeholder-modal-title"
            className="text-lg font-bold text-slate-950 mb-2"
          >
            {title}
          </h3>

          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {message}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 px-5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-hover transition-colors shadow-sm"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
