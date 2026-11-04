'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Newspaper, Calendar, Clock, ChevronRight, ArrowRight, User } from 'lucide-react';
import { NEWS_ARTICLES, type NewsArticle } from '../data/news.data';

export function NewsListPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = [
    { id: 'ALL', label: 'Tất cả tin tức' },
    { id: 'TIN_TUC', label: 'Tin vận tải & xe khách' },
    { id: 'HUONG_DAN', label: 'Hướng dẫn đặt vé' },
  ];

  const filteredArticles =
    selectedCategory === 'ALL'
      ? NEWS_ARTICLES
      : NEWS_ARTICLES.filter((a) => a.category === selectedCategory);

  const featured = NEWS_ARTICLES[0];
  const rest = filteredArticles.filter((a) => a.id !== (selectedCategory === 'ALL' ? featured.id : ''));

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans">
      {/* Breadcrumb Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-[#FF5722] transition-colors">
            Trang chủ
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-slate-900 font-bold">Tin tức</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#101D35] to-[#203550] text-white py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FF5722] text-white uppercase tracking-wider mb-4">
              <Newspaper className="w-3.5 h-3.5" />
              Tin tức VexGo
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-tight mb-3">
              Tin tức & Cẩm nang xe khách
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Cập nhật thông tin tuyến xe mới, hướng dẫn đặt vé điện tử thông minh và cẩm nang di chuyển liên tỉnh an toàn.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none mb-8 border-b border-slate-200">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#FF5722] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Featured Article on Top (when "ALL" selected) */}
        {selectedCategory === 'ALL' && featured && (
          <div className="mb-10">
            <Link
              href={`/news/${featured.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 grid grid-cols-1 md:grid-cols-2 gap-6 items-center hover:-translate-y-1"
            >
              <div className="relative h-64 sm:h-80 md:h-full min-h-[260px] overflow-hidden bg-slate-100">
                <Image
                  src={featured.img}
                  alt={featured.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-[#FF5722] text-white shadow-xs">
                    {featured.categoryLabel}
                  </span>
                </div>
              </div>

              <div className="p-6 md:p-8 flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-medium mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {featured.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {featured.readTime}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 group-hover:text-[#FF5722] transition-colors leading-snug mb-3">
                    {featured.title}
                  </h2>

                  <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed mb-6">
                    {featured.summary}
                  </p>
                </div>

                <div className="flex items-center gap-1 text-sm font-bold text-[#FF5722] group-hover:underline">
                  <span>Đọc toàn bộ bài viết</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map((article) => (
            <Link
              key={article.id}
              href={`/news/${article.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1"
            >
              <div className="relative pt-[58%] overflow-hidden bg-slate-100">
                <Image
                  src={article.img}
                  alt={article.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3.5 left-3.5">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-black/60 backdrop-blur-xs text-white">
                    {article.categoryLabel}
                  </span>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-2.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {article.date}
                    </span>
                    <span>•</span>
                    <span>{article.readTime}</span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#FF5722] transition-colors line-clamp-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {article.summary}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#FF5722]">
                  <span>Chi tiết bài viết</span>
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
