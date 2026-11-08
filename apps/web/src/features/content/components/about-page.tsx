/* eslint-disable */
'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Target, Award, Users, Building2, 
  ShieldCheck, Zap, ArrowRight, 
  TrendingUp, Briefcase, Crown, CheckCircle2 
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

export const AboutPageContent: React.FC = () => {
  const t = useTranslations('content.about');
  const locale = useLocale();

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen font-sans">
      
      {/* Hero Section */}
      <section className="relative w-full bg-[#0f2e24] pt-12 pb-24 lg:pt-16 lg:pb-28 overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-900/40 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4"></div>
        
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-brand-light text-xs font-bold tracking-widest uppercase mb-8 backdrop-blur-sm">
            <Crown className="w-4 h-4" />
            <span>{t('badge')}</span>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-[1.2] tracking-tight mb-4 max-w-4xl mx-auto">
            {t('heroTitlePrefix')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFC700] to-amber-300">
              {t('heroTitleHighlight')}
            </span>
          </h1>

          <p className="text-sm md:text-base text-emerald-100/80 max-w-2xl mx-auto leading-relaxed mb-8 font-medium">
            {t('heroDesc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`/${locale}/trips`} className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-black text-[14px] transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 group">
              {t('findTrips')}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href={`/${locale}/contact`} className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[14px] backdrop-blur-md transition-all flex items-center justify-center gap-2 border border-white/10">
              {t('contactPartner')}
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section (Overlapping) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 relative z-20 -mt-12">
        <div className="bg-white rounded-[20px] p-5 lg:p-6 shadow-xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          <div className="flex flex-col items-center text-center pt-3 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">5,000<span className="text-emerald-500">+</span></h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('statCustomers')}</p>
          </div>

          <div className="flex flex-col items-center text-center pt-5 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Briefcase className="w-5 h-5" />
            </div>
            <h4 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">10k<span className="text-blue-500">+</span></h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('statTickets')}</p>
          </div>

          <div className="flex flex-col items-center text-center pt-5 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">100<span className="text-rose-500">%</span></h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('statEtickets')}</p>
          </div>

          <div className="flex flex-col items-center text-center pt-5 md:pt-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-2xl lg:text-3xl font-black text-slate-900 mb-1">24/7</h4>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('statSupport')}</p>
          </div>

        </div>
      </section>

      {/* Core Values Section */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-[#0f2e24] mb-3 leading-tight">{t('coreValuesTitle')}</h2>
          <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed font-medium">
            {t('coreValuesDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          <div className="group bg-white p-5 lg:p-6 rounded-[20px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-[60px] -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#0f2e24] text-accent flex items-center justify-center mb-5 shadow-lg group-hover:-translate-y-1 transition-transform">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">{t('missionTitle')}</h3>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                {t('missionDesc')}
              </p>
            </div>
          </div>

          <div className="group bg-white p-5 lg:p-6 rounded-[20px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-[60px] -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5 shadow-lg shadow-blue-600/30 group-hover:-translate-y-1 transition-transform">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">{t('visionTitle')}</h3>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                {t('visionDesc')}
              </p>
            </div>
          </div>

          <div className="group bg-white p-5 lg:p-6 rounded-[20px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-[60px] -z-0 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-accent text-[#0f2e24] flex items-center justify-center mb-5 shadow-lg shadow-amber-500/30 group-hover:-translate-y-1 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">{t('coreValTitle')}</h3>
              <p className="text-[13px] text-slate-600 leading-relaxed font-medium">
                {t('coreValDesc')}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Why Choose Us */}
      <section className="w-full bg-white py-16 lg:py-20 border-y border-slate-100">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
            
            <div className="w-full lg:w-[60%] space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-brand text-xs font-bold tracking-widest uppercase">
                <ShieldCheck className="w-3.5 h-3.5" /> {t('benefitsBadge')}
              </div>
              <h2 className="text-2xl lg:text-3xl font-black text-[#0f2e24] leading-[1.25]">
                {t('whyTitle')}
              </h2>
              <p className="text-[13px] md:text-[14px] text-slate-600 leading-relaxed font-medium">
                {t('whyDesc')}
              </p>

              <div className="space-y-4 pt-3 pr-0 lg:pr-10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 mb-1">{t('benefit1Title')}</h4>
                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{t('benefit1Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 mb-1">{t('benefit2Title')}</h4>
                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium">{t('benefit2Desc')}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-[40%]">
              <div className="relative rounded-[24px] overflow-hidden bg-[#0f2e24] aspect-square lg:aspect-[4/3] flex items-center justify-center p-5 shadow-xl">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                <div className="relative z-10 text-center space-y-3">
                  <Building2 className="w-14 h-14 md:w-16 md:h-16 text-accent mx-auto opacity-90" />
                  <h3 className="text-xl md:text-2xl font-black text-white leading-snug">{t('heroTitlePrefix')} <br/> {t('heroTitleHighlight')}</h3>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-20 text-center px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[#0f2e24] leading-[1.2]">
            {t('ctaTitle')}
          </h2>
          <p className="text-[14px] md:text-[15px] text-slate-600 mb-5 font-medium">
            {t('ctaDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link href={`/${locale}/register`} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0f2e24] hover:bg-black text-white font-black text-[13px] transition-all shadow-xl shadow-[#0f2e24]/20 flex items-center justify-center gap-2">
              {t('registerNow')}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

export default AboutPageContent;
