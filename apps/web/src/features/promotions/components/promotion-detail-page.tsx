'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import {
  Tag,
  Calendar,
  Copy,
  Check,
  ArrowRight,
  Bus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type Promotion, PROMOTIONS } from '../data/promotions.data';

export function PromotionDetailPage({ promotion }: { promotion?: Promotion }) {
  const router = useRouter();
  const t = useTranslations('promotions');
  const locale = useLocale();

  if (!promotion) {
    notFound();
  }

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(promotion.code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const otherPromos = PROMOTIONS.filter((p) => p.id !== promotion.id);

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
          {/* Left Column: Promotion Article & Details */}
          <article className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8">
            {/* Header info */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-[#FF5722] text-white">
                {promotion.discountBadge}
              </span>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {t('durationLabel', { start: promotion.startDate, end: promotion.endDate })}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 uppercase leading-snug tracking-tight mb-4">
              {promotion.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed mb-6">
              {promotion.summary}
            </p>

            {/* Banner image */}
            <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden mb-8 bg-slate-100 shadow-inner">
              <Image
                src={promotion.img}
                alt={promotion.alt}
                fill
                priority
                className="object-cover"
              />
            </div>

            {/* Voucher Box */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border-2 border-dashed border-amber-300 rounded-2xl p-6 sm:p-7 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-800 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF5722]" />
                    {t('exclusiveVoucher')}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-slate-900">
                    {promotion.code}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {promotion.discountValue}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#FF5722] hover:bg-[#E64A19] text-white hover:shadow-md'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{t('copiedCodeExclamation')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t('copyCode')}</span>
                      </>
                    )}
                  </button>
                  <Link
                    href={`/${locale}/trips`}
                    className="px-5 py-3 rounded-xl border border-[#FF5722] text-[#FF5722] hover:bg-orange-50 text-sm font-bold transition-all text-center"
                  >
                    {t('useNow')}
                  </Link>
                </div>
              </div>
            </div>

            {/* Detailed Description */}
            <section className="mb-8">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-[#FF5722]" />
                {t('introTitle')}
              </h2>
              <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                {promotion.description.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </section>

            {/* Terms and Conditions */}
            <section className="mb-8 pt-6 border-t border-slate-100">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#FF5722]" />
                {t('termsTitle')}
              </h2>
              <ul className="space-y-2 text-sm text-slate-600 leading-relaxed list-disc list-inside bg-slate-50 p-5 rounded-xl border border-slate-100">
                {promotion.conditions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>

            {/* How to apply guide */}
            <section className="mb-8 pt-6 border-t border-slate-100">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF5722]" />
                {t('guideTitle')}
              </h2>
              <div className="space-y-2.5 text-sm text-slate-600">
                {promotion.guide.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-[#FF5722] font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="text-slate-700 font-medium">{step}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Applicable Routes Box */}
            {promotion.applicableRoutes.length > 0 && (
              <section className="pt-6 border-t border-slate-100">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Bus className="w-5 h-5 text-[#FF5722]" />
                  {t('applicableRoutesTitle')}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {promotion.applicableRoutes.map((route, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-[#FF5722] transition-colors flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">{route.label}</span>
                        <span className="text-xs font-semibold text-[#FF5722]">{route.price}</span>
                      </div>
                      <Link
                        href={`/${locale}/trips?from=${encodeURIComponent(route.origin)}&to=${encodeURIComponent(route.destination)}`}
                        className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-[#FF5722] text-[#FF5722] hover:text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1"
                      >
                        {t('bookTicket')} <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Right Column: Sidebar with Action & other promos */}
          <aside className="space-y-6">
            {/* Quick Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 text-[#FF5722] flex items-center justify-center mx-auto mb-4">
                <Bus className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                {t('bookYourTrip')}
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                {t('applyVoucherPrompt', { code: promotion.code })}
              </p>
              <Link
                href={`/${locale}/trips`}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#FF5722] to-[#E64A19] text-white text-sm font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all flex items-center justify-center gap-2"
              >
                <span>{t('findTripsNow')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Other Promotions list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mb-4">
                {t('otherPromosTitle')}
              </h3>
              <div className="space-y-4">
                {otherPromos.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${locale}/promotions/${item.id}`}
                    className="group block pb-4 border-b border-slate-100 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[#FF5722]">
                        {item.discountBadge}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500">
                        {item.code}
                      </span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#FF5722] transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {t('expiresOn', { date: item.endDate })}
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
