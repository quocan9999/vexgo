'use client';

import { useMemo, useState } from 'react';
import { Filter, SlidersHorizontal } from 'lucide-react';
import { SectionHeading } from '@/components/ui/section-heading';
import { mockTrips } from '@/mocks/trips';
import { TripCard } from '@/features/trips/components/trip-card';

export function TripList() {
  const [query, setQuery] = useState('');
  const [vehicleType, setVehicleType] = useState('all');
  const [sort, setSort] = useState('departure');
  const filteredTrips = useMemo(() => mockTrips.filter((trip) => {
    const matchesQuery = `${trip.origin} ${trip.destination} ${trip.operator}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (vehicleType === 'all' || trip.vehicleType.includes(vehicleType));
  }).sort((left, right) => sort === 'price' ? left.price - right.price : left.departureTime.localeCompare(right.departureTime)), [query, sort, vehicleType]);

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><SectionHeading eyebrow="Tìm chuyến" title="Chọn chuyến phù hợp với bạn" description="So sánh giờ chạy, loại xe, ghế trống và giá vé trong một màn hình." />
    <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-background p-4 md:grid-cols-[1fr_190px_190px_auto] md:items-end"><label className="space-y-2"><span className="text-xs font-black uppercase text-muted-foreground">Tìm theo tuyến hoặc nhà xe</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: TP. Hồ Chí Minh, Đà Lạt..." className="h-11 w-full rounded-xl border border-input px-3 text-sm outline-none focus:border-primary" /></label><label className="space-y-2"><span className="text-xs font-black uppercase text-muted-foreground">Loại xe</span><select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:border-primary"><option value="all">Tất cả loại xe</option><option value="Limousine">Limousine</option><option value="Giường">Giường nằm</option><option value="Ghế">Ghế ngồi</option></select></label><label className="space-y-2"><span className="text-xs font-black uppercase text-muted-foreground">Sắp xếp</span><select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-bold outline-none focus:border-primary"><option value="departure">Giờ khởi hành</option><option value="price">Giá thấp đến cao</option></select></label><div className="flex h-11 items-center gap-2 text-sm font-bold text-muted-foreground"><Filter size={16} className="text-primary" /> {filteredTrips.length} chuyến</div></div>
    <div className="mb-4 flex items-center justify-between"><p className="text-sm font-bold text-muted-foreground">Kết quả mock cho ngày 25/09/2026</p><button type="button" className="flex items-center gap-2 text-sm font-bold text-primary md:hidden"><SlidersHorizontal size={16} /> Bộ lọc</button></div>
    <div className="grid gap-4">{filteredTrips.length ? filteredTrips.map((trip) => <TripCard key={trip.id} trip={trip} />) : <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm font-semibold text-muted-foreground">Không tìm thấy chuyến phù hợp.</div>}</div>
  </section>;
}
