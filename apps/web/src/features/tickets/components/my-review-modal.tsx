/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Edit3,
  Loader2,
  MessageSquare,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useAuthSession } from '@/features/auth/auth-session';
import { reviewsApi } from '@/features/tickets/services/reviews.api';

export interface MyReviewData {
  id?: number;
  tripId: number;
  rating: number;
  comment: string | null;
  createdAt?: string;
  isEdited?: boolean;
  isEditable?: boolean;
  routeName?: string;
  busBrand?: string;
  date?: string;
  reply?: {
    content: string;
    createdAt: string | null;
    responderName: string;
  } | null;
}

export interface MyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  review: MyReviewData | null;
  onUpdated?: (updated: { tripId: number; rating: number; comment: string | null }) => void;
  onDeleted?: (tripId: number) => void;
}

export const MyReviewModal: React.FC<MyReviewModalProps> = ({
  isOpen,
  onClose,
  review,
  onUpdated,
  onDeleted,
}) => {
  let authContext: ReturnType<typeof useAuthSession> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuthSession();
  } catch {
    authContext = null;
  }
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const executeWithAuth = authContext?.executeWithAuth;

  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [editComment, setEditComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (review) {
      setEditRating(review.rating);
      setEditComment(review.comment || '');
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setErrorMessage(null);
      setSuccessToast(null);
    }
  }, [review, isOpen]);

  const canEdit = React.useMemo(() => {
    if (review?.isEditable !== undefined) {
      return review.isEditable;
    }
    if (!review?.createdAt) return true;
    const createdMs = new Date(review.createdAt).getTime();
    if (isNaN(createdMs)) return true;
    return Date.now() - createdMs <= 3 * 24 * 60 * 60 * 1000;
  }, [review]);

  if (!isOpen || !review) return null;

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1:
        return 'Rất tệ';
      case 2:
        return 'Tệ';
      case 3:
        return 'Bình thường';
      case 4:
        return 'Tốt';
      case 5:
        return 'Tuyệt vời';
      default:
        return '';
    }
  };

  const handleUpdate = async () => {
    if (!canEdit) {
      setErrorMessage(
        'Đã quá thời hạn 3 ngày kể từ khi gửi đánh giá, bạn không thể chỉnh sửa nhận xét này nữa.',
      );
      return;
    }
    if (editRating === 0) {
      setErrorMessage('Vui lòng chọn số sao đánh giá (1-5 sao).');
      return;
    }
    if (!isAuthenticated || !executeWithAuth) {
      setErrorMessage('Vui lòng đăng nhập để thực hiện cập nhật.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await executeWithAuth((token) =>
        reviewsApi.updateTripReview(token, review.tripId, {
          rating: editRating,
          comment: editComment.trim() || undefined,
        }),
      );

      setSuccessToast('Đã cập nhật đánh giá thành công!');
      setIsEditing(false);
      onUpdated?.({
        tripId: review.tripId,
        rating: editRating,
        comment: editComment.trim() || null,
      });

      setTimeout(() => {
        setSuccessToast(null);
      }, 3000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể cập nhật đánh giá.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isAuthenticated || !executeWithAuth) {
      setErrorMessage('Vui lòng đăng nhập để thực hiện xóa đánh giá.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await executeWithAuth((token) =>
        reviewsApi.deleteTripReview(token, review.tripId),
      );
      onDeleted?.(review.tripId);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xóa đánh giá.';
      setErrorMessage(msg);
      setIsDeleting(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', {
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

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-base">
                {isEditing ? 'Chỉnh sửa đánh giá' : 'Đánh giá của bạn'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {review.busBrand || 'Chuyến xe VexGo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {/* Thông tin chuyến xe */}
          <div className="mb-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-semibold text-slate-500 mb-1">
              Hành trình chuyến đi:
            </div>
            <div className="text-sm font-bold text-slate-900">
              {review.routeName || 'Chuyến xe đã trải nghiệm'}
            </div>
            {review.date && (
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Khởi hành: {review.date}</span>
              </div>
            )}
          </div>

          {/* Success / Error Alerts */}
          {successToast && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successToast}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!isEditing ? (
            /* ================= VIEW MODE ================= */
            <div className="space-y-5">
              {/* Điểm đánh giá sao */}
              <div className="flex flex-col items-center justify-center p-4 bg-amber-50/60 rounded-2xl border border-amber-100">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">
                  Điểm đánh giá
                </span>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-7 h-7 ${
                        star <= review.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-slate-200 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-extrabold text-amber-700 text-base">
                    {review.rating}/5
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-700">
                    {getRatingLabel(review.rating)}
                  </span>
                </div>
                {review.createdAt && (
                  <span className="text-[11px] text-slate-400 mt-1 font-medium">
                    Gửi lúc {formatDate(review.createdAt)}
                    {review.isEdited && (
                      <span className="italic ml-1">· (Đã chỉnh sửa)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Nội dung nhận xét / comment */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nội dung bạn đã nhận xét:</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {review.comment ? (
                    `“${review.comment}”`
                  ) : (
                    <span className="text-slate-400 italic">
                      Bạn không để lại nhận xét bằng chữ cho chuyến đi này.
                    </span>
                  )}
                </div>
              </div>

              {/* Phản hồi từ nhà xe (nếu có) */}
              {review.reply && (
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-slate-800">
                  <div className="flex items-center justify-between gap-2 font-bold text-blue-900 mb-1">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#0060c4]" />
                      Phản hồi từ {review.reply.responderName || review.busBrand || 'Nhà xe'}:
                    </span>
                    {review.reply.createdAt && (
                      <span className="text-[11px] text-slate-400 font-normal">
                        {formatDate(review.reply.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {review.reply.content}
                  </p>
                </div>
              )}

              {/* Thao tác Chỉnh sửa & Xóa bên dưới cmt */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                  title="Xóa đánh giá này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa đánh giá</span>
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                    title="Chỉnh sửa nội dung hoặc điểm sao (trong vòng 3 ngày)"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Chỉnh sửa đánh giá</span>
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium"
                    title="Đã quá 3 ngày kể từ khi gửi đánh giá, không thể chỉnh sửa"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-300" />
                    <span>Hết hạn chỉnh sửa (sau 3 ngày)</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* ================= EDIT MODE ================= */
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Chọn lại số sao */}
              <div className="flex flex-col items-center">
                <p className="text-sm font-bold text-slate-700 mb-2">
                  Thay đổi mức đánh giá
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setEditRating(star)}
                    >
                      <Star
                        className={`w-9 h-9 ${
                          star <= (hoverRating || editRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-slate-100 text-slate-200'
                        } transition-colors`}
                      />
                    </button>
                  ))}
                </div>
                <div className="h-5 mt-1.5">
                  <span className="text-xs font-bold text-amber-600">
                    {getRatingLabel(hoverRating || editRating)}
                  </span>
                </div>
              </div>

              {/* Sửa lại nhận xét */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Chỉnh sửa nhận xét trải nghiệm
                </label>
                <textarea
                  rows={4}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn về tài xế, chất lượng xe, sự đúng giờ..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-sm resize-none"
                />
              </div>

              {/* Nút hành động Lưu & Hủy */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditRating(review.rating);
                    setEditComment(review.comment || '');
                    setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={editRating === 0 || isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Lưu thay đổi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal when Delete is clicked */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Xác nhận xóa đánh giá?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa đánh giá của mình cho chuyến đi này không? Sau khi xóa, bạn có thể thực hiện đánh giá lại bất kỳ lúc nào.
            </p>
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
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
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xóa đánh giá</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
