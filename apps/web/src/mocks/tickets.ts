import type { Ticket } from '@/types/customer';

export const mockTickets: Ticket[] = [
  {
    id: 'ticket-001',
    code: 'VX-26091701',
    passenger: 'Nguyễn Văn Hùng',
    phone: '0912 345 678',
    route: 'TP. Hồ Chí Minh → Đà Lạt',
    departure: '22:30 · 17/09/2026',
    seats: ['A01', 'A02'],
    amount: 600000,
    status: 'confirmed',
    pickup: 'Bến xe Miền Đông mới',
    dropoff: 'Bến xe Đà Lạt',
    vehicleType: 'Limousine giường phòng 22 chỗ',
  },
  {
    id: 'ticket-002',
    code: 'VX-26092502',
    passenger: 'Nguyễn Văn Hùng',
    phone: '0912 345 678',
    route: 'TP. Hồ Chí Minh → Cần Thơ',
    departure: '09:30 · 25/09/2026',
    seats: ['B06'],
    amount: 165000,
    status: 'pending',
    pickup: 'Bến xe Miền Tây',
    dropoff: 'Bến xe Cần Thơ',
    vehicleType: 'Ghế ngồi cao cấp',
  },
];

export function getTicket(id: string) {
  return mockTickets.find((ticket) => ticket.id === id || ticket.code === id) ?? mockTickets[0];
}
