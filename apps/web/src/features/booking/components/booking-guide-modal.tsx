'use client';

import React from 'react';
import {
  X,
  Search,
  Armchair,
  FileText,
  QrCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export interface BookingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    step: '1',
    icon: Search,
    title: 'Tìm chuyến xe',
    desc: 'Nhập điểm đi, điểm đến, ngày khởi hành và số lượng vé mong muốn. Nhấn "Tìm chuyến" để xem danh sách chuyến xe của các nhà xe uy tín.',
    tag: 'Tra cứu nhanh',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  {
    step: '2',
    icon: Armchair,
    title: 'Chọn chỗ ngồi ưng ý',
    desc: 'Quan sát sơ đồ ghế trực quan theo tầng (tầng 1, tầng 2, gần cửa sổ hay lối đi). Chọn đúng vị trí mong muốn và kiểm tra thời gian đón/trả.',
    tag: 'Xem sơ đồ thực tế',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  {
    step: '3',
    icon: FileText,
    title: 'Thông tin & Mã ưu đãi',
    desc: 'Điền họ tên, số điện thoại và email nhận vé. Đừng quên chọn hoặc nhập mã giảm giá VexGo để được chiết khấu trực tiếp trên đơn.',
    tag: 'Tiết kiệm chi phí',
    color: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    step: '4',
    icon: QrCode,
    title: 'Quét VietQR & Nhận vé ngay',
    desc: 'Quét mã VietQR tiện lợi bằng mọi ứng dụng ngân hàng. Hệ thống xác nhận giao dịch tức thì, xuất vé điện tử kèm mã QR lên màn hình và gửi về Email.',
    tag: 'Thanh toán tức thì',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-rose-50 text-rose-600 border-rose-200',
  },
];

export const BookingGuideModal: React.FC<BookingGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-guide-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05123] text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="booking-guide-title"
                className="text-base sm:text-lg font-black text-slate-900 tracking-tight"
              >
                Hướng dẫn đặt vé trực tuyến
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                4 bước đơn giản để sở hữu vé xe khách nhanh chóng trên VexGo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-[#f05123]/40 hover:shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f05123] text-white text-xs font-black shadow-2xs">
                          {item.step}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                          {item.title}
                        </h3>
                      </div>
                      <div className={`p-1.5 rounded-lg ${item.bg} shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 font-medium">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      {item.tag}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      ✓ Trực tuyến
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Notes / Highlights */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4">
            <h4 className="text-xs font-black text-[#0060c4] uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-4 h-4 text-[#0060c4]" />
              Lưu ý quan trọng khi đi xe
            </h4>
            <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
              <li className="flex items-start gap-1.5">
                <span className="text-[#f05123] font-bold">•</span>
                <span>
                  Có mặt tại bến hoặc điểm đón trước giờ khởi hành ít nhất <strong>20 - 30 phút</strong> để làm thủ tục lên xe.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#f05123] font-bold">•</span>
                <span>
                  Xuất trình <strong>vé điện tử trên website hoặc Email</strong> có mã vé và mã QR cho nhân viên phụ xe / tài xế để lên xe.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#f05123] font-bold">•</span>
                <span>
                  Hỗ trợ đổi/hủy vé trực tuyến nhanh chóng theo quy định của từng nhà xe qua mục <strong>Hủy vé</strong> trên thanh điều hướng.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <QrCode className="w-4 h-4 text-[#f05123]" />
            <span>Tổng đài CSKH 24/7: <strong className="text-slate-900">1900 6067</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#f05123] hover:bg-[#d8441a] text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
