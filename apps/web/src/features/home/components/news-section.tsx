/* eslint-disable */
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, ArrowRight } from 'lucide-react';
import { NEWS_ARTICLES } from '@/features/news/data/news.data';

export const NewsSection: React.FC = () => {
  return (
    <section className="py-12 md:py-16 bg-[#F8FAFC]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="text-center md:text-left flex-1">
            <h2 className="text-xl md:text-2xl font-black text-brand uppercase tracking-wide">
              TIN TỨC MỚI
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Cập nhật những thông tin mới từ VexGo
            </p>
          </div>
          <Link
            href="/news"
            className="text-sm font-bold text-[#FF5722] hover:text-[#E64A19] hover:underline flex items-center justify-center md:justify-end gap-1 transition-colors"
          >
            <span>Xem tất cả tin tức</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {NEWS_ARTICLES.map((news) => (
            <Link
              key={news.id}
              href={`/news/${news.id}`}
              className="group text-left bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col h-full focus:outline-none focus:ring-2 focus:ring-[#FF5722]"
            >
              <div className="relative pt-[58%] overflow-hidden bg-slate-100">
                <Image
                  src={news.img}
                  alt={news.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3.5 left-3.5">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide bg-black/60 backdrop-blur-xs text-white">
                    {news.categoryLabel}
                  </span>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-sm sm:text-[15px] font-extrabold text-slate-900 group-hover:text-brand transition-colors line-clamp-2 uppercase leading-snug">
                    {news.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {news.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">{news.date}</span>
                  <span className="font-extrabold text-[#FF5722] group-hover:text-[#E64A19] flex items-center gap-0.5 transition-colors">
                    Chi tiết <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
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
