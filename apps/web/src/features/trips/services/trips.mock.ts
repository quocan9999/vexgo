export type Trip = {
  id: number;
  busCompany: {
    id: number;
    name: string;
    logo: string;
    rating: number;
    reviewsCount: number;
  };
  route: {
    origin: string;
    destination: string;
    distance: number;
    durationMinutes: number;
  };
  departureTime: string; // ISO
  arrivalTime: string;   // ISO
  vehicle: {
    type: string;
    capacity: number;
    amenities: string[];
  };
  price: number;
  availableSeats: number;
};

export const MOCK_TRIPS: Trip[] = [
  {
    id: 1,
    busCompany: { id: 1, name: 'Phương Trang (FUTA)', logo: '/images/futa.png', rating: 4.8, reviewsCount: 1250 },
    route: { origin: 'TP. Hồ Chí Minh', destination: 'Đà Lạt', distance: 300, durationMinutes: 480 },
    departureTime: '2026-10-15T22:00:00.000Z',
    arrivalTime: '2026-10-16T06:00:00.000Z',
    vehicle: { type: 'Giường nằm 34 chỗ', capacity: 34, amenities: ['Wifi', 'Nước suối', 'Chăn đắp', 'WC'] },
    price: 300000,
    availableSeats: 12,
  },
  {
    id: 2,
    busCompany: { id: 2, name: 'Thành Bưởi', logo: '/images/thanhbuoi.png', rating: 4.9, reviewsCount: 980 },
    route: { origin: 'TP. Hồ Chí Minh', destination: 'Đà Lạt', distance: 300, durationMinutes: 450 },
    departureTime: '2026-10-15T23:00:00.000Z',
    arrivalTime: '2026-10-16T06:30:00.000Z',
    vehicle: { type: 'Phòng nằm cabin 22', capacity: 22, amenities: ['Wifi', 'Nước suối', 'Màn hình LED', 'Rèm riêng tư'] },
    price: 450000,
    availableSeats: 4,
  },
  {
    id: 3,
    busCompany: { id: 3, name: 'Kumho Samco', logo: '/images/kumho.png', rating: 4.5, reviewsCount: 540 },
    route: { origin: 'TP. Hồ Chí Minh', destination: 'Vũng Tàu', distance: 100, durationMinutes: 120 },
    departureTime: '2026-10-15T08:00:00.000Z',
    arrivalTime: '2026-10-15T10:00:00.000Z',
    vehicle: { type: 'Limousine 9 chỗ', capacity: 9, amenities: ['Wifi', 'Ghế massage', 'Sạc USB'] },
    price: 200000,
    availableSeats: 2,
  }
];

export const searchTripsMock = async (origin: string, destination: string, date: string): Promise<Trip[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate simple filtering
      const results = MOCK_TRIPS.filter(t => 
        (!origin || t.route.origin.toLowerCase().includes(origin.toLowerCase())) &&
        (!destination || t.route.destination.toLowerCase().includes(destination.toLowerCase()))
      );
      resolve(results);
    }, 800);
  });
};

export const getTripDetailsMock = async (tripId: number): Promise<Trip | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const trip = MOCK_TRIPS.find(t => t.id === tripId);
      resolve(trip || null);
    }, 500);
  });
};
