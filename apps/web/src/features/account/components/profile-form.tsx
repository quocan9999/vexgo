'use client';

import React from 'react';

export const ProfileForm: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:p-8">
      <div className="mb-8 border-b border-slate-100 pb-4">
        <h2 className="text-xl md:text-2xl font-black text-slate-900">Thông tin tài khoản</h2>
        <p className="text-sm text-slate-500 mt-1 font-medium">Quản lý thông tin hồ sơ để bảo mật tài khoản</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4 w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-100 pb-8 md:pb-0 md:pr-8">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-50 shadow-sm">
            <img 
              src="/images/avatar.jpg" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
          <button 
            type="button" 
            className="px-6 py-2 border border-slate-300 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            Chọn ảnh
          </button>
          <div className="text-center text-xs text-slate-500 max-w-[180px]">
            <p>Dung lượng file tối đa 1 MB</p>
            <p>Định dạng: JPEG, .PNG</p>
          </div>
        </div>

        {/* Form Fields Section */}
        <div className="flex-1 space-y-5">
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Họ và tên</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="text" defaultValue="Khách Hàng" className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>
          
          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Số điện thoại</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="text" defaultValue="0987654321" className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Giới tính</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <select className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent">
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Email</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="email" defaultValue="khachhang@example.com" className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Ngày sinh</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="date" defaultValue="1990-01-01" className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Địa chỉ</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="text" placeholder="Nhập địa chỉ" className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-[120px_1fr] items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 text-right">Nghề nghiệp</label>
            <div className="font-bold text-slate-900 flex items-center gap-3">
              <span>:</span>
              <input type="text" placeholder="Nhập nghề nghiệp" className="flex-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-accent focus:outline-none py-1 transition-colors" />
            </div>
          </div>

          <div className="pt-6 grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button className="w-fit bg-accent hover:bg-accent-hover text-white font-black text-sm px-10 py-3 rounded-full shadow-md shadow-accent/20 transition-all">
              Cập nhật
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
