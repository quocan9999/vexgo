// /src/modules/client/my-posts/components/MyPostDetailModal.tsx
import React from 'react';
import { X, Bus, PackageCheck, Clock, ShieldCheck, XCircle, MapPin, Coins, Armchair, Phone, User, Calendar } from 'lucide-react';
import type { MyPostItem } from '../models/my-posts.model';

interface MyPostDetailModalProps {
  post: MyPostItem | null;
  onClose: () => void;
  onEdit: (post: MyPostItem) => void;
}

export const MyPostDetailModal: React.FC<MyPostDetailModalProps> = ({
  post,
  onClose,
  onEdit,
}) => {
  if (!post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-brand-dark bg-emerald-100 px-2.5 py-1 rounded-lg">
              {post.id}
            </span>
            <span className="text-slate-300">|</span>
            <h3 className="text-base font-bold text-slate-900">Chi Tiết Vé / Vận Đơn</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold ${
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
              <span>{post.needType === 'BUY' ? 'ĐẶT VÉ' : 'GỬI HÀNG'}</span>
            </span>

            {post.status === 'PENDING' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                <Clock className="w-3.5 h-3.5" />
                <span>Trạng thái: Chờ thanh toán</span>
              </span>
            )}
            {post.status === 'APPROVED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-brand border border-emerald-200/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Trạng thái: Đã thanh toán</span>
              </span>
            )}
            {post.status === 'REJECTED' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                <XCircle className="w-3.5 h-3.5" />
                <span>Trạng thái: Thanh toán lỗi</span>
              </span>
            )}
          </div>

          <h2 className="text-lg font-extrabold text-slate-900 leading-snug">{post.title}</h2>

          {/* Details Table Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl text-xs text-slate-600 border border-slate-200/80 space-y-2 sm:space-y-0">
            <div className="space-y-2">
              <p className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Giá vé / cước phí:{' '}
                  <strong className="text-brand-dark font-extrabold text-sm">{post.priceRange}</strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Armchair className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  Ghế / khối lượng: <strong className="text-slate-900 font-semibold">{post.areaRange}</strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  Tuyến: <strong className="text-slate-900 font-semibold">{post.location}</strong>
                </span>
              </p>
            </div>

            <div className="space-y-2 sm:border-l sm:border-slate-200/80 sm:pl-4">
              <p className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  Hành khách / người gửi: <strong className="text-slate-900 font-semibold">{post.contactName}</strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-brand flex-shrink-0" />
                <span>
                  Số điện thoại:{' '}
                  <strong className="text-brand font-bold">{post.contactPhone}</strong>
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  Ngày tạo: <strong className="text-slate-800">{post.createdAt}</strong>
                </span>
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ghi chú nghiệp vụ:
            </h4>
            <div className="text-sm leading-relaxed text-slate-700 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80 whitespace-pre-wrap">
              {post.description}
            </div>
          </div>

          {/* Reject Reason (If Rejected) */}
          {post.status === 'REJECTED' && post.rejectReason && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-1">
              <span className="font-extrabold block text-rose-900">Lý do thanh toán lỗi:</span>
              <p className="font-medium leading-relaxed text-rose-700">{post.rejectReason}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer transition-all"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(post);
            }}
            className="px-6 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-accent-hover text-white font-bold text-xs shadow-md cursor-pointer transition-all"
          >
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
};
