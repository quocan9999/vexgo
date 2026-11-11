/* eslint-disable */
'use client';

import React from 'react';
import { Building2, Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

export const DonationPage: React.FC = () => {
  const t = useTranslations('donation');

  return (
    <div className="max-w-4xl mx-auto my-12 px-4 font-sans space-y-8">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
          <Heart className="w-4 h-4 text-amber-600 fill-amber-600" />
          <span>{t('badge')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tài khoản 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-brand border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>{t('account1Title')}</span>
          </div>
          <div className="space-y-2.5 text-xs text-slate-700">
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('bankLabel')}</span>
              <strong className="text-slate-900">Vietcombank</strong>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">{t('accountNumberLabel')}</span>
              <strong className="text-base font-mono font-extrabold text-amber-700">
                1029384756
              </strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('accountHolderLabel')}</span>
              <strong className="text-slate-900">NGUYEN TAN DONG</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('branchLabel')}</span>
              <strong className="text-slate-900">{t('branch1')}</strong>
            </p>
          </div>
        </div>

        {/* Tài khoản 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-brand border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>{t('account2Title')}</span>
          </div>
          <div className="space-y-2.5 text-xs text-slate-700">
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('bankLabel')}</span>
              <strong className="text-slate-900">MB Bank</strong>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">{t('accountNumberLabel')}</span>
              <strong className="text-base font-mono font-extrabold text-amber-700">
                888899998888
              </strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('accountHolderLabel')}</span>
              <strong className="text-slate-900">CONG TY VexGo</strong>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-400 font-medium">{t('branchLabel')}</span>
              <strong className="text-slate-900">{t('branch2')}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
