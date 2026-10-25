/* eslint-disable */
'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, Star, X } from 'lucide-react';
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
}

export const ReviewDialog: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  tripId,
  tripInfo,
  onSuccess,
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
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setErrorMessage(null);

    if (!tripId) {
      setSubmitted(true);
      return;
    }

    if (!isAuthenticated || !executeWithAuth) {
      setErrorMessage(
        'Vui lòng đăng nhập tài khoản khách hàng để gửi đánh giá chuyến đi này.',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await executeWithAuth((token) =>
        reviewsApi.createReview(token, {
          tripId,
          rating,
          comment: comment.trim() || undefined,
        }),
      );
      setSubmitted(true);
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể gửi đánh giá. Vui lòng thử lại sau.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setHoverRating(0);
    setComment('');
    setSubmitted(false);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {!submitted ? (
          <>
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h2 className="font-black text-lg text-slate-900">
                Đánh giá chuyến đi
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">
                  {tripInfo?.busBrand || 'Nhà xe Phương Trang'}
                </p>
                <h3 className="font-bold text-slate-800">
                  {tripInfo?.route || 'TP. Hồ Chí Minh đi Đà Lạt'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {tripInfo?.date || 'Hành trình vừa qua'}
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col items-center mb-6">
                <p className="text-sm font-bold text-slate-700 mb-3">
                  Bạn đánh giá chuyến đi này thế nào?
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
                    {rating === 1 && 'Rất tệ'}
                    {rating === 2 && 'Tệ'}
                    {rating === 3 && 'Bình thường'}
                    {rating === 4 && 'Tốt'}
                    {rating === 5 && 'Tuyệt vời'}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nhận xét thêm (Không bắt buộc)
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn về tài xế, chất lượng xe..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm resize-none"
                />
              </div>

              <button
                type="button"
                disabled={rating === 0 || isSubmitting}
                onClick={handleSubmit}
                className="w-full h-12 bg-[#0060c4] hover:bg-blue-700 text-white font-black rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang gửi đánh giá...</span>
                  </>
                ) : (
                  'Gửi đánh giá'
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 fill-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Cảm ơn bạn đã đánh giá!
            </h2>
            <p className="text-sm text-slate-500">
              Phản hồi của bạn giúp nhà xe và VexGo không ngừng nâng cao chất
              lượng phục vụ mỗi ngày.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 w-full h-11 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
