# Danh Sách Các Chức Năng Đã Có Trong Hệ Thống VexGo

Tài liệu này tổng hợp toàn bộ các tính năng, phân hệ nghiệp vụ và API đã được xây dựng và hoạt động trong nền tảng **VexGo** (bao gồm Backend API, Customer Web, Admin Web và Cơ sở dữ liệu).

---

## I. Tổng Quan Kiến Trúc Nền Tảng

- **Mô hình**: Monorepo (Turborepo + npm workspaces)
- **Backend API (`apps/api`)**: NestJS, Prisma ORM, MySQL, JWT + Refresh Token, RBAC đa cấp (Multi-tenant)
- **Customer Web (`apps/web`)**: Next.js 15 (App Router), Tailwind CSS, Lucide Icons
- **Admin Web (`apps/admin`)**: Next.js 15 (App Router), Tailwind CSS, TanStack Table, Lucide Icons
- **Nguyên tắc cốt lõi**: **One Database · One Backend · One Business Rule · One API Convention**

---

## II. Phân Hệ Backend API (`apps/api`)

Toàn bộ API tuân thủ chuẩn RESTful `/api/v1` với chuẩn envelope đồng nhất `{ data, meta? }`:

### 1. Phân hệ Xác thực & Tài khoản (`auth/`, `admin-accounts/`)
- **Đăng ký tài khoản khách hàng**: Xác thực số điện thoại, mật khẩu, họ tên, email.
- **Đăng nhập & Cấp phát JWT**: Cặp token Access Token (ngắn hạn) + Refresh Token (dài hạn), xoay vòng token an toàn.
- **Xác thực OTP**: Gửi và xác thực OTP qua số điện thoại/email (quên mật khẩu, kích hoạt).
- **Đổi mật khẩu / Quên mật khẩu**: Mã hóa Bcrypt, kiểm tra mật khẩu cũ.
- **Quản lý phiên làm việc (`PhienDangNhap`)**: Thu hồi token khi đăng xuất hoặc đổi mật khẩu.
- **Tài khoản Quản trị (`admin-accounts/`)**: CRUD tài khoản quản trị viên nền tảng (Super Admin) và quản trị viên nhà xe (Tenant Admin).

### 2. Phân hệ Phân quyền Đa cấp RBAC (`admin-rbac/`)
- **Platform RBAC**: Quản lý vai trò và quyền hạn toàn hệ thống (Super Admin).
- **Tenant RBAC (Phân quyền Nhà xe)**: Phân quyền động cho từng nhà xe (Chủ nhà xe, Quản lý điều hành, Nhân viên bán vé, Nhân viên hàng hóa).
- **Custom Permission Config (`CauHinhQuyenVaiTroNhaXe`)**: Bật/tắt hoặc ghi đè quyền hạn riêng biệt theo từng nhà xe.
- **RBAC Guards & Decorators**: Kiểm tra quyền chặt chẽ ở cấp độ Controller/Service theo role và tenant scope.

### 3. Phân hệ Nhà xe & Đối tác (`bus-companies/`)
- Quản lý danh sách nhà xe (`NhaXe`), logo, số điện thoại hotline, địa chỉ, trạng thái hoạt động.
- Tìm kiếm, lọc và phân trang nhà xe cho cả khách hàng và ban quản trị.

### 4. Phân hệ Loại xe & Phương tiện (`vehicle-types/`, `vehicles/`)
- **Loại xe (`LoaiXe`)**: Ghế ngồi, Giường nằm, Limousine VIP... cùng cấu hình số tầng, số cột, số hàng.
- **Phương tiện (`Xe`)**: Quản lý biển số xe, nhà xe sở hữu, trạng thái xe (Sẵn sàng, Đang bảo dưỡng, Đang chạy).
- **Thiết lập Sơ đồ ghế (`Ghe`)**: Cấu hình vị trí ghế (Tầng 1 / Tầng 2), mã ghế (A01, A02, B01...), loại ghế và trạng thái hoạt động.

### 5. Phân hệ Tuyến xe & Điểm đón trả (`routes/`)
- Quản lý tuyến đường (`TuyenXe`): Điểm xuất phát, điểm đến, cự ly (km), thời gian hành trình dự kiến.
- Điểm đón trả / Bến xe: Danh sách bến xe trung gian, điểm dừng dọc đường và văn phòng tiếp nhận hàng.

### 6. Phân hệ Chuyến xe & Quản lý Chỗ (`trips/`)
- **Lập lịch chuyến xe (`ChuyenXe`)**: Ngày khởi hành, giờ xuất bến, giờ đến dự kiến, gán xe và tài xế.
- **Tìm kiếm chuyến xe**: Tìm chuyến theo Điểm đi - Điểm đến - Ngày đi (hỗ trợ cả tìm kiếm khứ hồi), bộ lọc theo nhà xe, giờ khởi hành, giá vé, loại xe.
- **Sinh sơ đồ ghế chuyến xe (`GheChuyenXe`)**: Khởi tạo trạng thái ghế tương ứng với phương tiện phục vụ chuyến.
- **Khóa giữ chỗ (Seat Hold & Concurrency)**: Xử lý chống trùng ghế đồng thời (Race condition) bằng Database Transaction.

### 7. Phân hệ Bảng giá vé (`fare-prices/`)
- Quản lý bảng giá (`BangGia`) theo từng tuyến xe, loại xe và thời điểm áp dụng (ngày thường, dịp lễ/tết).
- Thiết lập giá sàn, giá trần, chính sách phụ thu từng loại ghế (ghế VIP, tầng dưới, tầng trên).

### 8. Phân hệ Đặt vé & Quản lý Vé (`bookings/`, `tickets/`)
- **Tạo phiếu đặt vé (`PhieuDatVe`, `Ve`)**: Đặt vé một chiều và vé khứ hồi trong cùng một đơn giao dịch.
- **Tra cứu vé công khai (`/api/v1/tickets/lookup`)**: Tra cứu thông tin vé qua Mã vé + Số điện thoại (dành cho khách không đăng nhập).
- **Chi tiết vé & Lịch sử đặt vé**: Xem thông tin hành khách, ghế đã chọn, giờ xuất bến, mã QR vé.
- **Hủy vé có điều kiện (`/api/v1/tickets/cancel`)**:
  - Tự động tính phí hủy vé theo quy định (trước 24h: phí 10%; từ 12h - 24h: phí 20%; dưới 12h: không được hủy).
  - Khôi phục trạng thái ghế về trống ngay lập tức sau khi hủy thành công.

### 9. Phân hệ Gửi hàng & Vận chuyển Độc lập (`shipments/`)
- **Tạo đơn gửi hàng độc lập (`PhieuGuiHang`, `HangHoa`)**: Khách hàng hoặc nhà xe tạo đơn vận chuyển hàng theo chuyến xe mà không cần đặt vé người đi cùng.
- **Tính cước phí gửi hàng động**: Cước cơ bản (5kg đầu), phụ phí vượt cân, phụ phí hàng dễ vỡ, bảo hiểm hàng giá trị cao.
- **Hỗ trợ khách vãng lai & khách có tài khoản**: `@OptionalAuth()` cho phép gửi hàng không cần đăng nhập, tự động tạo hồ sơ khách hàng vãng lai.
- **Tra cứu vận đơn (`/api/v1/shipments/lookup`)**: Tra cứu tình trạng kiện hàng thời gian thực bằng Mã vận đơn + Số điện thoại.
- **Lịch sử trạng thái vận đơn (`LichSuTrangThaiPhieuGuiHang`)**: Theo dõi tiến trình: Đã tạo đơn → Đã nhận hàng tại bến → Đang vận chuyển → Đã đến bến nhận → Đã giao thành công.

### 10. Phân hệ Thanh toán & Đơn giao dịch (`payments/`)
- **Đơn giao dịch (`DonGiaoDich`, `ThanhToan`)**: Quản lý thanh toán hợp nhất cho cả đặt vé xe và gửi hàng.
- **Phương thức thanh toán**: Chuyển khoản ngân hàng (VietQR / Napas), Thẻ quốc tế, Tiền mặt tại quầy / bến xe.
- **Tự động sinh mã thanh toán QR**: Tạo mã QR VietQR đúng chuẩn kèm nội dung chuyển khoản tự động.
- **Hóa đơn điện tử (`HoaDon`)**: Xuất hóa đơn chi tiết cho đơn đặt vé và cước hàng hóa.

### 11. Phân hệ Khách hàng (`customers/`)
- Quản lý hồ sơ khách hàng cá nhân (`KhachHang`), lịch sử đặt vé, lịch sử gửi hàng.
- Admin quản lý danh sách khách hàng, phân loại khách hàng thân thiết, xem tổng chi tiêu.

### 12. Phân hệ Liên hệ & Hỗ trợ (`contacts/`)
- Tiếp nhận ý kiến đóng góp, liên hệ hợp tác và khiếu nại từ khách hàng gửi qua Customer Web.

---

## III. Phân Hệ Customer Web (`apps/web`)

Giao diện người dùng dành cho hành khách mua vé và gửi hàng:

### 1. Trang chủ & Tìm kiếm Chuyến xe (`/`)
- Banner quảng bá, slogan tìm kiếm hiện đại.
- Form tìm kiếm đa năng: Tuyến đường (Nơi đi, Nơi đến), Ngày đi, Ngày về (Một chiều / Khứ hồi).
- Danh sách tuyến đường phổ biến và ưu đãi nổi bật.

### 2. Danh sách & Đặt vé Chuyến xe (`/trips`)
- Bộ lọc nâng cao: Lọc theo Nhà xe, Khung giờ (Sáng, Chiều, Tối), Loại xe, Giá vé.
- Sắp xếp linh hoạt: Giờ xuất bến sớm/muộn nhất, Giá tăng/giảm dần.
- Chọn chuyến đi & chuyến về trực quan trong luồng khứ hồi.
- Sơ đồ ghế tương tác: Hiển thị trực quan tầng dưới / tầng trên, ghế trống, ghế đang giữ, ghế đã bán.
- Khóa ghế tạm thời khi hành khách bắt đầu chọn ghế.

### 3. Quy trình Đặt vé & Thanh toán (`/booking/...`, `/payment`, `/payments/bank-transfer`)
- Nhập thông tin hành khách: Họ tên, Số điện thoại, Email, Điểm đón / Điểm trả.
- Tóm tắt cước phí, áp dụng mã giảm giá / khuyến mãi.
- Thanh toán chuyển khoản ngân hàng qua mã VietQR tự động cập nhật số tiền và nội dung.
- Trang hóa đơn điện tử và xác nhận đặt vé thành công (`/invoice/[id]`, `/invoices/[invoiceId]`).

### 4. Tra cứu Vé & Hủy vé Trực tuyến (`/tra-cuu-ve`, `/tickets/lookup`, `/cancel-ticket`)
- Tra cứu vé nhanh bằng Mã vé và Số điện thoại (không cần đăng nhập).
- Xem chi tiết vé, mã QR check-in tại bến.
- Tính năng **Hủy vé trực tuyến**: Hệ thống tự động báo giá hoàn tiền, phí hủy theo quy định thời gian trước khi khách xác nhận hủy.

### 5. Dịch vụ Gửi hàng theo Nhà xe (`/send-freight`, `/shipments/new`)
- **Tạo đơn gửi hàng linh hoạt**:
  - Chọn tuyến đường, ngày gửi và chuyến xe phù hợp.
  - Thẻ chuyến xe gọn gàng, căn chỉnh thẳng cột dọc, hiển thị giá cước tối thiểu.
  - Nhập thông tin người gửi & người nhận (nhận hàng tại bến bằng CCCD/SĐT).
  - Khai báo kiện hàng: Tên hàng, loại hàng (Bưu phẩm, Thực phẩm, Quần áo, Điện tử...), kích thước (Dài x Rộng x Cao), khối lượng (kg).
  - Tùy chọn dịch vụ cộng thêm: Hàng dễ vỡ (+20.000đ), Hàng giá trị cao / Bảo hiểm (+50.000đ).
  - Không bắt buộc đăng nhập (khách vãng lai gửi được ngay).
- **Tra cứu vận đơn hàng hóa**:
  - Tab tra cứu tức thời: Nhập Mã vận đơn + Số điện thoại người gửi/nhận.
  - Hiển thị timeline hành trình kiện hàng chi tiết.

### 6. Quản lý Tài khoản Cá nhân (`/account/...`, `/profile/...`)
- Đăng nhập / Đăng ký tài khoản (`/login`, `/register`).
- Cập nhật thông tin cá nhân: Họ tên, Số điện thoại, Email, Ngày sinh.
- Đổi mật khẩu tài khoản (`/profile/password`).
- Lịch sử vé đã mua (`/account/tickets`).
- Tích điểm / Khách hàng thân thiết (`/account/loyalty`).

### 7. Trang nội dung & Hỗ trợ (`/about`, `/contact`, `/donate`, `/posts`)
- Giới thiệu nền tảng VexGo (`/about`).
- Form liên hệ và hỗ trợ khách hàng (`/contact`).
- Tin tức, bài viết kinh nghiệm du lịch và di chuyển (`/posts`).

---

## IV. Phân Hệ Admin Web (`apps/admin`)

Giao diện quản trị dành cho Super Admin (nền tảng) và Quản trị viên Nhà xe (Tenant Admin):

### 1. Xác thực & Phân quyền Quản trị (`/login`, `/rbac`, `/tenant-rbac`)
- Đăng nhập quản trị viên với JWT độc lập.
- **Platform RBAC (`/rbac`, `/rbac/tenants`)**: Quản lý vai trò (Role), nhóm quyền (Permission), cấp quyền cho quản trị viên toàn hệ thống.
- **Tenant RBAC (`/tenant-rbac`, `/rbac/tenants/[nhaXeId]`)**: Cấu hình và ghi đè quyền hạn riêng biệt cho từng nhà xe thành viên.
- **Quản lý Tài khoản Quản trị (`/admin-accounts`)**: Thêm mới, phân quyền, khóa/mở tài khoản nhân viên và quản lý nhà xe.

### 2. Quản trị Nhà xe (`/bus-companies`)
- Danh sách, thêm mới, chỉnh sửa thông tin nhà xe đối tác.
- Quản lý trạng thái hợp tác, thông tin hotline, văn phòng đại diện.

### 3. Quản trị Loại xe & Đội xe (`/vehicle-types`, `/vehicles`, `/vehicles/[vehicleId]/seats`)
- **Loại xe (`/vehicle-types`)**: Quản lý mẫu sơ đồ xe (Giường nằm 34 chỗ, Limousine 22 phòng, Ghế ngồi 29 chỗ...).
- **Danh sách Xe (`/vehicles`)**: Quản lý biển số xe, nhà xe chủ quản, trạng thái vận hành.
- **Cấu hình Sơ đồ Ghế trực quan (`/vehicles/[vehicleId]/seats`)**:
  - Giao diện kéo thả/click để thiết lập từng vị trí ghế theo tầng 1 và tầng 2.
  - Đặt mã ghế, loại ghế (VIP, Standard), trạng thái hoạt động của từng ghế.

### 4. Quản trị Tuyến xe (`/routes`)
- Tạo mới và quản lý tuyến đường vận tải (Điểm đi - Điểm đến).
- Thiết lập cự ly, thời gian hành trình dự kiến.
- Quản lý các điểm đón trả khách và văn phòng nhận hàng dọc tuyến.

### 5. Quản trị Bảng giá vé (`/fare-prices`)
- Thiết lập bảng giá vé theo tuyến xe và loại xe.
- Định giá riêng cho từng loại ghế, phụ thu ngày cao điểm.

### 6. Quản trị Chuyến xe & Sơ đồ Ghế chuyến đi (`/trips`, `/trips/[tripId]/seats`)
- **Điều hành Chuyến xe (`/trips`)**:
  - Lập lịch chuyến mới: Tuyến xe, ngày giờ xuất bến, gán phương tiện và tài xế.
  - Bộ lọc chuyến xe theo ngày, nhà xe, tuyến đường và trạng thái vận hành.
- **Theo dõi Ghế Chuyến đi Thời gian thực (`/trips/[tripId]/seats`)**:
  - Xem sơ đồ ghế của chuyến xe: Ghế còn trống, ghế đang giữ, ghế đã bán.
  - Hỗ trợ nhân viên thao tác giữ chỗ hoặc bán vé trực tiếp tại quầy.

### 7. Quản trị Khách hàng (`/customers`, `/customers/[customerId]`)
- Quản lý toàn bộ danh sách khách hàng trong hệ thống.
- Xem chi tiết hồ sơ khách hàng: Thông tin cá nhân, tổng chi tiêu, lịch sử tất cả các vé đã đặt và đơn hàng đã gửi.

---

## V. Tóm Tắt Các Nghiệp Vụ Nổi Bật Đã Xử Lý Sâu

1. **Atomic Concurrency & Anti-Overbooking**: Sử dụng Prisma Transaction để khóa ghế, ngăn ngừa triệt để tình trạng hai người cùng đặt một ghế cùng lúc.
2. **Khứ hồi Đồng bộ (Round-trip Booking)**: Luồng chọn vé chiều đi và chiều về độc lập nhưng gom chung vào một đơn giao dịch và một lần thanh toán.
3. **Vận tải Hàng hóa Độc lập (Cargo Shipment Flow)**: Tính cước theo cân nặng, thể tích quy đổi, phụ phí hàng dễ vỡ, bảo hiểm; hỗ trợ hoàn toàn khách vãng lai không cần đăng nhập.
4. **Quy tắc Hủy vé & Hoàn tiền Tự động**: Ràng buộc nghiệp vụ tính phí 10% (>24h), 20% (12h-24h), và cấm hủy (<12h) hoàn toàn được bảo vệ tại Backend Service.
5. **Đa Nhà xe (Multi-tenancy RBAC)**: Dữ liệu và quyền hạn được phân tách theo phạm vi nhà xe, hỗ trợ Super Admin quản trị tập trung và Admin nhà xe tự chủ hoạt động.
