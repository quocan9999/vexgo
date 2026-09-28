'use client';

import React from 'react';
import { ProfileSidebar } from '../components/ProfileSidebar';
import { EyeOff } from 'lucide-react';

export const ProfilePasswordClientPage: React.FC = () => {
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
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-black text-slate-900">Đặt lại mật khẩu</h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu cho người khác</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 md:p-10 max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900">(+84) 0333075738</h3>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>Mật khẩu cũ
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu cũ" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <EyeOff className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Nhập mật khẩu mới" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <EyeOff className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Nhập lại mật khẩu" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <EyeOff className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 justify-center pt-8">
                  <button 
                    type="button"
                    className="px-8 py-2.5 border border-slate-300 rounded-full text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    type="button"
                    className="px-8 py-2.5 bg-accent text-white rounded-full font-black hover:bg-accent-hover shadow-md shadow-accent/20 transition-all"
                  >
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
