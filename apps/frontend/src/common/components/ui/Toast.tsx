// frontend/src/common/components/ui/Toast.tsx
'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  isOpen: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  isOpen,
  message,
  type = 'success',
  duration = 3500,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen || !message) return null;

  const typeConfig = {
    success: {
      border: 'border-emerald-200 bg-white text-brand-dark shadow-emerald-950/5',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
      badge: 'Thành công',
      badgeClass: 'bg-emerald-100 text-emerald-800',
    },
    error: {
      border: 'border-rose-200 bg-white text-rose-900 shadow-rose-950/5',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
      badge: 'Thông báo lỗi',
      badgeClass: 'bg-rose-100 text-rose-800',
    },
    info: {
      border: 'border-blue-200 bg-white text-blue-900 shadow-blue-950/5',
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
      badge: 'Thông báo',
      badgeClass: 'bg-blue-100 text-blue-800',
    },
  }[type];

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full font-sans pointer-events-auto">
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl border shadow-xl ${typeConfig.border} transition-all`}
      >
        <div className="mt-0.5">{typeConfig.icon}</div>

        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${typeConfig.badgeClass}`}
            >
              {typeConfig.badge}
            </span>
          </div>
          <p className="text-xs text-slate-700 font-medium leading-relaxed">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;
