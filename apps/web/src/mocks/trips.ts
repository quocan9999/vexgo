import type { Seat, Trip } from '@/types/customer';

export const mockTrips: Trip[] = [
  {
    id: 'trip-hcm-dalat-01',
    operator: 'VexGo Express',
    origin: 'TP. Hồ Chí Minh',
    destination: 'Đà Lạt',
    departureTime: '07:20',
    arrivalTime: '15:20',
    duration: '8 giờ',
    vehicleType: 'Limousine giường phòng',
    price: 300000,
    availableSeats: 12,
    totalSeats: 22,
    rating: 4.8,
    image: '/images/route1.jpg',
    amenities: ['Wifi', 'Nước uống', 'Cổng sạc'],
    status: 'open',
  },
  {
    id: 'trip-hcm-dalat-02',
    operator: 'VexGo Premium',
    origin: 'TP. Hồ Chí Minh',
    destination: 'Đà Lạt',
    departureTime: '21:00',
    arrivalTime: '05:00',
    duration: '8 giờ',
    vehicleType: 'Giường nằm 34 chỗ',
    price: 260000,
    availableSeats: 6,
    totalSeats: 34,
    rating: 4.6,
    image: '/images/route1.jpg',
    amenities: ['Wifi', 'Chăn mỏng'],
    status: 'nearly-full',
  },
  {
    id: 'trip-hcm-cantho-01',
    operator: 'VexGo Express',
    origin: 'TP. Hồ Chí Minh',
    destination: 'Cần Thơ',
    departureTime: '09:30',
    arrivalTime: '13:30',
    duration: '4 giờ',
    vehicleType: 'Ghế ngồi cao cấp',
    price: 165000,
    availableSeats: 19,
    totalSeats: 28,
    rating: 4.7,
    image: '/images/route2.jpg',
    amenities: ['Wifi', 'Nước uống'],
    status: 'open',
  },
  {
    id: 'trip-danang-hcm-01',
    operator: 'VexGo North-South',
    origin: 'Đà Nẵng',
    destination: 'TP. Hồ Chí Minh',
    departureTime: '18:30',
    arrivalTime: '14:30',
    duration: '20 giờ',
    vehicleType: 'Limousine giường phòng',
    price: 520000,
    availableSeats: 8,
    totalSeats: 22,
    rating: 4.9,
    image: '/images/route3.jpg',
    amenities: ['Wifi', 'Bữa nhẹ', 'Cổng sạc'],
    status: 'open',
  },
  {
    id: 'trip-dalat-nhatrang-01',
    operator: 'VexGo Premium',
    origin: 'Đà Lạt',
    destination: 'Nha Trang',
    departureTime: '14:00',
    arrivalTime: '17:30',
    duration: '3 giờ 30 phút',
    vehicleType: 'Ghế ngồi cao cấp',
    price: 180000,
    availableSeats: 28,
    totalSeats: 28,
    rating: 4.5,
    image: '/images/route2.jpg',
    amenities: ['Wifi', 'Nước uống'],
    status: 'open',
  },
];

export const popularRoutes = [
  { id: 'hcm-dalat', city: 'TP. Hồ Chí Minh', destination: 'Đà Lạt', price: 260000, duration: '8 giờ', image: '/images/route1.jpg' },
  { id: 'hcm-cantho', city: 'TP. Hồ Chí Minh', destination: 'Cần Thơ', price: 165000, duration: '4 giờ', image: '/images/route2.jpg' },
  { id: 'danang-hcm', city: 'Đà Nẵng', destination: 'TP. Hồ Chí Minh', price: 520000, duration: '20 giờ', image: '/images/route3.jpg' },
];

export const promotions = [
  { code: 'VEXGO50', title: 'Giảm 50.000đ cho chuyến đầu tiên', description: 'Áp dụng cho khách hàng mới trên mọi tuyến đang mở bán.', expires: '30/09/2026', image: '/images/promo1.jpg' },
  { code: 'WEEKEND', title: 'Ưu đãi cuối tuần', description: 'Giảm 10% cho các chuyến khởi hành thứ Bảy và Chủ nhật.', expires: '31/10/2026', image: '/images/promo2.jpg' },
  { code: 'SHIPFAST', title: 'Gửi hàng tiết kiệm', description: 'Miễn phí xử lý cho đơn gửi hàng đầu tiên trong tháng.', expires: '15/10/2026', image: '/images/promo3.jpg' },
];

export const news = [
  { title: 'Mở thêm tuyến TP. Hồ Chí Minh – Đà Lạt mỗi ngày', date: '28/08/2026', image: '/images/promo2.jpg' },
  { title: 'Hướng dẫn chọn ghế và chuẩn bị hành lý', date: '16/08/2026', image: '/images/promo1.jpg' },
  { title: 'VexGo nâng cấp trải nghiệm đặt vé trên điện thoại', date: '24/06/2026', image: '/images/promo3.jpg' },
];

export const mockSeats: Seat[] = Array.from({ length: 22 }, (_, index) => ({
  id: `seat-${index + 1}`,
  label: `${index < 11 ? 'A' : 'B'}${(index % 11) + 1}`,
  floor: index < 11 ? 'lower' : 'upper',
  status: index === 2 || index === 7 ? 'sold' : index === 5 ? 'held' : 'available',
}));

export function getTrip(id: string) {
  return mockTrips.find((trip) => trip.id === id) ?? mockTrips[0];
}
