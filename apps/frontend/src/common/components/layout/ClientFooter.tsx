// /src/common/components/layout/ClientFooter.tsx
import React from 'react';
import Link from 'next/link';
import {
  Bus,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';

export const ClientFooter: React.FC = () => {
  return (
    <footer className="bg-red-600 text-slate-300 pt-16 pb-8 border-t border-red-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* 4 Cột chính */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-14 border-b border-red-700 pb-12">
          {/* Cột 1: Logo & Mô tả */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-brand-dark flex items-center justify-center font-bold">
                <Bus className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Bus<span className="text-amber-400">Way</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              Nền tảng đặt vé xe khách trực tuyến, tra cứu vé, thanh toán điện tử và gửi hàng theo tuyến xe một cách nhanh chóng, minh bạch.
            </p>
          </div>

          {/* Cột 2: Liên kết nhanh */}
          <div className="space-y-3">
            <h4 className="text-white text-sm font-bold tracking-wide">
              Liên kết nhanh
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              <li>
                <Link href="/" className="hover:text-amber-400 transition-colors">
                  Trang chủ
                </Link>
              </li>
              <li>
                <Link href="/posts?needType=BUY" className="hover:text-amber-400 transition-colors">
                  Chuyến xe
                </Link>
              </li>
              <li>
                <Link href="/posts?needType=RENT" className="hover:text-amber-400 transition-colors">
                  Gửi hàng
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-amber-400 transition-colors">
                  Giới thiệu
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-amber-400 transition-colors">
                  Liên hệ
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 3: Dịch vụ phổ biến */}
          <div className="space-y-3">
            <h4 className="text-white text-sm font-bold tracking-wide">
              Dịch vụ phổ biến
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
              <li>
                <Link href="/posts?propertyType=RESIDENTIAL_LAND" className="hover:text-amber-400 transition-colors">
                  Đặt vé xe
                </Link>
              </li>
              <li>
                <Link href="/posts?propertyType=TOWNHOUSE" className="hover:text-amber-400 transition-colors">
                  Tra cứu vé
                </Link>
              </li>
              <li>
                <Link href="/posts?propertyType=APARTMENT" className="hover:text-amber-400 transition-colors">
                  Hủy vé
                </Link>
              </li>
              <li>
                <Link href="/posts?propertyType=COMMERCIAL" className="hover:text-amber-400 transition-colors">
                  Gửi hàng hóa
                </Link>
              </li>
            </ul>
          </div>

          {/* Cột 4: Liên hệ */}
          <div className="space-y-3">
            <h4 className="text-white text-sm font-bold tracking-wide">
              Liên hệ
            </h4>
            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Hotline: <strong className="text-white font-semibold">1900 6789</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>support@busway.vn</span>
              </p>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Tầng 8, Tòa nhà Landmark, 123 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Dưới cùng */}
        <div className="border-t border-emerald-900/60 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© 2026 BusWay. Bảo lưu mọi quyền.</p>

          <div className="flex items-center gap-6">
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-amber-400 transition-colors font-medium"
            >
              Quản trị hệ thống
            </a>

            {/* Social SVGs */}
            <div className="flex items-center gap-3 text-slate-400">
              {/* Facebook SVG */}
              <a href="#" className="hover:text-white transition-colors" aria-label="Facebook">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              {/* Youtube SVG */}
              <a href="#" className="hover:text-white transition-colors" aria-label="Youtube">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              {/* TikTok SVG */}
              <a href="#" className="hover:text-white transition-colors" aria-label="TikTok">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
