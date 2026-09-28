'use client';

import React from 'react';
import Link from 'next/link';
import { Bus, Package, Ticket, CarFront } from 'lucide-react';

export const EcosystemClient: React.FC = () => {
  const ecosystem = [
    {
      icon: <CarFront className="w-8 h-8" />,
      title: 'Xe Hợp Đồng',
      active: false
    },
    {
      icon: <Ticket className="w-8 h-8" />,
      title: 'Mua vé BUSWAY',
      active: true
    },
    {
      icon: <Package className="w-8 h-8" />,
      title: 'Giao Hàng',
      active: false
    },
    {
      icon: <Bus className="w-8 h-8" />,
      title: 'Xe Buýt',
      active: false
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-black text-brand uppercase">
            KẾT NỐI HỆ SINH THÁI BUSWAY
          </h2>
          <p className="text-sm text-slate-500 font-semibold mt-2 max-w-xl mx-auto">
            Kết nối đa dạng hệ sinh thái BUSWAY qua App: mua vé xe khách, xe buýt, xe hợp đồng, giao hàng...
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 sm:gap-12 md:gap-20">
          {ecosystem.map((item, idx) => (
            <Link href="#" key={idx} className="flex flex-col items-center gap-3 group">
              <div 
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  item.active 
                    ? 'bg-amber-50 text-accent ring-2 ring-amber-100' 
                    : 'bg-slate-50 text-slate-400 group-hover:bg-amber-50 group-hover:text-accent border border-slate-100'
                }`}
              >
                {item.icon}
              </div>
              <span className={`text-base font-bold ${item.active ? 'text-accent' : 'text-slate-600 group-hover:text-accent'}`}>
                {item.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};
