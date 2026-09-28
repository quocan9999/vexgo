'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export const TicketSearchClientPage: React.FC = () => {
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-16 px-4">
      <h1 className="text-xl md:text-2xl font-bold text-brand mb-10 text-center uppercase tracking-wide">
        TRA CỨU THÔNG TIN ĐẶT VÉ
      </h1>
      
      <div className="w-full max-w-2xl space-y-5">
        <input 
          type="text" 
          placeholder="Vui lòng nhập số điện thoại" 
          className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-accent transition-colors"
        />
        
        <input 
          type="text" 
          placeholder="Vui lòng nhập mã vé" 
          className="w-full h-12 px-4 rounded-xl border border-slate-300 focus:outline-none focus:border-accent transition-colors"
        />

        <div className="pt-6 flex justify-center">
          <button 
            type="button"
            onClick={() => router.push('/invoice/BW-888999')}
            className="px-16 py-3 bg-accent text-white font-black text-base rounded-full hover:bg-accent-hover transition-colors shadow-sm duration-300"
          >
            Tra cứu
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketSearchClientPage;
