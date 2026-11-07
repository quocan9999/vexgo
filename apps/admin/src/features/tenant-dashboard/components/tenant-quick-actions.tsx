'use client';

import Link from 'next/link';
import {
  Ticket,
  Bus,
  Package,
  MapPin,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const QUICK_ACTIONS = [
  {
    title: 'Bán vé tại quầy',
    description: 'Tạo phiếu đặt vé và chọn ghế trực tiếp cho khách tại quầy',
    href: '/booking-management',
    icon: Ticket,
    color: 'bg-teal-50 text-teal-600 border-teal-100 group-hover:bg-teal-100',
  },
  {
    title: 'Quản lý chuyến xe',
    description: 'Thêm chuyến tăng cường hoặc cập nhật tài xế, phụ xe',
    href: '/trips',
    icon: Bus,
    color: 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-100',
  },
  {
    title: 'Nhận gửi hàng hóa',
    description: 'Tiếp nhận bưu kiện, tính cước và in phiếu gửi hàng',
    href: '/shipments',
    icon: Package,
    color: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-100',
  },
  {
    title: 'Bến bãi & Trạm đón',
    description: 'Quản lý danh sách điểm đón trả khách dọc hành trình',
    href: '/stations',
    icon: MapPin,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-100',
  },
  {
    title: 'Báo cáo doanh thu',
    description: 'Đối soát tài chính, doanh thu theo ngày, tháng và quý',
    href: '/revenue-reports',
    icon: BarChart3,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-100',
  },
];

export function TenantQuickActions() {
  return (
    <Card className="shadow-xs border border-border">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
          Lối tắt thao tác nhanh
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex flex-col justify-between p-3.5 rounded-xl border border-border/70 bg-card hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
              >
                <div>
                  <div
                    className={`size-9 rounded-lg grid place-items-center border mb-2.5 transition-colors ${action.color}`}
                  >
                    <Icon className="size-4.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground group-hover:text-primary flex items-center justify-between">
                    <span>{action.title}</span>
                    <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
