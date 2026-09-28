'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const NewsClient: React.FC = () => {
  const newsList = [
    {
      id: 1,
      title: 'CHÍNH THỨC NÂNG CẤP XE BUÝT ĐIỆN CHUYẾN 14 - "XANH" HƠN - TỐT HƠN',
      date: '28/08/2026',
      img: '/images/promo2.jpg',
    },
    {
      id: 2,
      title: 'ĐẶT VÉ XE BUÝT NHANH CHÓNG - TIỆN LỢI TRÊN APP',
      date: '16/08/2026',
      img: '/images/promo1.jpg',
    },
    {
      id: 3,
      title: 'TĂNG TẦN SUẤT CHUYẾN BUÝT 171 LÊN 80 CHUYẾN/NGÀY',
      date: '24/06/2026',
      img: '/images/promo3.jpg',
    }
  ];

  return (
    <section className="py-12 bg-[#F5F5F5]">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="text-center md:text-left flex-1">
            <h2 className="text-xl md:text-2xl font-black text-brand uppercase">
              TIN TỨC MỚI
            </h2>
            <p className="text-sm text-slate-500 font-semibold mt-1">Cập nhật những thông tin mới từ BUSWAY</p>
          </div>
          <Link href="#" className="text-sm font-bold text-accent hover:underline flex items-center justify-center md:justify-end gap-1">
            Xem tất cả
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {newsList.map(news => (
            <Link href="#" key={news.id} className="block bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
              <div className="relative pt-[56.25%] overflow-hidden">
                <img 
                  src={news.img} 
                  alt={news.title} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 group-hover:text-accent transition-colors line-clamp-2 uppercase">
                    {news.title}
                  </h3>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">{news.date}</span>
                  <span className="text-xs font-bold text-accent flex items-center gap-0.5">
                    Chi tiết <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        <div className="flex justify-center gap-2 mt-8">
          <span className="w-8 h-2 rounded-full bg-accent"></span>
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
        </div>
      </div>
    </section>
  );
};
