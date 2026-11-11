'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag, Calendar, Copy, Check, ArrowRight, Bus, ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { PROMOTIONS, type Promotion } from '../data/promotions.data';

export function PromotionsListPage() {
  const router = useRouter();
  const t = useTranslations('promotions');
  const locale = useLocale();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const categories = [
    { id: 'ALL', label: t('categoryAll') },
    { id: 'NEW', label: t('categoryNew') },
    { id: 'LIMOUSINE', label: t('categoryLimousine') },
    { id: 'TOURISM', label: t('categoryTourism') },
  ];

  const filteredPromos =
    selectedCategory === 'ALL'
      ? PROMOTIONS
      : PROMOTIONS.filter((p) => p.category === selectedCategory);

  const handleCopy = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

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

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-[#101D35] to-[#203550] text-white py-12 md:py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FF5722] text-white uppercase tracking-wider mb-4">
              <Gift className="w-3.5 h-3.5" />
              {t('badge')}
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight uppercase leading-tight mb-3">
              {t('title')}
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              {t('subtitle')}
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

        {/* Promotions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromos.map((promo) => (
            <Link
              key={promo.id}
              href={`/${locale}/promotions/${promo.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col hover:-translate-y-1"
            >
              {/* Image banner */}
              <div className="relative pt-[58%] overflow-hidden bg-slate-100">
                <Image
                  src={promo.img}
                  alt={promo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3.5 left-3.5">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wide bg-[#FF5722] text-white shadow-xs">
                    {promo.discountBadge}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-5 flex flex-col flex-1 justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-[#FF5722] transition-colors leading-snug line-clamp-2">
                    {promo.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {promo.subtitle}
                  </p>
                </div>

                {/* Voucher Code Box */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="bg-amber-50/70 border border-dashed border-amber-300 rounded-xl p-3 flex items-center justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase font-bold text-amber-800">{t('discountCodeLabel')}</span>
                      <span className="block font-mono font-black text-sm text-slate-900 truncate">
                        {promo.code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, promo.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                        copiedCode === promo.code
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#FF5722] hover:bg-[#E64A19] text-white'
                      }`}
                    >
                      {copiedCode === promo.code ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('copy')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {t('expiresOn', { date: promo.endDate })}
                    </span>
                    <span className="text-xs font-bold text-[#FF5722] group-hover:underline flex items-center gap-0.5">
                      {t('viewDetail')} <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Travel Booking CTA Card */}
        <div className="mt-12 bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 text-[#FF5722] flex items-center justify-center shrink-0">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                {t('readyToTravel')}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {t('readyDesc')}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/trips`}
            className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF5722] to-[#E64A19] text-white text-sm font-bold shadow-md hover:shadow-lg hover:brightness-105 transition-all text-center flex items-center justify-center gap-2 shrink-0"
          >
            <span>{t('findTripsNow')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
