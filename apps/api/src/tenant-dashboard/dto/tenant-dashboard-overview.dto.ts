import { ApiProperty } from '@nestjs/swagger';

export class OperationalMetricsDto {
  @ApiProperty({ description: 'Tổng số chuyến xe khởi hành trong ngày hôm nay', example: 12 })
  totalTripsToday!: number;

  @ApiProperty({ description: 'Số chuyến xe chuẩn bị chạy (chưa khởi hành)', example: 5 })
  preparingTrips!: number;

  @ApiProperty({ description: 'Số chuyến xe đang chạy trên lộ trình', example: 3 })
  runningTrips!: number;

  @ApiProperty({ description: 'Số chuyến xe đã hoàn thành hành trình', example: 4 })
  completedTrips!: number;

  @ApiProperty({ description: 'Số chuyến xe đã bị hủy trong ngày', example: 0 })
  cancelledTrips!: number;

  @ApiProperty({ description: 'Tổng số vé / ghế đã bán cho các chuyến hôm nay', example: 184 })
  bookedTicketsToday!: number;

  @ApiProperty({ description: 'Tổng sức chứa ghế của tất cả các chuyến xe hôm nay', example: 240 })
  totalSeatsToday!: number;

  @ApiProperty({ description: 'Tỷ lệ lấp đầy ghế bình quân hôm nay (0-100%)', example: 77 })
  loadFactorPercent!: number;

  @ApiProperty({ description: 'Tổng số phiếu gửi hàng hóa tiếp nhận trong ngày', example: 38 })
  totalShipmentsToday!: number;

  @ApiProperty({ description: 'Số phiếu gửi hàng chưa được xếp / gán vào chuyến xe nào', example: 4 })
  unassignedShipmentsToday!: number;

  @ApiProperty({ description: 'Doanh thu ước tính trong ngày (tổng vé + cước hàng, VNĐ)', example: 46250000 })
  estimatedRevenueToday!: number;
}

export class UpcomingTripItemDto {
  @ApiProperty({ description: 'ID chuyến xe', example: 101 })
  tripId!: number;

  @ApiProperty({ description: 'Mã chuyến xe', example: 'CX-SG-DL-0801' })
  tripCode!: string;

  @ApiProperty({ description: 'Ngày khởi hành (DD-MM-YYYY)', example: '08-11-2026' })
  departureDate!: string;

  @ApiProperty({ description: 'Giờ khởi hành (HH:mm)', example: '08:30' })
  departureTime!: string;

  @ApiProperty({ description: 'Tên tuyến xe', example: 'Sài Gòn - Đà Lạt' })
  routeName!: string;

  @ApiProperty({ description: 'Điểm xuất phát', example: 'Bến xe Miền Đông' })
  departureLocation!: string;

  @ApiProperty({ description: 'Điểm đến', example: 'Bến xe Liên tỉnh Đà Lạt' })
  arrivalLocation!: string;

  @ApiProperty({ description: 'Biển số xe', example: '51B-123.45' })
  licensePlate!: string;

  @ApiProperty({ description: 'Tên loại xe', example: 'Limousine 34 phòng' })
  vehicleTypeName!: string;

  @ApiProperty({ description: 'Số ghế đã bán / đặt thành công', example: 28 })
  bookedSeats!: number;

  @ApiProperty({ description: 'Tổng số ghế trên xe', example: 34 })
  totalSeats!: number;

  @ApiProperty({ description: 'Tỷ lệ lấp đầy ghế của chuyến (0-100%)', example: 82 })
  loadFactorPercent!: number;

  @ApiProperty({ description: 'Trạng thái chuyến xe', example: 'CHUA_KHOI_HANH' })
  status!: string;
}

export class UrgentAlertsDto {
  @ApiProperty({ description: 'Số phiếu đặt vé đang ở trạng thái chờ thanh toán', example: 3 })
  pendingBookingsCount!: number;

  @ApiProperty({ description: 'Số kiện hàng chưa được xếp vào chuyến xe', example: 4 })
  unassignedShipmentsCount!: number;

  @ApiProperty({ description: 'Số chuyến sắp xuất bến trong 2 giờ tới có tỷ lệ lấp đầy < 30%', example: 1 })
  departingSoonLowOccupancyCount!: number;
}

export class TenantDashboardOverviewDto {
  @ApiProperty({ description: 'Ngày vận hành hiện tại (DD-MM-YYYY)', example: '08-11-2026' })
  businessDate!: string;

  @ApiProperty({ description: 'Múi giờ vận hành', example: 'Asia/Ho_Chi_Minh' })
  timeZone!: string;

  @ApiProperty({ description: 'Các chỉ số đo lường vận hành hôm nay', type: OperationalMetricsDto })
  metrics!: OperationalMetricsDto;

  @ApiProperty({ description: 'Danh sách các chuyến xe sắp khởi hành trong ngày', type: [UpcomingTripItemDto] })
  upcomingTrips!: UpcomingTripItemDto[];

  @ApiProperty({ description: 'Các cảnh báo khẩn cần nhân viên xử lý ngay', type: UrgentAlertsDto })
  urgentAlerts!: UrgentAlertsDto;
}
