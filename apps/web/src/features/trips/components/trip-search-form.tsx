'use client';

import { useState } from 'react';
import { ArrowRightLeft, Bus, CalendarDays, MapPin, PackageCheck, Search, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const locations = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Lạt', 'Cần Thơ', 'Đà Nẵng', 'Nha Trang', 'Vũng Tàu'];

export function TripSearchForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [service, setService] = useState<'trip' | 'shipment'>('trip');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [roundTrip, setRoundTrip] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (service === 'shipment') {
      router.push('/shipments/new');
      return;
    }
    const params = new URLSearchParams({ from: origin, to: destination, date, passengers: String(passengers) });
    if (roundTrip && returnDate) params.set('returnDate', returnDate);
    router.push(`/trips?${params.toString()}`);
  };

  return <form onSubmit={submit} className={`rounded-lg border border-slate-200 bg-white p-4 text-slate-900 shadow-xl md:p-5 ${compact ? 'shadow-sm' : ''}`}>
    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center"><div className="inline-flex w-fit rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => setService('trip')} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-extrabold transition ${service === 'trip' ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><Bus className="size-4" /> Đặt vé</button><button type="button" onClick={() => setService('shipment')} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-extrabold transition ${service === 'shipment' ? 'bg-brand text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}><PackageCheck className="size-4" /> Gửi hàng</button></div><div className="flex items-center gap-6 pr-2 text-xs font-bold text-slate-500 md:pr-4"><label className="inline-flex items-center gap-2"><input type="radio" name="tripType" checked={!roundTrip} onChange={() => setRoundTrip(false)} className="size-4 accent-brand" /> Một chiều</label><label className="inline-flex items-center gap-2"><input type="radio" name="tripType" checked={roundTrip} onChange={() => setRoundTrip(true)} className="size-4 accent-brand" /> Khứ hồi</label></div></div>
    <div className="grid gap-3 pt-4 lg:grid-cols-[1fr_auto_1fr_1fr_112px_auto] lg:items-end"><label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500"><MapPin className="size-3.5 text-brand" /> Điểm đi</span><input list="vexgo-locations" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Nhập điểm đi" className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand" /></label><button type="button" onClick={() => { setOrigin(destination); setDestination(origin); }} aria-label="Đổi chiều tuyến" className="hidden size-11 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-brand transition hover:bg-slate-100 lg:grid"><ArrowRightLeft className="size-5" /></button><label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500"><MapPin className="size-3.5 text-rose-500" /> Điểm đến</span><input list="vexgo-locations" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Nhập điểm đến" className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand" /></label><label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500"><CalendarDays className="size-3.5 text-brand" /> Ngày đi</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand" /></label><label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500"><Users className="size-3.5 text-brand" /> Số vé</span><input type="number" min={1} max={10} value={passengers} onChange={(event) => setPassengers(Math.max(1, Number(event.target.value) || 1))} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand" /></label><Button variant="accent" className="h-12 rounded-lg px-6"><Search className="size-4" /> Tìm chuyến</Button></div>
    {roundTrip ? <div className="mt-3 max-w-xs"><label className="space-y-1.5"><span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase text-slate-500"><CalendarDays className="size-3.5 text-brand" /> Ngày về</span><input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-brand" /></label></div> : null}<datalist id="vexgo-locations">{locations.map((location) => <option value={location} key={location} />)}</datalist>
  </form>;
}
