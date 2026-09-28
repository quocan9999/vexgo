'use client';

import React from 'react';
import Link from 'next/link';

export const PromotionsClient: React.FC = () => {
  const promos = [
    { id: 1, img: '/images/promo2.jpg', alt: 'Khuyến mãi 1' },
    { id: 2, img: '/images/promo1.jpg', alt: 'Khuyến mãi 2' },
    { id: 3, img: '/images/promo3.jpg', alt: 'Khuyến mãi 3' },
  ];

  return (
    <section className="py-10 bg-[#F5F5F5]">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <h2 className="text-xl md:text-2xl font-black text-brand text-center uppercase mb-8">
          Khuyến mãi nổi bật
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {promos.map(promo => (
            <Link href="#" key={promo.id} className="block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-200 group">
              <div className="relative pt-[56.25%] overflow-hidden bg-slate-200">
                <img 
                  src={promo.img} 
                  alt={promo.alt} 
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </Link>
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-6">
          <span className="w-8 h-2 rounded-full bg-accent"></span>
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          <span className="w-2 h-2 rounded-full bg-slate-300"></span>
        </div>
      </div>
    </section>
  );
};
