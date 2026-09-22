'use client';

import { useState } from 'react';
import { Phone, Search, TicketCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function TicketLookupForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('0912 345 678');
  const [code, setCode] = useState('VX-26091701');
  return <form className="mx-auto max-w-2xl rounded-3xl border border-border bg-background p-5 shadow-sm sm:p-8" onSubmit={(event) => { event.preventDefault(); router.push('/invoices/ticket-001'); }}><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><TicketCheck size={30} /></div><h1 className="mt-5 text-center text-2xl font-black">Tra cứu thông tin đặt vé</h1><p className="mt-2 text-center text-sm leading-6 text-muted-foreground">Nhập số điện thoại và mã vé để xem thông tin chuyến đi.</p><div className="mt-8 grid gap-4"><label className="space-y-2"><span className="text-sm font-bold">Số điện thoại</span><span className="relative block"><Phone size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input required value={phone} onChange={(event) => setPhone(event.target.value)} className="h-12 w-full rounded-xl border border-input pl-10 pr-4 outline-none focus:border-primary" /></span></label><label className="space-y-2"><span className="text-sm font-bold">Mã vé</span><input required value={code} onChange={(event) => setCode(event.target.value)} className="h-12 w-full rounded-xl border border-input px-4 uppercase outline-none focus:border-primary" /></label><Button variant="accent" className="mt-2 w-full"><Search size={17} /> Tra cứu vé</Button></div></form>;
}
