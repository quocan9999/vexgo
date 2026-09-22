import { Ticket } from 'lucide-react';
import { SectionHeading } from '@/components/ui/section-heading';
import { AccountSidebar } from '@/features/account/components/account-sidebar';
import { TicketCard } from '@/features/tickets/components/ticket-card';
import { mockTickets } from '@/mocks/tickets';

export default function AccountTicketsPage() {
  return <div className="bg-slate-50"><div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[240px_1fr] lg:px-8"><AccountSidebar /><section><SectionHeading eyebrow="Tài khoản" title="Vé của tôi" description="Theo dõi các vé sắp đi và lịch sử đặt vé." action={<span className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-xs font-black text-primary"><Ticket size={15} /> {mockTickets.length} vé demo</span>} /><div className="grid gap-4">{mockTickets.map((ticket) => <TicketCard ticket={ticket} key={ticket.id} />)}</div></section></div></div>;
}
