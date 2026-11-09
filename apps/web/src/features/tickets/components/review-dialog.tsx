/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Edit3,
  Loader2,
  MessageSquare,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { reviewsApi } from '@/features/tickets/services/reviews.api';

export interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: number;
  tripInfo?: {
    route: string;
    date: string;
    busBrand: string;
  };
  onSuccess?: () => void;
  onDeleted?: (tripId: number) => void;
}

export const ReviewDialog: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripInfo,
  onSuccess,
  onDeleted,
}) => {
  const t = useTranslations('tickets');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  let authContext: ReturnType<typeof useAuthSession> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuthSession();
  } catch {
    authContext = null;
  }
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const executeWithAuth = authContext?.executeWithAuth;

  const [mode, setMode] = useState<'loading' | 'create' | 'view' | 'edit'>(
    'create',
  );
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [reply, setReply] = useState<{
    content: string;
    createdAt: string | null;
    responderName: string;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tự động kiểm tra xem khách hàng đã đánh giá chuyến xe này chưa khi mở modal
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setShowDeleteConfirm(false);

    if (!tripId || !isAuthenticated || !executeWithAuth) {
      setMode('create');
      setRating(0);
      setComment('');
      setCreatedAt(null);
      setReply(null);
      return;
    }

    let ignore = false;
    setMode('loading');

    executeWithAuth((token) => reviewsApi.getMyReviews(token))
      .then((res) => {
        if (ignore) return;
        const found = res?.data?.reviews?.find(
          (r: any) => Number(r.tripId) === Number(tripId),
        );
        if (found) {
          setRating(found.rating || 5);
          setComment(found.comment || '');
          setCreatedAt(found.createdAt || null);
          setReply(found.reply || null);
          setMode('view');
        } else {
          setRating(0);
          setComment('');
          setCreatedAt(null);
          setReply(null);
          setMode('create');
        }
      })
      .catch(() => {
        if (!ignore) {
          setMode('create');
        }
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, tripId, isAuthenticated, executeWithAuth]);

  if (!isOpen) return null;

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1:
        return t('ratingVeryBad');
      case 2:
        return t('ratingBad');
      case 3:
        return t('ratingNormal');
      case 4:
        return t('ratingGood');
      case 5:
        return t('ratingExcellent');
      default:
        return '';
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const handleSubmitCreateOrEdit = async () => {
    if (rating === 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!tripId) {
      setMode('view');
      return;
    }

    if (!isAuthenticated || !executeWithAuth) {
      setErrorMessage(
        t('loginToReviewPrompt', { phone: '' }),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'edit') {
        await executeWithAuth((token) =>
          reviewsApi.updateTripReview(token, tripId, {
            rating,
            comment: comment.trim() || undefined,
          }),
        );
        setSuccessMessage(t('reviewUpdatedSuccess'));
      } else {
        try {
          await executeWithAuth((token) =>
            reviewsApi.createReview(token, {
              tripId,
              rating,
              comment: comment.trim() || undefined,
            }),
          );
          setSuccessMessage(t('reviewCreatedSuccess'));
        } catch (createErr: unknown) {
          const msg =
            createErr instanceof Error ? createErr.message.toLowerCase() : '';
          if (
            !msg.includes('quá 7 ngày') &&
            !msg.includes('hết thời hạn') &&
            !msg.includes('chưa khởi hành') &&
            (msg.includes('xung đột') ||
              msg.includes('đã gửi đánh giá') ||
              msg.includes('conflict'))
          ) {
            await executeWithAuth((token) =>
              reviewsApi.updateTripReview(token, tripId, {
                rating,
                comment: comment.trim() || undefined,
              }),
            );
            setSuccessMessage(t('reviewUpdatedSuccess'));
          } else {
            throw createErr;
          }
        }
      }

      setCreatedAt(new Date().toISOString());
      setMode('view');
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('reviewSaveError');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!tripId || !isAuthenticated || !executeWithAuth) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await executeWithAuth((token) =>
        reviewsApi.deleteTripReview(token, tripId),
      );
      setShowDeleteConfirm(false);
      setRating(0);
      setComment('');
      setCreatedAt(null);
      setReply(null);
      setSuccessMessage(t('reviewDeletedSuccess'));
      setMode('create');
      onDeleted?.(tripId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('reviewDeleteError');
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setHoverRating(0);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="font-black text-lg text-slate-900">
            {mode === 'view'
              ? t('viewReviewModalTitle')
              : mode === 'edit'
                ? t('editReviewModalTitle')
                : t('reviewModalTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Thông tin chuyến đi */}
          <div className="text-center mb-5">
            <p className="text-sm font-semibold text-slate-500 mb-1">
              {tripInfo?.busBrand || 'VexGo'}
            </p>
            <h3 className="font-bold text-slate-800">
              {tripInfo?.route || ''}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {tripInfo?.date || ''}
            </p>
          </div>

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <div className="py-4 px-2 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3.5 shadow-2xs">
                <User className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">
                {t('loginToReviewTitle')}
              </h4>
              <p className="text-xs text-slate-500 mb-5 max-w-xs leading-relaxed">
                {t('loginToReviewDesc')}
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:flex-1 h-11 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {t('later')}
                </button>
                <Link
                  href={`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/')}`}
                  className="w-full sm:flex-1 h-11 rounded-xl bg-[#0060c4] hover:bg-blue-700 text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <span>{t('loginNow')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : mode === 'loading' ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-[#0060c4]" />
              <span>{t('loadingReview')}</span>
            </div>
          ) : mode === 'view' ? (
            /* ================= CHẾ ĐỘ XEM LẠI COMMENT + SỬA / XÓA ================= */
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center p-4 bg-amber-50/60 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-extrabold text-amber-700 text-base">
                    {rating}/5
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-700">
                    {getRatingLabel(rating)}
                  </span>
                </div>
                {createdAt && (
                  <span className="text-[11px] text-slate-400 mt-1 font-medium">
                    {t('updatedAtLabel', { date: formatDate(createdAt) })}
                  </span>
                )}
              </div>

              {/* Nội dung comment đã gửi */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0060c4]" />
                  <span>{t('yourComment')}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {comment ? (
                    `“${comment}”`
                  ) : (
                    <span className="text-slate-400 italic">
                      {t('noTextComment')}
                    </span>
                  )}
                </div>
              </div>

              {/* Phản hồi từ nhà xe (nếu có) */}
              {reply && (
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-slate-800">
                  <div className="flex items-center justify-between gap-2 font-bold text-blue-900 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#0060c4]" />
                      {t('operatorReplyFrom', { responder: reply.responderName || tripInfo?.busBrand || 'Nhà xe' })}
                    </span>
                    {reply.createdAt && (
                      <span className="text-[11px] text-slate-400 font-normal">
                        {formatDate(reply.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {reply.content}
                  </p>
                </div>
              )}

              {/* Hai nút Chỉnh sửa & Xóa ngay bên dưới comment */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('deleteReviewAction')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setSuccessMessage(null);
                    setMode('edit');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0060c4] hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{t('editReviewAction')}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ================= CHẾ ĐỘ TẠO MỚI HOẶC CHỈNH SỬA ================= */
            <>
              <div className="flex flex-col items-center mb-6">
                <p className="text-sm font-bold text-slate-700 mb-3">
                  {mode === 'edit'
                    ? t('changeRatingPrompt')
                    : t('howWasTripPrompt')}
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        className={`w-10 h-10 ${
                          star <= (hoverRating || rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-100 text-slate-200'
                        } transition-colors`}
                      />
                    </button>
                  ))}
                </div>
                <div className="h-6 mt-2">
                  <span className="text-sm font-bold text-amber-500">
                    {getRatingLabel(hoverRating || rating)}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('additionalCommentOptional')}
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('commentPlaceholder')}
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                {mode === 'edit' && (
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    disabled={isSubmitting}
                    className="px-4 h-12 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {tCommon('cancel')}
                  </button>
                )}
                <button
                  type="button"
                  disabled={rating === 0 || isSubmitting}
                  onClick={handleSubmitCreateOrEdit}
                  className="flex-1 h-12 bg-[#0060c4] hover:bg-blue-700 text-white font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('savingReview')}</span>
                    </>
                  ) : mode === 'edit' ? (
                    t('saveChanges')
                  ) : (
                    t('sendReview')
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal xác nhận xóa đánh giá */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {t('deleteReviewConfirmTitle')}
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {t('deleteReviewConfirmDesc')}
            </p>
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('deleting')}</span>
                  </>
                ) : (
                  <span>{t('deleteReviewAction')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
