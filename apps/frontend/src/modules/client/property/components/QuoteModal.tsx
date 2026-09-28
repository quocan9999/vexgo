// frontend/src/modules/client/property/components/QuoteModal.tsx
'use client';

import React from 'react';
import { X, User, Phone, MessageCircle } from 'lucide-react';
import type { PropertyDemand } from '../models/property.model';

interface QuoteModalProps {
  post: PropertyDemand | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({ post, isOpen, onClose }) => {
  if (!isOpen || !post) return null;

  const cleanPhone = post.authorPhone.replace(/\./g, '').replace(/\s+/g, '');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-base font-bold text-slate-900">
            Gửi báo giá cho khách hàng
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post Summary Box */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-100/80 rounded-xl space-y-1.5">
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            {post.title}
          </h4>
          <p className="text-xs text-slate-500 font-medium">
            {post.location} · Ngân sách <strong className="text-brand font-bold">{post.price}</strong>
          </p>
        </div>

        {/* Author Contact Info */}
        <div className="space-y-2.5 text-sm text-slate-700">
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="font-medium">{post.authorName}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="font-mono font-medium">{post.authorPhone}</span>
          </div>
        </div>

        {/* 2 Big Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <a
            href={`https://zalo.me/${cleanPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Kết nối Zalo</span>
          </a>

          <a
            href={`tel:${cleanPhone}`}
            className="py-3 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Phone className="w-4 h-4 text-brand" />
            <span>Gọi</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default QuoteModal;
