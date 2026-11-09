/* eslint-disable */
'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPin, TicketCheck } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { formatCompactCurrency } from '@/lib/format';
import type { Ticket } from '@/types/customer';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const locale = useLocale();
  const tone =
    ticket.status === 'confirmed'
      ? 'green'
      : ticket.status === 'pending'
        ? 'amber'
        : 'red';
  const label =
    ticket.status === 'confirmed'
      ? t('statusConfirmed')
      : ticket.status === 'pending'
        ? t('statusPending')
        : t('statusCancelled');

  return (
    <article className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-primary">{ticket.code}</span>
            <Badge tone={tone}>{label}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-black">{ticket.route}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CalendarDays size={15} /> {ticket.departure}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-bold text-muted-foreground">
            {t('totalAmount')}
          </p>
          <p className="mt-1 text-lg font-black">
            {formatCompactCurrency(ticket.amount, locale)}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm font-semibold text-muted-foreground sm:grid-cols-3">
        <span className="flex items-center gap-2">
          <TicketCheck size={16} className="text-primary" /> {t('seatNumber')}{' '}
          {ticket.seats.join(', ')}
        </span>
        <span className="flex items-center gap-2">
          <MapPin size={16} className="text-primary" /> {t('pickupPoint')}:{' '}
          {ticket.pickup}
        </span>
        <span className="flex items-center gap-2">
          <MapPin size={16} className="text-accent" /> {t('dropoffPoint')}:{' '}
          {ticket.dropoff}
        </span>
      </div>
      <Link
        href={`/invoices/${ticket.id}`}
        className="mt-5 inline-flex items-center gap-1 text-sm font-black text-primary hover:underline"
      >
        {t('printTicket')} <ChevronRight size={16} />
      </Link>
    </article>
  );
}
