'use client';

import Link from 'next/link';
import {
  Ticket,
  Bus,
  Package,
  MapPin,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export function TenantQuickActions() {
  const t = useTranslations('dashboard');

  const quickActions = [
    {
      title: t('quickActionPosTitle'),
      description: t('quickActionPosDesc'),
      href: '/booking-management',
      icon: Ticket,
      color: 'bg-teal-50 text-teal-600 border-teal-100',
    },
    {
      title: t('quickActionTripsTitle'),
      description: t('quickActionTripsDesc'),
      href: '/trips',
      icon: Bus,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      title: t('quickActionCargoTitle'),
      description: t('quickActionCargoDesc'),
      href: '/shipments',
      icon: Package,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    {
      title: t('quickActionStationsTitle'),
      description: t('quickActionStationsDesc'),
      href: '/stations',
      icon: MapPin,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    {
      title: t('quickActionReportsTitle'),
      description: t('quickActionReportsDesc'),
      href: '/revenue-reports',
      icon: BarChart3,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
  ];

  return (
    <Card className="shadow-xs border border-border">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">
          {t('quickActionsTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 space-y-1">
        {quickActions.map((action) => {
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
