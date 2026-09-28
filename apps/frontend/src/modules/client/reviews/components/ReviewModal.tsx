'use client';

import React, { useState } from 'react';
import { Star, X } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripInfo?: {
    route: string;
    date: string;
    busBrand: string;
  };
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, tripInfo }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {!submitted ? (
          <>
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h2 className="font-black text-lg text-slate-900">Đánh giá chuyến đi</h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-slate-500 mb-1">{tripInfo?.busBrand || 'Nhà xe Phương Đông'}</p>
                <h3 className="font-bold text-slate-800">{tripInfo?.route || 'TP. Hồ Chí Minh đi Đà Lạt'}</h3>
                <p className="text-xs text-slate-400 mt-1">{tripInfo?.date || '22:30, 17/09/2026'}</p>
              </div>

              <div className="flex flex-col items-center mb-6">
                <p className="text-sm font-bold text-slate-700 mb-3">Bạn đánh giá chuyến đi này thế nào?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className="transition-transform hover:scale-110 focus:outline-none"
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
                <label className="block text-sm font-bold text-slate-700 mb-2">Nhận xét thêm (Không bắt buộc)</label>
                <textarea 
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm của bạn về tài xế, chất lượng xe..."
                  className="w-full p-3 rounded-xl border border-slate-300 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-sm resize-none"
                />
              </div>

              <button 
                disabled={rating === 0}
                onClick={() => setSubmitted(true)}
                className="w-full h-12 bg-brand text-white font-black rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Gửi đánh giá
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 fill-emerald-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Cảm ơn bạn đã đánh giá!</h2>
            <p className="text-sm text-slate-500">Phản hồi của bạn giúp chúng tôi cải thiện chất lượng dịch vụ mỗi ngày.</p>
            <button 
              onClick={onClose}
              className="mt-6 w-full h-11 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewModal;
