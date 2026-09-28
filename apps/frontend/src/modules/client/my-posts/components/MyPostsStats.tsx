// /src/modules/client/my-posts/components/MyPostsStats.tsx
import React from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, EyeOff, CheckCheck } from 'lucide-react';

interface MyPostsStatsProps {
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  hiddenCount: number;
  completedCount: number;
  expiredCount: number;
}

export const MyPostsStats: React.FC<MyPostsStatsProps> = ({
  totalCount,
  approvedCount,
  pendingCount,
  rejectedCount,
  hiddenCount,
  completedCount,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Total */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng vé</p>
          <p className="text-lg font-extrabold text-slate-900">{totalCount}</p>
        </div>
      </div>

      {/* Approved */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-brand flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã thanh toán</p>
          <p className="text-lg font-extrabold text-brand">{approvedCount}</p>
        </div>
      </div>

      {/* Pending */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chờ thanh toán</p>
          <p className="text-lg font-extrabold text-amber-600">{pendingCount}</p>
        </div>
      </div>

      {/* Rejected */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thanh toán lỗi</p>
          <p className="text-lg font-extrabold text-rose-600">{rejectedCount}</p>
        </div>
      </div>

      {/* Hidden */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
          <EyeOff className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã hủy</p>
          <p className="text-lg font-extrabold text-slate-700">{hiddenCount}</p>
        </div>
      </div>

      {/* Completed */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center flex-shrink-0">
          <CheckCheck className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đã sử dụng</p>
          <p className="text-lg font-extrabold text-sky-700">{completedCount}</p>
        </div>
      </div>
    </div>
  );
};
