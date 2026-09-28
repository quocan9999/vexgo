'use client';

import React from 'react';
import { Building2, Users, Bus } from 'lucide-react';

export const WhyUsClient: React.FC = () => {
  const stats = [
    {
      icon: <Users className="w-6 h-6 text-accent" />,
      title: 'Hơn 40 Triệu',
      subtitle: 'Lượt khách',
      desc: 'BUSWAY phục vụ hơn 40 triệu lượt khách bình quân 1 năm trên toàn quốc'
    },
    {
      icon: <Building2 className="w-6 h-6 text-accent" />,
      title: 'Hơn 350',
      subtitle: 'Phòng vé - Bưu cục',
      desc: 'Hơn 350 phòng vé, trạm trung chuyển, bến xe... trên toàn hệ thống'
    },
    {
      icon: <Bus className="w-6 h-6 text-accent" />,
      title: 'Hơn 6,500',
      subtitle: 'Chuyến xe',
      desc: 'Phục vụ hơn 6,500 chuyến xe đường dài và liên tỉnh mỗi ngày'
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-xl md:text-2xl font-black text-brand uppercase">
            BUSWAY - CHẤT LƯỢNG LÀ DANH DỰ
          </h2>
          <p className="text-sm text-slate-500 font-semibold mt-1">23 Năm Vững Tin & Phát Triển</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center shrink-0 border border-red-100">
                  {stat.icon}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {stat.title} <span className="text-base font-bold text-slate-600">{stat.subtitle}</span>
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 font-medium">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="hidden md:flex justify-center items-center">
             <img src="/images/promo1.jpg" alt="Chất lượng là danh dự" className="max-w-full rounded-2xl shadow-lg border border-slate-100" />
          </div>
        </div>
      </div>
    </section>
  );
};
