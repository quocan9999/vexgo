/* eslint-disable */
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';

export const PopularRoutesSection: React.FC = () => {
  const routesData = [
    {
      id: 'from-hcm',
      title: 'Tuyến xe từ',
      city: 'TP Hồ Chí Minh',
      origin: 'TP.HCM',
      img: '/images/route1.jpg',
      routes: [
        { dest: 'Đà Lạt', target: 'Đà Lạt', price: 'từ 180.000đ', distance: '310km', time: '8 giờ' },
        { dest: 'Vũng Tàu', target: 'Vũng Tàu', price: 'từ 200.000đ', distance: '100km', time: '2.5 giờ' },
        { dest: 'Nha Trang', target: 'Nha Trang', price: 'từ 290.000đ', distance: '430km', time: '8.5 giờ' },
      ],
    },
    {
      id: 'from-dalat',
      title: 'Tuyến xe từ',
      city: 'Đà Lạt',
      origin: 'Đà Lạt',
      img: '/images/route2.jpg',
      routes: [
        { dest: 'TP. Hồ Chí Minh', target: 'TP.HCM', price: 'từ 180.000đ', distance: '310km', time: '8 giờ' },
        { dest: 'Nha Trang', target: 'Nha Trang', price: 'từ 290.000đ', distance: '135km', time: '4 giờ' },
        { dest: 'Đà Nẵng', target: 'Đà Nẵng', price: 'từ 350.000đ', distance: '700km', time: '14 giờ' },
      ],
    },
    {
      id: 'from-danang',
      title: 'Tuyến xe từ',
      city: 'Đà Nẵng',
      origin: 'Đà Nẵng',
      img: '/images/route3.jpg',
      routes: [
        { dest: 'Đà Lạt', target: 'Đà Lạt', price: 'từ 350.000đ', distance: '700km', time: '14 giờ' },
        { dest: 'TP. Hồ Chí Minh', target: 'TP.HCM', price: 'từ 450.000đ', distance: '900km', time: '18 giờ' },
        { dest: 'Nha Trang', target: 'Nha Trang', price: 'từ 300.000đ', distance: '550km', time: '10 giờ' },
      ],
    },
  ];

  const getTodayDate = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
  };

  const buildSearchHref = (origin: string, destination: string) => {
    const params = new URLSearchParams({
      from: origin,
      to: destination,
      departureDate: getTodayDate(),
    });
    return `/trips?${params.toString()}`;
  };

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-xl md:text-2xl font-black text-brand uppercase tracking-wide">
            Tuyến phổ biến
          </h2>
          <p className="text-sm text-slate-500 font-semibold mt-1">
            Được khách hàng quan tâm
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {routesData.map((group) => (
            <div
              key={group.id}
              className="group rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 bg-white hover:-translate-y-1 flex flex-col justify-between"
            >
              {/* Header Image */}
              <div>
                <div className="relative h-[190px] w-full overflow-hidden">
                  <Image
                    src={group.img}
                    alt={group.city}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <p className="text-xs font-medium text-slate-200">{group.title}</p>
                    <h3 className="text-2xl font-black tracking-tight drop-shadow-sm">
                      {group.city}
                    </h3>
                  </div>
                </div>

                {/* Route List */}
                <div className="p-4 sm:p-5 flex flex-col divide-y divide-slate-100">
                  {group.routes.map((route, idx) => (
                    <Link
                      href={buildSearchHref(group.origin, route.target)}
                      key={idx}
                      className="group/item flex justify-between items-center py-3.5 hover:bg-slate-50/80 rounded-xl px-2.5 -mx-1.5 transition-colors"
                    >
                      <div className="min-w-0 pr-2">
                        <h4 className="text-sm font-bold text-slate-800 group-hover/item:text-brand transition-colors">
                          {route.dest}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          {route.distance} · {route.time}
                        </p>
                      </div>
                      <div className="text-sm sm:text-base font-extrabold text-[#17243B] group-hover/item:text-[#FF5722] transition-colors shrink-0">
                        {route.price}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                <Link
                  href={`/trips?from=${encodeURIComponent(group.origin)}`}
                  className="flex items-center justify-between text-xs font-bold text-brand hover:text-brand-hover transition-colors py-1.5"
                >
                  <span>Xem tất cả chuyến từ {group.origin}</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
