import { Armchair, Clock3, MapPin, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { formatCompactCurrency } from '@/lib/format';
import type { Trip } from '@/types/customer';

export function TripCard({ trip }: { trip: Trip }) {
  return <article className="rounded-2xl border border-border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><span className="text-xs font-black">VEX</span></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-foreground">{trip.operator}</h3><Badge tone={trip.status === 'nearly-full' ? 'amber' : 'green'}>{trip.status === 'nearly-full' ? 'Sắp đầy' : 'Còn chỗ'}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{trip.vehicleType} · <Star size={13} className="mb-0.5 inline fill-amber-400 text-amber-400" /> {trip.rating}</p></div></div>
      <div className="grid flex-[1.3] grid-cols-[1fr_auto_1fr] items-center gap-3"><div><p className="text-2xl font-black text-foreground">{trip.departureTime}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{trip.origin}</p></div><div className="flex flex-col items-center text-muted-foreground"><span className="text-[11px] font-bold">{trip.duration}</span><span className="my-1 h-px w-16 bg-border" /><MapPin size={14} /></div><div className="text-right"><p className="text-2xl font-black text-foreground">{trip.arrivalTime}</p><p className="mt-1 text-xs font-semibold text-muted-foreground">{trip.destination}</p></div></div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4 lg:block lg:min-w-36 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right"><div><p className="text-lg font-black text-primary">{formatCompactCurrency(trip.price)}</p><p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground lg:justify-end"><Armchair size={13} /> còn {trip.availableSeats} ghế</p></div><ButtonLink href={`/trips/${trip.id}`} className="mt-3 w-full" variant="accent">Chọn chuyến</ButtonLink></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground"><span className="flex items-center gap-1"><Clock3 size={13} /> Khởi hành đúng giờ</span><span className="flex items-center gap-1"><ShieldCheck size={13} /> Đặt vé an tâm</span>{trip.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
  </article>;
}
