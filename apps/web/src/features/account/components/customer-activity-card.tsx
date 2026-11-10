'use client';

import React from 'react';
import {
  Calendar,
  Bus,
  PackageCheck,
  Coins,
  Armchair,
  MapPin,
  Eye,
  Edit,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Clock,
  XCircle,
  EyeOff,
  CheckCheck,
  RotateCw,
  FileEdit,
  History,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CustomerActivity } from '@/features/account/types/customer-activity';

interface MyPostCardProps {
  post: CustomerActivity;
  onViewDetail: (post: CustomerActivity) => void;
  onEdit: (post: CustomerActivity) => void;
  onDelete: (postId: string) => void;
  onToggleHide: (post: CustomerActivity) => void;
  onMarkCompleted: (post: CustomerActivity) => void;
  onRenew: (post: CustomerActivity) => void;
}

export const MyPostCard: React.FC<MyPostCardProps> = ({
  post,
  onViewDetail,
  onEdit,
  onDelete,
  onToggleHide,
  onMarkCompleted,
  onRenew,
}) => {
  const t = useTranslations('account.activity');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 transition-all p-5 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                post.needType === 'BUY'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                  : 'bg-sky-50 text-sky-800 border border-sky-200/60'
              }`}
            >
              {post.needType === 'BUY' ? (
                <Bus className="w-3.5 h-3.5" />
              ) : (
                <PackageCheck className="w-3.5 h-3.5" />
              )}
              <span>{post.needType === 'BUY' ? t('ticketBooking') : t('freightShipping')}</span>
            </span>

            {/* Status Badges */}
            {post.status === 'APPROVED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-brand border border-emerald-200/80">
                <ShieldCheck className="w-3 h-3" />
                <span>{t('statusPaid')}</span>
              </span>
            )}
            {post.status === 'PENDING' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                <Clock className="w-3 h-3" />
                <span>{t('statusPending')}</span>
              </span>
            )}
            {post.status === 'REJECTED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                <XCircle className="w-3 h-3" />
                <span>{t('statusFailed')}</span>
              </span>
            )}
            {post.status === 'HIDDEN' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <EyeOff className="w-3 h-3" />
                <span>{t('statusCancelled')}</span>
              </span>
            )}
            {post.status === 'COMPLETED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                <CheckCheck className="w-3 h-3" />
                <span>{t('statusUsed')}</span>
              </span>
            )}
            {post.status === 'EXPIRED' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-orange-700 border border-orange-200">
                <History className="w-3 h-3" />
                <span>{t('statusExpired')}</span>
              </span>
            )}
            {post.status === 'DRAFT' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                <FileEdit className="w-3 h-3" />
                <span>{t('statusDraft')}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{post.createdAt}</span>
            </span>
            {post.viewsCount !== undefined && (
              <span className="flex items-center gap-1 text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                <Eye className="w-3 h-3 text-slate-400" />
                <span>{post.viewsCount} {t('viewsCount')}</span>
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug hover:text-emerald-800 transition-colors">
          {post.title}
        </h3>

        {/* Meta Info Grid */}
        <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-100 space-y-2 text-xs text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                {t('priceFareLabel')} <strong className="text-brand-dark font-extrabold">{post.priceRange}</strong>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Armchair className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                {t('seatWeightLabel')} <strong className="text-slate-800 font-bold">{post.areaRange}</strong>
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 pt-1 border-t border-slate-200/60">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{post.location}</span>
          </div>
        </div>

        {/* Reject Reason Alert Banner */}
        {post.status === 'REJECTED' && post.rejectReason && (
          <div className="p-3.5 bg-rose-50 border border-rose-200/90 rounded-xl text-xs text-rose-800 space-y-1">
            <div className="flex items-center gap-1.5 font-extrabold text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{t('paymentFailureReason')}</span>
            </div>
            <p className="font-medium leading-relaxed pl-5 text-rose-700">{post.rejectReason}</p>
          </div>
        )}
      </div>

      {/* Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onViewDetail(post)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{t('viewDetail')}</span>
        </button>

        <div className="flex items-center flex-wrap gap-1.5">
          {/* Action: Toggle Hide/Unhide */}
          {post.status === 'APPROVED' && (
            <button
              type="button"
              onClick={() => onToggleHide(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              title={t('cancelAction')}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>{t('cancelAction')}</span>
            </button>
          )}

          {post.status === 'HIDDEN' && (
            <button
              type="button"
              onClick={() => onToggleHide(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-brand hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
              title={t('restoreAction')}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t('restoreAction')}</span>
            </button>
          )}

          {/* Action: Mark Completed */}
          {(post.status === 'APPROVED' || post.status === 'HIDDEN') && (
            <button
              type="button"
              onClick={() => onMarkCompleted(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-sky-700 hover:bg-sky-50 border border-sky-200 transition-colors cursor-pointer"
              title={t('completeAction')}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>{t('completeAction')}</span>
            </button>
          )}

          {/* Action: Retry Payment */}
          {post.status === 'EXPIRED' && (
            <button
              type="button"
              onClick={() => onRenew(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-orange-700 hover:bg-amber-50 border border-orange-200 transition-colors cursor-pointer"
              title={t('repayAction')}
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>{t('repayAction')}</span>
            </button>
          )}

          {/* Action: Edit */}
          {(post.status === 'DRAFT' || post.status === 'REJECTED' || post.status === 'APPROVED') && (
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-50 border border-emerald-200/80 transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{t('edit')}</span>
            </button>
          )}

          {/* Action: Delete */}
          <button
            type="button"
            onClick={() => onDelete(post.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('deleteAction')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
