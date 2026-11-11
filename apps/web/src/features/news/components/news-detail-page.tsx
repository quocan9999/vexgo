'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Bus,
  Share2,
  Tag,
  Newspaper,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type NewsArticle, NEWS_ARTICLES } from '../data/news.data';

export function NewsDetailPage({ article }: { article?: NewsArticle }) {
  const router = useRouter();
  const t = useTranslations('news');
  const locale = useLocale();

  if (!article) {
    notFound();
  }

  const otherArticles = NEWS_ARTICLES.filter((a) => a.id !== article.id);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans">
      {/* Back Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[15px] font-medium text-slate-700 hover:text-[#FF5722] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>{t('back')}</span>
          </button>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Main Article Content */}
          <article className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 md:p-10">
            {/* Category & Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-[#FF5722] text-white">
                {article.categoryLabel}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {article.date}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {article.readTime}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {article.author}
              </span>
            </div>

            {/* Article Title */}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 leading-snug tracking-tight mb-4">
              {article.title}
            </h1>

            {/* Summary Lead Paragraph */}
            <div className="p-4 rounded-xl bg-slate-50 border-l-4 border-[#FF5722] text-sm sm:text-base font-semibold text-slate-700 leading-relaxed mb-6">
              {article.summary}
            </div>

            {/* Featured Image */}
            <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden mb-8 bg-slate-100 shadow-inner">
              <Image
                src={article.img}
                alt={article.title}
                fill
                priority
                className="object-cover"
              />
            </div>

            {/* Article Body Content */}
            <div className="space-y-6 text-sm sm:text-base text-slate-700 leading-relaxed">
              {article.content.map((section, idx) => (
                <div key={idx} className="space-y-3">
                  {section.heading && (
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight mt-6 mb-2">
                      {section.heading}
                    </h2>
                  )}
                  {section.text.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>
              ))}
            </div>

            {/* Related Route CTA Box (if any) */}
            {article.relatedRoute && (
              <div className="mt-8 p-5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF5722] text-white flex items-center justify-center shrink-0">
                    <Bus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {t('relatedRouteTitle')}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t('relatedRouteDesc', { route: article.relatedRoute.label })}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/${locale}/trips?from=${encodeURIComponent(article.relatedRoute.origin)}&to=${encodeURIComponent(article.relatedRoute.destination)}`}
                  className="px-5 py-2.5 rounded-xl bg-[#FF5722] hover:bg-[#E64A19] text-white text-xs sm:text-sm font-bold shadow-sm transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  <span>{t('findTicketsForRoute')}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Tags */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2">
                <Tag className="w-3.5 h-3.5" />
                {t('topicLabel')}
              </span>
              {article.tags.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600"
                >
                  #{t}
                </span>
              ))}
            </div>
          </article>

          {/* Right Column: Sidebar */}
          <aside className="space-y-6">
            {/* Booking Quick CTA */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 text-[#FF5722] flex items-center justify-center mx-auto mb-4">
                <Bus className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                {t('onlineBookingTitle')}
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                {t('onlineBookingDesc')}
              </p>
              <Link
                href={`/${locale}/trips`}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF5722] to-[#E64A19] text-white text-sm font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all flex items-center justify-center gap-2"
              >
                <span>{t('findTripsNow')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Related Articles */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-[#FF5722]" />
                {t('relatedArticles')}
              </h3>
              <div className="space-y-4">
                {otherArticles.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${locale}/news/${item.id}`}
                    className="group block pb-4 border-b border-slate-100 last:border-b-0 last:pb-0"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF5722] block mb-1">
                      {item.categoryLabel}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#FF5722] transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {item.date} • {item.readTime}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
