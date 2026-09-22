import Link from 'next/link';
import { CalendarDays, ChevronRight, MapPin, TicketCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCompactCurrency } from '@/lib/format';
import type { Ticket } from '@/types/customer';

export function TicketCard({ ticket }: { ticket: Ticket }) {
  const tone = ticket.status === 'confirmed' ? 'green' : ticket.status === 'pending' ? 'amber' : 'red';
  const label = ticket.status === 'confirmed' ? 'Đã xác nhận' : ticket.status === 'pending' ? 'Chờ thanh toán' : 'Đã hủy';
  return <article className="rounded-2xl border border-border bg-background p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black text-primary">{ticket.code}</span><Badge tone={tone}>{label}</Badge></div><h3 className="mt-3 text-lg font-black">{ticket.route}</h3><p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CalendarDays size={15} /> {ticket.departure}</p></div><div className="text-left sm:text-right"><p className="text-xs font-bold text-muted-foreground">Tổng tiền</p><p className="mt-1 text-lg font-black">{formatCompactCurrency(ticket.amount)}</p></div></div><div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm font-semibold text-muted-foreground sm:grid-cols-3"><span className="flex items-center gap-2"><TicketCheck size={16} className="text-primary" /> Ghế {ticket.seats.join(', ')}</span><span className="flex items-center gap-2"><MapPin size={16} className="text-primary" /> Đón: {ticket.pickup}</span><span className="flex items-center gap-2"><MapPin size={16} className="text-accent" /> Trả: {ticket.dropoff}</span></div><Link href={`/invoices/${ticket.id}`} className="mt-5 inline-flex items-center gap-1 text-sm font-black text-primary hover:underline">Xem vé điện tử <ChevronRight size={16} /></Link></article>;
}
