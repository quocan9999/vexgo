'use client';

import React from 'react';
import Link from 'next/link';
import { ProfileSidebar } from '@/modules/client/profile/components/ProfileSidebar';
import { Search } from 'lucide-react';

export const MyPostsClientPage: React.FC = () => {
  // Mock data for the table based on the screenshot
  const tableData = [
    { id: 'P8TC6YF7', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '15:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TT3H2X', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '15:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TXFXKP', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '15:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TX42SG', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '13:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TH5K6N', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '13:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TSE9B1', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '13:30 18-08-2026', price: '185.000đ' },
    { id: 'P8TXV0S2', count: 1, route: 'Mien Tay - Vung Liem (Vinh Long)', date: '13:30 18-08-2026', price: '185.000đ' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] py-8 md:py-12">
      <div className="max-w-[1050px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-[280px] shrink-0">
            <ProfileSidebar />
          </div>
          
          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900">Lịch sử mua vé</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Theo dõi và quản lý quá trình lịch sử mua vé của bạn</p>
                </div>
                <Link href="/posts?needType=BUY" className="bg-accent hover:bg-accent-hover text-white px-6 py-2 rounded-full text-sm font-black shadow-sm transition-colors">
                  Đặt vé
                </Link>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.2fr_1fr_auto] gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mã vé</label>
                  <input type="text" placeholder="Nhập Mã vé" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Thời gian</label>
                  <input type="date" className="w-full text-sm px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent text-slate-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tuyến đường</label>
                  <input type="text" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Trạng thái</label>
                  <select className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-accent bg-white text-slate-500 transition-colors">
                    <option value="">Tất cả</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="w-full lg:w-auto px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors h-[38px]">
                    Tìm
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-t-lg">
                <table className="w-full text-sm text-center">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Mã vé</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">Số vé</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">Tuyến đường</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">Ngày đi</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">Số tiền</th>
                      <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap border-l border-slate-200">Thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFBEB]'}>
                        <td className="px-4 py-3 font-bold text-accent whitespace-nowrap">{row.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 border-l border-slate-100">{row.count}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 border-l border-slate-100">{row.route}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 border-l border-slate-100">{row.date}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 border-l border-slate-100">{row.price}</td>
                        <td className="px-4 py-3 font-medium text-slate-700 border-l border-slate-100"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-end gap-4 mt-6">
                <div className="flex items-center gap-2">
                  <select className="border border-slate-200 rounded-md px-2 py-1 text-sm bg-white outline-none">
                    <option>10</option>
                  </select>
                </div>
                <div className="text-sm font-medium text-slate-600">
                  Tổng số: 12
                </div>
                <div className="flex gap-1">
                  <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50">&lt;</button>
                  <button className="w-8 h-8 flex items-center justify-center border border-accent bg-accent text-white rounded font-bold">1</button>
                  <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-700 hover:bg-slate-50">2</button>
                  <button className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:bg-slate-50">&gt;</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
