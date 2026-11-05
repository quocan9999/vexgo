/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowUpDown,
  Calendar,
  Clock,
  Loader2,
  MessageSquare,
  Route,
  Star,
  X,
} from 'lucide-react';
import {
  reviewsApi,
  type ReviewItem,
  type ReviewsResponse,
} from '@/features/tickets/services/reviews.api';

interface TripReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  busCompanyId?: number;
  tripId?: number;
  operatorName: string;
  rating?: number;
  reviewsCount?: number;
  route?: string;
}

function formatDate(isoOrDateString?: string | null): string {
  if (!isoOrDateString) return '—';
  try {
    // Nếu là định dạng YYYY-MM-DD thì hiển thị DD/MM/YYYY trực tiếp tránh lệch timezone
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDateString)) {
      const [year, month, day] = isoOrDateString.split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(isoOrDateString);
    if (Number.isNaN(d.getTime())) return isoOrDateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoOrDateString;
  }
}

type StarFilter = number | '1-2' | null;

export function TripReviewsModal({
  isOpen,
  onClose,
  busCompanyId,
  tripId,
  operatorName,
  rating: propRating,
  reviewsCount: propReviewsCount,
  route,
}: TripReviewsModalProps) {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summaryRating, setSummaryRating] = useState<number | null>(
    propRating ?? null,
  );
  const [summaryCount, setSummaryCount] = useState<number>(
    propReviewsCount ?? 0,
  );
  const [selectedStar, setSelectedStar] = useState<StarFilter>(null);
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'rating_desc' | 'rating_asc'
  >('newest');
  const [onlyWithComment, setOnlyWithComment] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Reset bộ lọc khi mở modal
    setSelectedStar(null);
    setOnlyWithComment(false);
    setSortBy('newest');

    let isMounted = true;
    setLoading(true);

    async function loadReviews() {
      try {
        let res: { data: ReviewsResponse };
        if (busCompanyId) {
          res = await reviewsApi.getBusCompanyReviews(busCompanyId);
        } else if (tripId) {
          res = await reviewsApi.getTripReviews(tripId);
        } else {
          res = { data: { rating: null, reviewsCount: 0, reviews: [] } };
        }

        if (isMounted) {
          setReviews(res.data.reviews || []);
          if (res.data.rating != null) {
            setSummaryRating(res.data.rating);
          }
          if (res.data.reviewsCount != null) {
            setSummaryCount(res.data.reviewsCount);
          }
        }
      } catch (err) {
        console.error('Không thể tải đánh giá:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadReviews();

    return () => {
      isMounted = false;
    };
  }, [isOpen, busCompanyId, tripId]);

  // Đếm số lượng đánh giá có bình luận bằng chữ
  const hasCommentCount = useMemo(
    () =>
      reviews.filter((r) => r.comment && r.comment.trim().length > 0).length,
    [reviews],
  );

  // Lọc và sắp xếp đánh giá
  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    if (selectedStar !== null) {
      if (selectedStar === '1-2') {
        list = list.filter((r) => r.rating <= 2);
      } else {
        list = list.filter((r) => r.rating === selectedStar);
      }
    }

    if (onlyWithComment) {
      list = list.filter((r) => Boolean(r.comment && r.comment.trim().length > 0));
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;

      switch (sortBy) {
        case 'oldest':
          return timeA - timeB;
        case 'rating_desc':
          return b.rating - a.rating || timeB - timeA;
        case 'rating_asc':
          return a.rating - b.rating || timeB - timeA;
        case 'newest':
        default:
          return timeB - timeA;
      }
    });
  }, [reviews, selectedStar, onlyWithComment, sortBy]);

  // Early return phải đặt sau toàn bộ hooks để giữ thứ tự hook ổn định giữa các lần render.
  if (!isOpen) return null;

  // Đếm theo sao
  const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    if (starCounts[r.rating] !== undefined) {
      starCounts[r.rating]++;
    }
  }

  const effectiveRating = summaryRating ?? propRating ?? null;
  const effectiveCount = summaryCount || reviews.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Đánh giá chất lượng dịch vụ
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                {operatorName}
              </span>
            </div>
            {route && (
              <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex items-center gap-1.5">
                <Route className="w-4 h-4 text-[#f05123]" />
                {route}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Rating Summary Card */}
          <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
            <div className="flex flex-col items-center justify-center text-center shrink-0">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 flex items-center gap-1.5">
                <span>{effectiveRating ? effectiveRating.toFixed(1) : '—'}</span>
                <span className="text-2xl text-slate-400 font-bold">/5</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={18}
                    className={
                      effectiveRating && star <= Math.round(effectiveRating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-slate-200 text-slate-200'
                    }
                  />
                ))}
              </div>
              <p className="text-xs font-bold text-slate-600 mt-1.5">
                Dựa trên {effectiveCount} lượt đánh giá
              </p>
            </div>

            {/* Filter tags by star */}
            <div className="flex-1 w-full border-t sm:border-t-0 sm:border-l border-amber-200/60 pt-4 sm:pt-0 sm:pl-6">
              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
                Lọc theo số sao:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStar(null)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                    selectedStar === null
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="whitespace-nowrap">Tất cả</span>
                  <span className="text-[11px] opacity-80">({reviews.length})</span>
                </button>
                {[5, 4, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setSelectedStar(selectedStar === s ? null : s)
                    }
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                      selectedStar === s
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50/60'
                    }`}
                  >
                    <span>{s}</span>
                    <Star
                      size={12}
                      className={
                        selectedStar === s
                          ? 'fill-white text-white'
                          : 'fill-amber-400 text-amber-400'
                      }
                    />
                    <span className="text-[11px] opacity-80">
                      ({starCounts[s] || 0})
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedStar(selectedStar === '1-2' ? null : '1-2')
                  }
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                    selectedStar === '1-2'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-amber-50/60'
                  }`}
                >
                  <span className="whitespace-nowrap tabular-nums">1–2</span>
                  <Star
                    size={12}
                    className={
                      selectedStar === '1-2'
                        ? 'fill-white text-white'
                        : 'fill-amber-400 text-amber-400'
                    }
                  />
                  <span className="text-[11px] opacity-80">
                    ({(starCounts[1] || 0) + (starCounts[2] || 0)})
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Review List & Toolbar */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 shrink-0">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span>Nhận xét từ khách ({filteredReviews.length})</span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                {/* Nút lọc Chỉ hiện bài có bình luận */}
                <button
                  type="button"
                  onClick={() => setOnlyWithComment((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    onlyWithComment
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Chỉ hiển thị các đánh giá có kèm lời nhận xét bằng chữ"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Có bình luận</span>
                  <span className={`text-[11px] ${onlyWithComment ? 'text-blue-100' : 'text-slate-400'}`}>
                    ({hasCommentCount})
                  </span>
                </button>

                {/* Sắp xếp */}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as
                          | 'newest'
                          | 'oldest'
                          | 'rating_desc'
                          | 'rating_asc',
                      )
                    }
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    aria-label="Sắp xếp nhận xét"
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="rating_desc">Đánh giá cao nhất</option>
                    <option value="rating_asc">Đánh giá thấp nhất</option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#0060c4]" />
                <p className="text-sm font-semibold">Đang tải đánh giá...</p>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">
                  Chưa có nhận xét nào phù hợp
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Hành khách sau khi hoàn thành chuyến đi trên hệ thống VexGo sẽ
                  được gửi đánh giá và nhận xét trải nghiệm tại đây.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredReviews.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs"
                  >
                    {/* User header + Rating */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0060c4] font-black text-sm shrink-0">
                          {item.customerName?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {item.customerName}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={13}
                                className={
                                  star <= item.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-slate-200 text-slate-200'
                                }
                              />
                            ))}
                            <span className="text-xs font-bold text-amber-700 ml-1">
                              {item.rating}/5
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ngày bình luận */}
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                        <Calendar size={12} />
                        Đánh giá: {formatDate(item.createdAt)}
                        {item.isEdited && (
                          <span className="text-[11px] text-slate-400 font-normal italic">
                            · (Đã chỉnh sửa)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Ngày chuyến xe tương ứng có chạy */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 border border-slate-200 text-[11px] font-bold text-slate-700">
                        <Calendar size={12} className="text-[#f05123]" />
                        <span>Ngày đi:</span>
                        <span className="text-[#0060c4]">
                          {formatDate(item.tripDate)}
                          {item.tripTime ? ` · ${item.tripTime}` : ''}
                        </span>
                      </div>

                      {item.routeName && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] font-medium text-blue-700">
                          <Route size={11} className="text-[#0060c4]" />
                          <span>Tuyến: {item.routeName}</span>
                        </div>
                      )}
                    </div>

                    {/* Nội dung nhận xét */}
                    {item.comment && (
                      <p className="mt-3 text-sm text-slate-700 leading-relaxed bg-slate-50/60 p-3 rounded-lg border border-slate-100">
                        {item.comment}
                      </p>
                    )}

                    {/* Phản hồi từ nhà xe */}
                    {item.reply && (
                      <div className="mt-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-slate-800">
                        <div className="flex items-center justify-between gap-2 font-bold text-blue-900 mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-[#0060c4]" />
                            {item.reply.responderName || operatorName}
                          </span>
                          {item.reply.createdAt && (
                            <span className="text-[11px] text-slate-400 font-normal">
                              {formatDate(item.reply.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                          {item.reply.content}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
