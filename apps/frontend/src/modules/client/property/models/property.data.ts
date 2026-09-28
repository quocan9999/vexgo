// frontend/src/modules/client/property/models/property.data.ts
import { PropertyDemand } from './property.model';

export const MOCK_PROPERTY_DEMANDS: PropertyDemand[] = [
  {
    id: '1',
    title: 'TP. Hồ Chí Minh đi Đà Lạt - Limousine 22 phòng',
    needType: 'BUY',
    propertyType: 'Limousine giường phòng',
    price: '320.000 - 420.000 VNĐ',
    minPriceNum: 320,
    maxPriceNum: 420,
    area: '12 ghế trống',
    minAreaNum: 12,
    location: 'Bến xe Miền Đông mới, TP. Hồ Chí Minh - Bến xe Đà Lạt, Lâm Đồng',
    province: 'Hồ Chí Minh',
    district: 'Đà Lạt',
    legal: 'Hủy trước 3 giờ',
    direction: '22:30',
    note: 'Tạm giữ ghế 10 phút trong lúc thanh toán',
    description: `Chuyến đêm phù hợp khách du lịch và công tác, hỗ trợ chọn ghế trên sơ đồ xe trước khi thanh toán.
Yêu cầu nghiệp vụ:
- Chọn ghế trống và nhập họ tên, số điện thoại, điểm đón, điểm trả.
- Hệ thống tạm giữ ghế trong 10 phút để khách hoàn tất thanh toán.
- Sau thanh toán thành công, hệ thống xuất vé điện tử kèm mã vé hoặc mã QR.
- Vé đủ điều kiện được hủy trước giờ khởi hành ít nhất 3 giờ theo chính sách nhà xe.`,
    timeAgo: 'Còn 12 ghế',
    createdAt: '16/09/2026',
    authorName: 'Nhà xe An Bình',
    authorCode: 'BW-001',
    authorPhone: '1900.6789',
    isVerified: true,
  },
  {
    id: '2',
    title: 'TP. Hồ Chí Minh đi Nha Trang - Giường nằm 34 chỗ',
    needType: 'BUY',
    propertyType: 'Giường nằm',
    price: '260.000 - 340.000 VNĐ',
    minPriceNum: 260,
    maxPriceNum: 340,
    area: '18 ghế trống',
    minAreaNum: 18,
    location: 'Quận 1, TP. Hồ Chí Minh - Trung tâm Nha Trang, Khánh Hòa',
    province: 'Hồ Chí Minh',
    district: 'Nha Trang',
    legal: 'Có hóa đơn điện tử',
    direction: '21:00',
    note: 'Thanh toán MoMo, VNPAY hoặc ZaloPay',
    description: `Chuyến xe đêm có điểm đón trung tâm, phù hợp khách muốn nhận vé điện tử và hóa đơn sau thanh toán.
Yêu cầu nghiệp vụ:
- Khách có thể nhập mã giảm giá trong bước thanh toán.
- Hệ thống kiểm tra hạn dùng, tuyến áp dụng và số lượt còn lại của mã.
- Giao dịch thất bại hoặc quá thời gian chờ sẽ tự hủy đơn và mở lại ghế.
- Khách có thể yêu cầu gửi lại vé qua email khi cần.`,
    timeAgo: 'Còn 18 ghế',
    createdAt: '16/09/2026',
    authorName: 'Nhà xe Sao Biển',
    authorCode: 'BW-008',
    authorPhone: '1900.6789',
    isVerified: true,
  },
  {
    id: '3',
    title: 'Hà Nội đi Đà Nẵng - Limousine VIP',
    needType: 'BUY',
    propertyType: 'Limousine VIP',
    price: '550.000 - 680.000 VNĐ',
    minPriceNum: 550,
    maxPriceNum: 680,
    area: '9 ghế trống',
    minAreaNum: 9,
    location: 'Bến xe Nước Ngầm, Hà Nội - Bến xe Trung tâm Đà Nẵng',
    province: 'Hà Nội',
    district: 'Đà Nẵng',
    legal: 'Nhắc lịch trước 2 giờ',
    direction: '19:30',
    note: 'Có hỗ trợ đổi ngôn ngữ Việt - Anh',
    description: `Tuyến đường dài có thông báo chủ động trước giờ khởi hành và hỗ trợ khách theo dõi trạng thái chuyến.
Yêu cầu nghiệp vụ:
- Cronjob tự động gửi nhắc lịch kèm mã vé, biển số xe và điểm đón.
- Nếu xe delay, đổi phương tiện hoặc hủy chuyến, hệ thống gửi thông báo khẩn cấp.
- Nội dung giao diện, email xác nhận và hóa đơn có thể hiển thị theo tiếng Việt hoặc tiếng Anh.`,
    timeAgo: 'Còn 9 ghế',
    createdAt: '16/09/2026',
    authorName: 'Nhà xe Bắc Nam',
    authorCode: 'BW-102',
    authorPhone: '1900.6789',
    isVerified: true,
  },
  {
    id: '4',
    title: 'Gửi hàng TP. Hồ Chí Minh đi Cần Thơ',
    needType: 'RENT',
    propertyType: 'Gửi hàng hóa',
    price: '80.000 - 220.000 VNĐ',
    minPriceNum: 80,
    maxPriceNum: 220,
    area: 'Tối đa 30 kg',
    minAreaNum: 30,
    location: 'Bến xe Miền Tây, TP. Hồ Chí Minh - Ninh Kiều, Cần Thơ',
    province: 'Hồ Chí Minh',
    district: 'Cần Thơ',
    legal: 'Cấp mã vận đơn',
    direction: 'Mỗi 60 phút',
    note: 'Từ chối hàng cấm hoặc hàng hạn chế vận chuyển',
    description: `Dịch vụ gửi hàng theo tuyến xe dành cho kiện nhỏ, hồ sơ, hàng tiêu dùng và bưu phẩm hợp lệ.
Yêu cầu nghiệp vụ:
- Khách nhập loại hàng, khối lượng, kích thước, điểm gửi và điểm nhận.
- Hệ thống tính cước dựa trên tuyến đường và đặc điểm hàng hóa.
- Nếu loại hàng thuộc danh mục cấm hoặc hạn chế, hệ thống từ chối yêu cầu.
- Sau thanh toán, hệ thống tạo mã vận đơn để khách và người nhận tra cứu trạng thái.`,
    timeAgo: 'Nhận trong ngày',
    createdAt: '16/09/2026',
    authorName: 'Quầy vận đơn BusWay',
    authorCode: 'BW-CARGO',
    authorPhone: '1900.6789',
    isVerified: true,
  },
  {
    id: '5',
    title: 'Đà Nẵng đi Huế - Ghế ngồi chất lượng cao',
    needType: 'BUY',
    propertyType: 'Ghế ngồi',
    price: '120.000 - 180.000 VNĐ',
    minPriceNum: 120,
    maxPriceNum: 180,
    area: '24 ghế trống',
    minAreaNum: 24,
    location: 'Bến xe Trung tâm Đà Nẵng - Bến xe phía Nam Huế',
    province: 'Đà Nẵng',
    district: 'Huế',
    legal: 'Đặt vé không cần đăng nhập',
    direction: '08:00',
    note: 'Khách vãng lai tra cứu bằng mã đơn hàng và số điện thoại',
    description: `Tuyến ngắn chạy nhiều khung giờ, hỗ trợ luồng đặt vé nhanh cho khách không muốn tạo tài khoản.
Yêu cầu nghiệp vụ:
- Khách nhập họ tên, số điện thoại và email nhận vé.
- Hệ thống không yêu cầu thiết lập mật khẩu, chuyển thẳng sang thanh toán.
- Vé điện tử được gửi qua email hoặc SMS sau khi thanh toán thành công.
- Khách vãng lai vẫn có thể tra cứu, yêu cầu hủy vé và nhận thông báo chuyến đi.`,
    timeAgo: 'Còn 24 ghế',
    createdAt: '16/09/2026',
    authorName: 'Nhà xe Hải Vân',
    authorCode: 'BW-205',
    authorPhone: '1900.6789',
    isVerified: true,
  },
  {
    id: '6',
    title: 'TP. Hồ Chí Minh đi Vũng Tàu - Limousine 9 chỗ',
    needType: 'BUY',
    propertyType: 'Limousine',
    price: '180.000 - 250.000 VNĐ',
    minPriceNum: 180,
    maxPriceNum: 250,
    area: '6 ghế trống',
    minAreaNum: 6,
    location: 'Quận 1, TP. Hồ Chí Minh - Trung tâm Vũng Tàu',
    province: 'Hồ Chí Minh',
    district: 'Vũng Tàu',
    legal: 'Tích điểm sau chuyến',
    direction: '07:30',
    note: 'Hoàn tất chuyến đi sẽ tự cộng điểm thành viên',
    description: `Chuyến xe limousine đón trả nội thành, phù hợp khách hàng có tài khoản muốn tích điểm sau chuyến đi.
Yêu cầu nghiệp vụ:
- Sau khi chuyến kết thúc thực tế, hệ thống cộng điểm theo giá trị vé.
- Khách có thể theo dõi lịch sử cộng/trừ điểm và hạng thành viên.
- Khi đủ điểm thăng hạng, hệ thống kích hoạt ưu đãi như mã giảm giá hoặc quyền ưu tiên chọn ghế.`,
    timeAgo: 'Còn 6 ghế',
    createdAt: '16/09/2026',
    authorName: 'Nhà xe Phương Đông',
    authorCode: 'BW-156',
    authorPhone: '1900.6789',
    isVerified: true,
  },
];
