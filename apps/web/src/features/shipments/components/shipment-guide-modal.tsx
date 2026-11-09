'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  MapPin,
  Box,
  Users,
  PackageCheck,
  ShieldCheck,
  Package,
  Headphones,
} from 'lucide-react';

export interface ShipmentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShipmentGuideModal: React.FC<ShipmentGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const t = useTranslations('shipments');
  if (!isOpen) return null;

  const STEPS = [
    {
      step: '1',
      icon: MapPin,
      title: t('step1Title'),
      desc: t('step1Desc'),
      tag: t('step1Tag'),
      color: 'from-blue-500 to-indigo-600',
      bg: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      step: '2',
      icon: Box,
      title: t('step2Title'),
      desc: t('step2Desc'),
      tag: t('step2Tag'),
      color: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      step: '3',
      icon: Users,
      title: t('step3Title'),
      desc: t('step3Desc'),
      tag: t('step3Tag'),
      color: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      step: '4',
      icon: PackageCheck,
      title: t('step4Title'),
      desc: t('step4Desc'),
      tag: t('step4Tag'),
      color: 'from-orange-500 to-amber-600',
      bg: 'bg-orange-50 text-orange-600 border-orange-200',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shipment-guide-title"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f05123] text-white shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="shipment-guide-title"
                className="text-base sm:text-lg font-black text-slate-900 tracking-tight"
              >
                {t('guideTitle')}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {t('guideSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label={t('close')}
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
                  className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-[#2563EB]/40 hover:shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white text-xs font-black shadow-2xs">
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
                      {t('onlineBadge')}
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
              {t('importantNotes')}
            </h4>
            <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
              <li className="flex items-start gap-1.5">
                <span className="text-[#2563EB] font-bold">•</span>
                <span>{t('note1')}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#2563EB] font-bold">•</span>
                <span>{t('note2')}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#2563EB] font-bold">•</span>
                <span>{t('note3')}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#f05123] font-bold">•</span>
                <span>{t('note4')}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Headphones className="w-4 h-4 text-[#f05123]" />
            <span>{t('hotlineLabel')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#f05123] hover:bg-[#d8441a] text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer active:scale-95"
          >
            {t('gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};
