// /src/modules/client/my-posts/components/MyPostEditModal.tsx
import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import type { MyPostItem } from '../models/my-posts.model';

interface MyPostEditModalProps {
  post: MyPostItem | null;
  onClose: () => void;
  onSave: (updatedPost: MyPostItem) => void;
}

export const MyPostEditModal: React.FC<MyPostEditModalProps> = ({
  post,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<MyPostItem>>(post ? { ...post } : {});

  if (!post) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.priceRange || !formData.location) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    // If payment failed, editing and saving returns it to pending payment.
    const updatedStatus = post.status === 'REJECTED' ? 'PENDING' : post.status;

    onSave({
      ...post,
      ...formData,
      status: updatedStatus,
      rejectReason: post.status === 'REJECTED' ? undefined : post.rejectReason,
    } as MyPostItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <h3 className="text-base font-bold text-slate-900">
            Chỉnh Sửa Vé / Vận Đơn - <span className="text-emerald-800 font-extrabold">{post.id}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {post.status === 'REJECTED' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 font-medium">
              <strong>Lưu ý:</strong> Sau khi cập nhật, yêu cầu sẽ chuyển về trạng thái <strong>Chờ thanh toán</strong>.
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              Tuyến / dịch vụ <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs font-medium"
              placeholder="Nhập tiêu đề..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Price */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-900 block">
                Giá vé / cước phí <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.priceRange || ''}
                onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs font-medium"
                placeholder="Ví dụ: 420.000 VNĐ"
                required
              />
            </div>

            {/* Area */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-900 block">Ghế / khối lượng</label>
              <input
                type="text"
                value={formData.areaRange || ''}
                onChange={(e) => setFormData({ ...formData, areaRange: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs font-medium"
                placeholder="Ví dụ: Ghế A05 hoặc 12 kg"
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">
              Tuyến đường <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs font-medium"
              placeholder="Nhập điểm đi - điểm đến"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block">Ghi chú chi tiết</label>
            <textarea
              rows={4}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 text-xs font-medium"
              placeholder="Điểm đón, điểm trả, hành khách, hàng hóa, người nhận..."
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-brand-dark hover:bg-brand-hover text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
