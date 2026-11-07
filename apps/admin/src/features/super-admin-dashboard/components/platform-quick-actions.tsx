'use client';

import Link from 'next/link';
import {
  Building2,
  UsersRound,
  ShieldCheck,
  Star,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const PLATFORM_QUICK_ACTIONS = [
  {
    title: 'Quản lý nhà xe',
    description: 'Thêm & kiểm duyệt đối tác nhà xe',
    href: '/bus-companies',
    icon: Building2,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    title: 'Tài khoản quản trị',
    description: 'Cấp tài khoản & quản lý nhân sự',
    href: '/admin-accounts',
    icon: UsersRound,
    color: 'bg-teal-50 text-teal-600 border-teal-100',
  },
  {
    title: 'Phân quyền nền tảng',
    description: 'Ma trận vai trò & quyền hạn RBAC',
    href: '/rbac',
    icon: ShieldCheck,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  },
  {
    title: 'Kiểm duyệt đánh giá',
    description: 'Phản hồi & giải quyết khiếu nại',
    href: '/reviews',
    icon: Star,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
];

export function PlatformQuickActions() {
  return (
    <Card className="shadow-xs border border-border">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">
          Lối tắt quản trị sàn
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        {PLATFORM_QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-border/70"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-7.5 rounded-lg grid place-items-center border shrink-0 transition-colors ${action.color}`}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {action.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
                    {action.description}
                  </p>
                </div>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
