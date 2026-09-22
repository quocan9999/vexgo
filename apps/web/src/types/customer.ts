export type TripStatus = 'open' | 'nearly-full' | 'sold-out';

export type Trip = {
  id: string;
  operator: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  vehicleType: string;
  price: number;
  availableSeats: number;
  totalSeats: number;
  rating: number;
  image: string;
  amenities: string[];
  status: TripStatus;
};

export type SeatStatus = 'available' | 'selected' | 'held' | 'sold';

export type Seat = {
  id: string;
  label: string;
  floor: 'lower' | 'upper';
  status: SeatStatus;
};

export type TicketStatus = 'confirmed' | 'pending' | 'cancelled';

export type Ticket = {
  id: string;
  code: string;
  passenger: string;
  phone: string;
  route: string;
  departure: string;
  seats: string[];
  amount: number;
  status: TicketStatus;
  pickup: string;
  dropoff: string;
  vehicleType: string;
};

export type Shipment = {
  id: string;
  trackingCode: string;
  receiver: string;
  route: string;
  status: 'received' | 'in-transit' | 'delivered';
  amount: number;
  updatedAt: string;
};
