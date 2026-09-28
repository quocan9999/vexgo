'use client';

import React from 'react';
import Link from 'next/link';

export const PopularRoutesClient: React.FC = () => {
  const routesData = [
    {
      id: 'from-hcm',
      title: 'Tuyến xe từ',
      city: 'TP Hồ Chí Minh',
      img: '/images/route1.jpg',
      routes: [
        { dest: 'Đà Lạt', price: '300.000đ', distance: '310km', time: '8 giờ' },
        { dest: 'Cần Thơ', price: '165.000đ', distance: '170km', time: '4 giờ' },
        { dest: 'Long Xuyên', price: '200.000đ', distance: '200km', time: '6 giờ' },
      ]
    },
    {
      id: 'from-dalat',
      title: 'Tuyến xe từ',
      city: 'Đà Lạt',
      img: '/images/route2.jpg',
      routes: [
        { dest: 'TP. Hồ Chí Minh', price: '300.000đ', distance: '310km', time: '8 giờ' },
        { dest: 'Đà Nẵng', price: '350.000đ', distance: '700km', time: '14 giờ' },
        { dest: 'Cần Thơ', price: '450.000đ', distance: '450km', time: '11 giờ' },
      ]
    },
    {
      id: 'from-danang',
      title: 'Tuyến xe từ',
      city: 'Đà Nẵng',
      img: '/images/route3.jpg',
      routes: [
        { dest: 'Đà Lạt', price: '400.000đ', distance: '700km', time: '14 giờ' },
        { dest: 'TP. Hồ Chí Minh', price: '500.000đ', distance: '900km', time: '20 giờ' },
        { dest: 'Nha Trang', price: '450.000đ', distance: '550km', time: '10 giờ' },
      ]
    }
  ];

  return (
    <section className="py-12 bg-white">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-black text-brand uppercase">
            Tuyến phổ biến
          </h2>
          <p className="text-sm text-slate-500 font-semibold mt-1">Được khách hàng quan tâm</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {routesData.map(group => (
            <div key={group.id} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
              {/* Header Image */}
              <div className="relative h-[180px] w-full">
                <img 
                  src={group.img} 
                  alt={group.city} 
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <p className="text-xs font-semibold">{group.title}</p>
                  <h3 className="text-xl font-black">{group.city}</h3>
                </div>
              </div>

              {/* Route List */}
              <div className="p-4 flex flex-col">
                {group.routes.map((route, idx) => (
                  <Link 
                    href="/posts?needType=BUY" 
                    key={idx}
                    className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{route.dest}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{route.distance} - {route.time}</p>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {route.price}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
