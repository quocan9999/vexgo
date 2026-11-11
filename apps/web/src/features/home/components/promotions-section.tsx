/* eslint-disable */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Copy, Check, X, Tag, Calendar, Bus, Percent } from 'lucide-react';

interface PromoItem {
  id: number;
  title: string;
  desc: string;
  code: string;
  discount: string;
  tag: string;
  img: string;
  alt: string;
  expiry: string;
  conditions: string[];
}

export const PromotionsSection: React.FC = () => {
  const [selectedPromo, setSelectedPromo] = useState<PromoItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const promos: PromoItem[] = [
    {
      id: 1,
      title: 'Ưu đãi vé xe mới - Giảm 10%',
      desc: 'Giảm tối đa 50.000đ cho chuyến đi liên tỉnh đầu tiên',
      code: 'FUTA10',
      discount: 'Giảm 10% (Tối đa 50.000đ)',
      tag: 'GIẢM 10%',
      img: '/images/promo2.jpg',
      alt: 'Khuyến mãi vé xe khách giảm 10%',
      expiry: '31/12/2026',
      conditions: [
        'Áp dụng cho khách hàng đặt vé xe khách lần đầu trên nền tảng VexGo.',
        'Mức giảm 10% trên tổng giá vé, tối đa 50.000đ mỗi đơn hàng.',
        'Áp dụng cho tất cả các tuyến xe khách liên tỉnh đang mở bán.',
        'Nhập mã tại bước thanh toán để được giảm trừ tiền tự động.',
      ],
    },
    {
      id: 2,
      title: 'Giảm 30K vé Limousine & khứ hồi',
      desc: 'Tiết kiệm trực tiếp khi đặt vé phòng nằm VIP 2 chiều',
      code: 'FUTAFIX30K',
      discount: 'Giảm ngay 30.000đ',
      tag: 'GIẢM 30K',
      img: '/images/promo1.jpg',
      alt: 'Ưu đãi xe Limousine và vé khứ hồi',
      expiry: '31/12/2026',
      conditions: [
        'Áp dụng khi đặt vé xe Limousine phòng nằm hoặc đặt vé khứ hồi 2 chiều.',
        'Giảm thẳng 30.000đ vào tổng hóa đơn thanh toán vé xe.',
        'Không giới hạn số lần sử dụng trong thời gian diễn ra chương trình.',
        'Áp dụng đồng thời với các tiện ích chọn chỗ và đón trả tận nơi.',
      ],
    },
    {
      id: 3,
      title: 'Đồng hành mùa du lịch - Vé từ 180K',
      desc: 'Khám phá TP.HCM - Đà Lạt - Nha Trang giá tốt nhất',
      code: 'VEXGO2026',
      discount: 'Ưu đãi tuyến hot từ 180.000đ',
      tag: 'HOT DEAL',
      img: '/images/promo3.jpg',
      alt: 'Khuyến mãi tuyến đường du lịch hot',
      expiry: '31/12/2026',
      conditions: [
        'Áp dụng cho các tuyến du lịch trọng điểm: TP.HCM - Đà Lạt, Phan Thiết, Nha Trang, Vũng Tàu.',
        'Cam kết giữ đúng vị trí chỗ ngồi đã chọn 100%.',
        'Hỗ trợ đổi giờ khởi hành hoặc hủy vé theo chính sách linh hoạt của nhà xe.',
        'Số lượng vé ưu đãi mở bán có hạn mỗi ngày.',
      ],
    },
  ];

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <section className="py-12 md:py-16 bg-[#F8FAFC]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="text-center md:text-left flex-1">
            <h2 className="text-xl md:text-2xl font-black text-brand uppercase tracking-wide">
              Khuyến mãi nổi bật
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Các chương trình ưu đãi giảm giá vé xe khách hấp dẫn dành riêng cho bạn
            </p>
          </div>
          <Link
            href="/promotions"
            className="text-sm font-bold text-[#FF5722] hover:text-[#E64A19] hover:underline flex items-center justify-center md:justify-end gap-1 transition-colors"
          >
            <span>Xem tất cả ưu đãi</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {promos.map((promo) => (
            <Link
              key={promo.id}
              href={`/promotions/${promo.id}`}
              className="group block relative rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200/80 bg-white hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#FF5722]"
            >
              <div className="relative pt-[62%] overflow-hidden bg-slate-200">
                <Image
                  src={promo.img}
                  alt={promo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Dark gradient overlay at the bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                {/* Tag and Code badges */}
                <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wide bg-[#FF5722] text-white shadow-xs">
                    {promo.tag}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCopyCode(promo.code);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider bg-black/60 hover:bg-[#FF5722] backdrop-blur-xs text-amber-300 hover:text-white border border-white/20 transition-all cursor-pointer"
                    title="Bấm để sao chép mã"
                  >
                    {copiedCode === promo.code ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>ĐÃ CHÉP</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>MÃ: {promo.code}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Content over image */}
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 flex items-end justify-between gap-3 text-white">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-extrabold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {promo.title}
                    </h3>
                    <p className="text-xs text-slate-200/90 line-clamp-1 mt-0.5">
                      {promo.desc}
                    </p>
                  </div>

                  {/* Circular Orange Arrow Button */}
                  <div className="w-9 h-9 rounded-full bg-[#FF5722] text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 group-hover:bg-[#E64A19] transition-all">
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pagination dots */}
        <div className="flex justify-center items-center gap-2 mt-8">
          <span className="w-8 h-2 rounded-full bg-[#FF5722] transition-all" />
          <span className="w-2 h-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-colors cursor-pointer" />
          <span className="w-2 h-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-colors cursor-pointer" />
        </div>
      </div>
    </section>
  );
};
