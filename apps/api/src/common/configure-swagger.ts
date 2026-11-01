import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('VexGo API Documentation')
    .setDescription(
      'Tài liệu giao diện lập trình ứng dụng (REST API) chính thức cho Nền tảng Đặt vé xe khách và Quản lý Nhà xe VexGo.\n\n' +
        '- **Quy ước chuẩn**: Toàn bộ REST endpoints tuân thủ prefix `/api/v1`.\n' +
        '- **Định dạng thời gian**: Timestamp theo chuẩn ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`), ngày tháng không kèm giờ theo định dạng `DD-MM-YYYY`.\n' +
        '- **Phân quyền truy cập**: Hỗ trợ 4 nhóm đối tượng: Khách vãng lai (Public), Khách hàng (Customer), Nhân viên / Admin nhà xe (Tenant Admin), Quản trị viên tối cao (Super Admin).\n' +
        '- **Response Envelope**: Phản hồi đơn lẻ bọc trong `{ data: ... }`, phân trang bọc trong `{ data: [...], meta: { page, pageSize, totalItems, totalPages } }`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description:
          'Nhập Access Token (JWT) được cấp sau khi đăng nhập thành công. Ví dụ: Bearer eyJhbGciOi...',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-hold-token',
        in: 'header',
        description: 'Mã token ký số của phiên giữ chỗ ghế tạm thời (Seat Hold Token)',
      },
      'x-hold-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-booking-code',
        in: 'header',
        description: 'Mã đơn đặt vé công khai để tra cứu nhanh thông tin',
      },
      'x-booking-code',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-booking-phone',
        in: 'header',
        description: 'Số điện thoại người đặt vé để tra cứu công khai',
      },
      'x-booking-phone',
    )
    .addTag('Xác thực & Phiên làm việc (Auth)', 'Đăng ký OTP, đăng nhập, cấp lại token, đổi mật khẩu và phiên làm việc')
    .addTag('Quản trị tài khoản Admin (Admin Accounts)', 'Quản lý tài khoản quản trị viên, nhân viên nhà xe và gán vai trò')
    .addTag('Phân quyền hệ thống (Default RBAC)', 'Quản lý danh sách quyền mặc định của các vai trò trong nền tảng')
    .addTag('Phân quyền nhà xe - Cấp nền tảng (Platform Tenant RBAC)', 'Super Admin cấu hình và kiểm soát phân quyền cho từng nhà xe')
    .addTag('Phân quyền nội bộ nhà xe (Tenant Admin RBAC)', 'Admin nhà xe tùy chỉnh phân quyền nội bộ cho nhân viên')
    .addTag('Nhà xe & Đối tác vận tải (Bus Companies)', 'Quản lý hồ sơ nhà xe đối tác, thông tin liên hệ và trạng thái hoạt động')
    .addTag('Địa điểm & Tỉnh thành (Locations)', 'Danh mục tỉnh/thành phố và quận/huyện phục vụ tìm kiếm hành trình')
    .addTag('Bến bãi & Điểm đón trả (Stations)', 'Quản lý bến xe trung tâm, văn phòng nhà xe và điểm đón trả khách')
    .addTag('Tuyến xe (Routes)', 'Quản lý danh mục tuyến đường liên tỉnh, cự ly và thời gian hành trình')
    .addTag('Loại phương tiện (Vehicle Types)', 'Phân loại dòng xe (Giường nằm, Limousine, Ghế ngồi cao cấp...)')
    .addTag('Xe khách & Sơ đồ ghế (Vehicles & Seats)', 'Quản lý phương tiện, thiết lập ma trận sơ đồ ghế và cấu hình tầng xe')
    .addTag('Bảng giá vé (Fare Prices)', 'Thiết lập bảng giá vé cơ sở cho từng tuyến xe và loại phương tiện')
    .addTag('Chuyến xe & Lịch trình (Trips)', 'Quản lý lịch chạy xe, điều độ xuất bến, kiểm tra tồn kho ghế và tìm kiếm chuyến đi')
    .addTag('Giữ chỗ tạm thời (Seat Holds)', 'Cơ chế khóa ghế và giữ chỗ có thời hạn bảo đảm ngăn chặn xung đột đặt chỗ')
    .addTag('Đặt vé & Báo giá (Bookings)', 'Báo giá vé, khởi tạo đơn đặt chỗ và theo dõi lịch sử đơn hàng')
    .addTag('Vé xe điện tử (Tickets)', 'Phát hành vé xe, tra cứu vé công khai bằng mã vé và xử lý yêu cầu hủy vé')
    .addTag('Khách hàng & Hồ sơ (Customers)', 'Quản lý hồ sơ người dùng và lịch sử giao dịch của khách hàng')
    .addTag('Khuyến mãi & Mã giảm giá (Promotions)', 'Chương trình ưu đãi, mã giảm giá vé và điều kiện áp dụng')
    .addTag('Thanh toán & Cổng thanh toán (Payments)', 'Tích hợp MoMo, VNPay, ZaloPay, SePay chuyển khoản và đối soát thanh toán')
    .addTag('Ký gửi hàng hóa (Shipments)', 'Dịch vụ gửi hàng theo xe khách, tra cứu vận đơn và quản lý bưu kiện')
    .addTag('Thông báo hệ thống (Notifications)', 'Hệ thống thông báo đẩy về chuyến xe, thanh toán và khuyến mãi')
    .addTag('Đánh giá & Phản hồi (Reviews)', 'Đánh giá chất lượng dịch vụ nhà xe và chuyến đi từ hành khách')
    .addTag('Hỗ trợ trực tuyến & Chat CSKH (Support Chat)', 'Kênh nhắn tin hỗ trợ trực tiếp giữa khách hàng và nhà xe')
    .addTag('Báo cáo doanh thu (Revenue Reports)', 'Báo cáo tài chính, sản lượng vé và doanh thu nhà xe')
    .addTag('Bảng điều khiển nền tảng (Platform Dashboard)', 'Số liệu tổng quan chỉ số vận hành toàn hệ thống VexGo')
    .addTag('Liên hệ & Góp ý (Contacts)', 'Tiếp nhận thông tin liên hệ và phản ánh góp ý từ người dùng')
    .addTag('Kiểm tra hệ thống (System Health)', 'Kiểm tra trạng thái hoạt động của API và kết nối cơ sở dữ liệu')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/v1/docs', app, document, {
    useGlobalPrefix: false,
    customSiteTitle: 'VexGo API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
