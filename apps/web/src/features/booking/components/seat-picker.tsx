'use client';

import { useState } from 'react';
import { Armchair, Check, LockKeyhole } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mockSeats } from '@/mocks/trips';
import { formatCompactCurrency } from '@/lib/format';
import type { Trip } from '@/types/customer';

export function SeatPicker({ trip }: { trip: Trip }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (seatId: string) => setSelected((current) => current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId]);
  const seats = mockSeats.filter((seat) => seat.floor === 'lower');
  return <div className="rounded-2xl border border-border bg-background p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Chọn ghế</h2><p className="mt-1 text-sm text-muted-foreground">Chọn tối đa 6 ghế. Ghế sẽ được giữ trong 10 phút ở bước tiếp theo.</p></div><Badge tone="blue"><LockKeyhole size={13} className="mr-1" /> Bảo mật</Badge></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">{seats.map((seat) => { const disabled = seat.status !== 'available'; const active = selected.includes(seat.id); return <button key={seat.id} type="button" disabled={disabled} onClick={() => toggle(seat.id)} className={`flex h-14 items-center justify-center gap-2 rounded-xl border text-sm font-black transition ${active ? 'border-primary bg-primary text-primary-foreground' : disabled ? 'cursor-not-allowed border-border bg-muted text-muted-foreground/50' : 'border-border bg-background text-foreground hover:border-primary hover:bg-primary/5'}`}>{active ? <Check size={17} /> : disabled ? <LockKeyhole size={15} /> : <Armchair size={17} />}{seat.label}</button>; })}</div><div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4 text-xs font-bold text-muted-foreground"><span className="flex items-center gap-1"><i className="size-3 rounded bg-background ring-1 ring-border" /> Còn trống</span><span className="flex items-center gap-1"><i className="size-3 rounded bg-primary" /> Đang chọn</span><span className="flex items-center gap-1"><i className="size-3 rounded bg-muted" /> Không khả dụng</span></div><div className="mt-5 flex items-center justify-between rounded-xl bg-muted p-4"><div><p className="text-xs font-bold text-muted-foreground">Tạm tính</p><p className="text-lg font-black text-primary">{formatCompactCurrency(selected.length * trip.price)}</p></div><ButtonLink href={`/booking/${trip.id}/passenger`} className={selected.length ? '' : 'pointer-events-none opacity-50'} variant="accent">Tiếp tục <span aria-hidden>→</span></ButtonLink></div></div>;
}
