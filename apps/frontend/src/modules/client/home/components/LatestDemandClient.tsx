// frontend/src/modules/client/home/components/LatestDemandClient.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PropertyDemand } from '../../property/models/property.model';
import { PropertyCard } from '../../property/components/PropertyCard';
import { QuoteModal } from '../../property/components/QuoteModal';

export interface LatestDemandClientProps {
  postFilterTab: 'ALL' | 'BUY' | 'RENT';
  setPostFilterTab: (tab: 'ALL' | 'BUY' | 'RENT') => void;
  posts: PropertyDemand[];
}

export const LatestDemandClient: React.FC<LatestDemandClientProps> = ({
  postFilterTab,
  setPostFilterTab,
  posts,
}) => {
  const [quotePost, setQuotePost] = useState<PropertyDemand | null>(null);

  const filteredPosts = posts.filter((p) => {
    if (postFilterTab === 'ALL') return true;
    return p.needType === postFilterTab;
  });

  return (
    <section className="py-12 bg-white border-y border-slate-200/80 font-sans">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header + Tabs Filter */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-950 tracking-normal">
              Chuyến xe đang mở bán
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Các chuyến còn chỗ, có thể chọn ghế và thanh toán online ngay.
            </p>
          </div>

          {/* 3 Tabs: Tất cả, Đặt vé, Gửi hàng */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
            <button
              type="button"
              onClick={() => setPostFilterTab('ALL')}
              className={`px-4 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                postFilterTab === 'ALL'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setPostFilterTab('BUY')}
              className={`px-4 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                postFilterTab === 'BUY'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đặt vé
            </button>
            <button
              type="button"
              onClick={() => setPostFilterTab('RENT')}
              className={`px-4 py-2 rounded-md text-xs font-bold cursor-pointer transition-colors ${
                postFilterTab === 'RENT'
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gửi hàng
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredPosts.slice(0, 4).map((post) => (
            <PropertyCard
              key={post.id}
              post={post}
              onOpenQuote={(p) => setQuotePost(p)}
            />
          ))}
        </div>

        {/* Nút Xem tất cả */}
        <div className="mt-10 text-center">
          <Link href="/posts">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm shadow-xs cursor-pointer transition-colors"
            >
              <span>Xem tất cả chuyến xe</span>
              <ArrowRight className="w-4 h-4 text-brand" />
            </button>
          </Link>
        </div>
      </div>

      {/* Quote Modal Popup */}
      <QuoteModal
        post={quotePost}
        isOpen={!!quotePost}
        onClose={() => setQuotePost(null)}
      />
    </section>
  );
};

export default LatestDemandClient;
