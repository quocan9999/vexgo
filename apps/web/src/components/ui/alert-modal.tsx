'use client';

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react';

export interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  variant?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Đóng',
  variant = 'info',
  onClose,
}) => {
  const titleId = useId();
  if (!isOpen) return null;

  const renderIcon = () => {
    switch (variant) {
      case 'success':
        return (
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
          </div>
        );
      case 'error':
        return (
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <XCircle className="w-7 h-7 stroke-[2.2]" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-500 flex items-center justify-center flex-shrink-0 shadow-xs">
            <AlertCircle className="w-7 h-7 stroke-[2.2]" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200/60 text-sky-600 flex items-center justify-center flex-shrink-0 shadow-xs">
            <Info className="w-7 h-7 stroke-[2.2]" />
          </div>
        );
    }
  };

  const getButtonClass = () => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-600/20';
      case 'error':
        return 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white shadow-amber-500/20';
      case 'info':
      default:
        return 'bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white shadow-sky-600/20';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[420px] bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3.5">
          {renderIcon()}
          <div className="space-y-2.5 w-full">
            <h3 id={titleId} className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
              {title}
            </h3>
            {message && (
              <div className="text-[14px] text-slate-600 leading-relaxed font-normal whitespace-pre-line px-1 sm:px-2">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${getButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
