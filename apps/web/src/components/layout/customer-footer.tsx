// frontend/src/modules/client/common/components/CustomerFooter.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { VexGoMark } from '@/components/ui/vexgo-logo';

export const CustomerFooter: React.FC = () => {
  const t = useTranslations('footer');

  return (
    <footer className="bg-[#E8272B] text-white/90 pt-14 pb-8 border-t border-[#CC1D20] font-sans">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/15">
          {/* Cột 1: Thông tin thương hiệu */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="transition-transform group-hover:scale-105">
                <VexGoMark size={32} variant="red" />
              </div>
              <div className="text-2xl font-extrabold tracking-[-0.03em]">
                <span className="text-white">vex</span>
                <b className="font-extrabold text-[#FFB81C]">go</b>
              </div>
            </Link>
            <p className="text-xs text-white/80 leading-relaxed">
              {t('aboutDesc')}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>

              {/* YouTube */}
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 transition-colors"
                aria-label="YouTube"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Cột 2: Dịch vụ */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('services')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/trips" className="hover:text-white transition-colors">
                  {t('scheduleBooking')}
                </Link>
              </li>
              <li>
                <Link href="/shipments/new" className="hover:text-white transition-colors">
                  {t('sendFreight')}
                </Link>
              </li>
              <li>
                <Link href="/promotions" className="hover:text-white transition-colors">
                  {t('promotions')}
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:text-white transition-colors">
                  {t('news')}
                </Link>
              </li>
              <li>
                <Link href="/account/tickets" className="hover:text-white transition-colors">
                  {t('myTickets')}
                </Link>
              </li>
              <li>
                <Link href="/trips?type=Limousine" className="hover:text-white transition-colors">
                  {t('limousine')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 3: Liên kết nhanh */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('usefulLinks')}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  {t('aboutVexgo')}
                </Link>
              </li>
              <li>
                <Link href="/tickets/lookup" className="hover:text-white transition-colors">
                  {t('ticketLookup')}
                </Link>
              </li>
              <li>
                <Link href="/cancel-ticket" className="hover:text-white transition-colors">
                  {t('cancelTicket')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  {t('contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 4: Thông tin liên hệ */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('headquarters')}
            </h4>
            <div className="space-y-2.5 text-xs text-white/80">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                <span>{t('locationDesc')}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>{t('hotline')}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-300 flex-shrink-0" />
                <span>support@vexgo.vn</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bản quyền */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>© {new Date().getFullYear()} VexGo. {t('copyright')}</p>
          <div className="flex items-center gap-4 text-white/60">
            <span>{t('privacy')}</span>
            <span>·</span>
            <span>{t('terms')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default CustomerFooter;
