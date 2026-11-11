# Danh mục API đã có

> **Ảnh chụp kiểm kê:** nhánh `develop`, commit `f7dc5ff` (03/10/2026).  
> **Base URL local:** `http://localhost:4000/api/v1`. Các đường dẫn trong bảng bên dưới được ghi tương đối với `/api/v1`.

## Mục lục

- [1. Phạm vi và cách đọc](#1-phạm-vi-và-cách-đọc)
- [2. Tóm tắt hiện trạng](#2-tóm-tắt-hiện-trạng)
- [3. API đã có](#3-api-đã-có)
- [4. Quy ước API và kiểm soát nghiệp vụ](#4-quy-ước-api-và-kiểm-soát-nghiệp-vụ)
- [5. Nguồn đối chiếu](#5-nguồn-đối-chiếu)

## 1. Phạm vi và cách đọc

Tài liệu này kiểm kê các route NestJS đang được mount, đối chiếu với nơi Admin/Customer gọi API và ghi nhận phạm vi hiện trạng trong source. Các tài liệu roadmap, Use Case, Class Diagram và đề cương được dùng làm nguồn đối chiếu nghiệp vụ. Danh sách endpoint chưa triển khai được tách riêng trong [Danh-Muc-API-Du-Kien.md](Danh-Muc-API-Du-Kien.md).

| Nhãn | Ý nghĩa |
| --- | --- |
| **Đã có** | Có controller được import vào AppModule và route handler tương ứng trong source ở commit đã chốt. |
| **Một phần** | Có API hoặc UI hỗ trợ một phần nghiệp vụ, nhưng chưa đủ scope của feature Admin/Customer. |

Kiểm kê route dựa trên apps/api/src/**.controller.ts, apps/api/src/app.module.ts và apps/api/src/common/configure-api.ts; đối chiếu client ở apps/admin/src và apps/web/src. Git hiện ở develop @ f7dc5ff, đúng snapshot ghi trong roadmap. Có **77 route handler trên 17 controller**. Repo không có thư mục apps/mobile; mobile chưa phải app riêng trong source hiện tại. Nếu bổ sung app mobile, nó nên gọi cùng /api/v1 và dùng cùng backend, xác thực và business rules như Web.

Đây là kiểm kê tĩnh theo source; không gọi thử endpoint trên server đang chạy.

## 2. Tóm tắt hiện trạng

| Phạm vi  | Đã có                                                                                                                                            | Còn thiếu chính                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nền API  | Prefix `/api/v1`, DTO validation, error filter, response envelope, CORS và các quy ước dùng chung.                                               | Chưa thay thế các feature nghiệp vụ chưa được triển khai.                                                                                                       |
| Admin    | Nhà xe, loại xe, xe/ghế, tuyến, bảng giá, chuyến/ghế chuyến; khách hàng dạng đọc; tài khoản, phiên đăng nhập, role/permission và tenant scope.   | Quản trị booking/vé, soát vé, gửi hàng, khuyến mãi, thanh toán/hóa đơn, báo cáo, nhân viên, chat CSKH và backup/restore. Dashboard đang mặc định dùng fixture.  |
| Customer | Đăng ký OTP, đăng nhập/đăng xuất/refresh/session; hồ sơ; tra cứu tuyến/chuyến/ghế; xem lịch sử booking/vé và tra cứu vé bằng mã + số điện thoại. | Giữ ghế, tạo booking/vé, đổi/hủy, mã giảm giá, thanh toán online, hóa đơn, gửi hàng, chat realtime, thông báo chủ động, đánh giá và các use case gợi ý/chatbot. |
| Mobile   | Chưa có app mobile trong `apps/`.                                                                                                                | Khi có mobile client, tiếp tục dùng API chung; không tạo API hoặc business logic riêng cho mobile.                                                              |

**Điểm cần phân biệt:** `GET /bookings` và `GET /tickets` hiện chỉ truy vấn dữ liệu của tài khoản Customer đang đăng nhập. Chúng không đồng nghĩa với API quản trị toàn bộ booking/vé theo tenant. `GET /customers/:id/shipments` chỉ là phần lịch sử gửi hàng trong workspace khách hàng Admin; hiện chưa có module gửi hàng riêng.

## 3. API đã có

Các endpoint dưới đây nằm dưới /api/v1. Phần này chia theo phạm vi sử dụng để dễ phân biệt Admin và Customer. API dùng chung được liệt kê một lần ở mục 3.3; API công khai/nền tảng nằm ở mục 3.4; quyền vẫn do backend xác minh theo tài khoản, role, tenant và chủ sở hữu dữ liệu.

| Nhóm API | Số route | Cách hiểu |
| --- | ---: | --- |
| Admin | 54 | Route quản trị hoặc tenant scope, không tính API đọc dùng chung. |
| Customer | 13 | Route phục vụ tài khoản và luồng Customer; một số route có thể truy cập công khai. |
| Admin và Customer dùng chung | 8 | Cùng method/path; backend giới hạn dữ liệu và thao tác theo role/tenant. |
| Công khai/nền tảng | 2 | Health probe và form liên hệ công khai. |
| **Tổng** | **77** | **77 route handler duy nhất trên 17 controller.** |

### 3.1 API phía Admin đã có

Các route ở đây phục vụ quản trị hệ thống hoặc nhà xe. Admin cũng dùng các API chung ở mục 3.3; chúng được liệt kê riêng để không lặp lại.

#### Quản lý nhà xe

Các thao tác ghi do Super Admin hoặc quyền phù hợp bảo vệ. API đọc danh sách/chi tiết nằm ở mục 3.3.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/bus-companies` | Tạo nhà xe. |
| PATCH | `/bus-companies/:id` | Cập nhật nhà xe. |
| PATCH | `/bus-companies/:id/status` | Bật/tắt trạng thái nhà xe. |

#### Loại xe

Tenant role với permission vehicle-type:*.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/vehicle-types` | Danh sách loại xe. |
| GET | `/vehicle-types/:id` | Chi tiết loại xe. |
| POST | `/vehicle-types` | Tạo loại xe. |
| PATCH | `/vehicle-types/:id` | Cập nhật loại xe. |

#### Xe và sơ đồ ghế xe

Tenant role; permission tách riêng cho xe và ghế.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/vehicles` | Danh sách xe. |
| GET | `/vehicles/:id` | Chi tiết xe. |
| POST | `/vehicles` | Tạo xe. |
| PATCH | `/vehicles/:id` | Cập nhật xe. |
| PATCH | `/vehicles/:id/status` | Cập nhật trạng thái xe. |
| GET | `/vehicles/:vehicleId/seats` | Danh sách ghế của xe. |
| POST | `/vehicles/:vehicleId/seats` | Thêm ghế cho xe. |
| PATCH | `/vehicles/:vehicleId/seats/:seatId` | Cập nhật ghế xe. |
| DELETE | `/vehicles/:vehicleId/seats/:seatId` | Xóa ghế xe. |

#### Quản lý tuyến xe

Các thao tác ghi yêu cầu tenant role và permission tuyến. API đọc nằm ở mục 3.3.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/routes` | Tạo tuyến. |
| PATCH | `/routes/:id` | Cập nhật tuyến. |
| PATCH | `/routes/:id/status` | Cập nhật trạng thái tuyến. |

#### Bảng giá

Toàn bộ route hiện được bảo vệ theo tenant role và permission. Chưa có fare endpoint công khai riêng cho Customer.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/fare-prices` | Danh sách bảng giá. |
| GET | `/fare-prices/applicable` | Tìm giá áp dụng theo điều kiện chuyến. |
| GET | `/fare-prices/:id` | Chi tiết bảng giá. |
| POST | `/fare-prices` | Tạo bảng giá. |
| PATCH | `/fare-prices/:id` | Cập nhật bảng giá. |
| PATCH | `/fare-prices/:id/status` | Cập nhật trạng thái bảng giá. |

Giá Customer nhìn thấy cần được trả từ API tìm kiếm/chi tiết chuyến hoặc contract công khai được chốt sau.

#### Điều hành chuyến và ghế chuyến

Tenant role với permission chuyến.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/trips` | Tạo chuyến. |
| GET | `/trips` | Danh sách chuyến quản trị. |
| GET | `/trips/:id/operational-detail` | Chi tiết vận hành chuyến. |
| GET | `/trips/:id/seat-inventory` | Inventory ghế cho vận hành. |
| PATCH | `/trips/:id` | Cập nhật chuyến. |
| PATCH | `/trips/:id/status` | Cập nhật trạng thái chuyến. |
| POST | `/trips/:id/cancel` | Hủy chuyến. |

#### Workspace khách hàng

Tenant role với permission customer:read; dữ liệu giới hạn theo tenant. API hiện read-only.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/customers` | Danh sách khách hàng. |
| GET | `/customers/:id` | Chi tiết khách hàng. |
| GET | `/customers/:id/transactions` | Lịch sử giao dịch của khách hàng. |
| GET | `/customers/:id/tickets` | Lịch sử vé của khách hàng. |
| GET | `/customers/:id/shipments` | Lịch sử gửi hàng của khách hàng. |

#### Tài khoản Admin

SUPER_ADMIN với permission admin-account:*; không thay thế module hồ sơ nhân viên.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/admin-accounts` | Danh sách tài khoản Admin. |
| GET | `/admin-accounts/:id` | Chi tiết tài khoản Admin. |
| POST | `/admin-accounts` | Tạo tài khoản Admin. |
| PATCH | `/admin-accounts/:id` | Cập nhật tài khoản Admin. |
| PATCH | `/admin-accounts/:id/status` | Bật/tắt tài khoản Admin. |
| PUT | `/admin-accounts/:id/roles` | Thay danh sách role của tài khoản. |

#### Quyền mặc định cấp hệ thống

Chỉ SUPER_ADMIN; quản lý permission mặc định theo role.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/admin-rbac/default-role-permissions` | Xem cấu hình role/permission mặc định. |
| PUT | `/admin-rbac/default-role-permissions/:roleName` | Thay permission mặc định của role. |

#### Quyền cấp nhà xe

NHA_XE_ADMIN với permission role:read và permission:assign, trong tenant hiện tại.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/admin-rbac/tenant-role-permissions` | Xem cấu hình permission của tenant. |
| PUT | `/admin-rbac/tenant-role-permissions/:roleName` | Thay permission override của role tenant. |
| DELETE | `/admin-rbac/tenant-role-permissions/:roleName` | Xóa override và trả về cấu hình kế thừa. |

#### Super Admin cấu hình quyền cho tenant

Chỉ SUPER_ADMIN; cấu hình hoặc đặt lại permission override cho nhà xe cụ thể.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/admin-rbac/tenants/:nhaXeId/role-permissions` | Xem cấu hình permission của một tenant. |
| PUT | `/admin-rbac/tenants/:nhaXeId/role-permissions/:roleName` | Thay permission override của role tenant. |
| DELETE | `/admin-rbac/tenants/:nhaXeId/role-permissions/:roleName` | Xóa override của role tenant. |

#### Inbox liên hệ

Gửi form công khai ở mục 3.3; Admin xem và cập nhật inbox. Chỉ SUPER_ADMIN được thao tác theo controller hiện tại.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/contacts` | Danh sách yêu cầu liên hệ. |
| GET | `/contacts/:id` | Chi tiết yêu cầu liên hệ. |
| PATCH | `/contacts/:id/status` | Cập nhật trạng thái xử lý. |

#### Nơi Admin frontend đang gọi API

| Client | Các service/luồng đã nối API thật |
| --- | --- |
| Admin | Nhà xe, loại xe, xe/ghế, tuyến, bảng giá, chuyến, khách hàng, tài khoản, RBAC và phiên đăng nhập. Dashboard chỉ gọi API nếu đặt NEXT_PUBLIC_ADMIN_DATA_SOURCE=api; endpoint client cần gọi hiện chưa có backend handler. Mặc định service trả fixture. |

### 3.2 API phía Customer đã có

Các route dưới đây gắn với đăng ký hoặc dữ liệu của Customer đang đăng nhập. Customer cũng dùng API chung ở mục 3.3; các API công khai được ghi riêng tại mục 3.4.

#### Đăng ký tài khoản Customer

Hiện có OTP đăng ký; chưa có OTP quên mật khẩu.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/auth/register/request-otp` | Gửi OTP đăng ký. |
| POST | `/auth/register/verify-otp` | Xác thực OTP đăng ký. |
| POST | `/auth/register` | Tạo tài khoản Customer. |

#### Hồ sơ Customer

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/me` | Xem hồ sơ Customer hiện tại. |
| PATCH | `/me` | Cập nhật hồ sơ Customer hiện tại. |

#### Lịch sử booking Customer

Yêu cầu đăng nhập; service truy vấn theo taiKhoanId của Customer. Chưa có API tạo booking, giữ ghế, đổi hoặc hủy booking.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/bookings` | Danh sách booking của Customer hiện tại. |
| GET | `/bookings/:bookingId` | Chi tiết booking thuộc Customer hiện tại. |

#### Vé Customer

Hai route đầu chỉ trả vé của Customer đang đăng nhập. Tra cứu công khai theo mã vé và số điện thoại được liệt kê trong scope Customer bên dưới. Chưa có API phát hành, đổi/hủy hoặc soát vé.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/tickets` | Danh sách vé của Customer hiện tại. |
| GET | `/tickets/:ticketId` | Chi tiết vé thuộc Customer hiện tại. |

#### Tìm kiếm và xem chuyến Customer

Optional auth; Web tìm chuyến, xem chi tiết và ghế. Đọc ghế chỉ phản ánh trạng thái lúc đọc, không giữ ghế.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/trips/search` | Tìm chuyến theo điều kiện. |
| GET | `/trips/:id` | Xem chi tiết chuyến. |
| GET | `/trips/:id/seats` | Xem sơ đồ/trạng thái ghế chuyến. |

#### Tra cứu vé công khai

Lookup theo mã vé và số điện thoại, có rate limit.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/tickets/lookup` | Tra cứu vé theo mã vé và số điện thoại. |

#### Nơi Customer frontend đang gọi API

| Client | Các service/luồng đã nối API thật |
| --- | --- |
| Web Customer | Đăng ký/đăng nhập, tuyến, tìm kiếm/chi tiết chuyến và ghế, hồ sơ /me, lịch sử booking/vé, tra cứu vé và form liên hệ. Một số trang chi tiết chuyến còn gọi fetch trực tiếp thay vì qua service riêng. |
| Mobile | Không tìm thấy source app mobile. Hiện không có API riêng cho mobile; nếu bổ sung app, mobile dùng cùng /api/v1 và quyền theo tài khoản/role. |

### 3.3 API dùng chung cho Admin và Customer

Các endpoint dưới đây được cả hai client sử dụng với cùng method/path. Backend xác minh role, tenant và phạm vi dữ liệu cho từng request.

#### Đăng nhập và phiên

Login nhận tài khoản Admin hoặc Customer; session và logout xử lý phiên hiện tại. Đăng ký Customer nằm ở mục 3.2.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/auth/login` | Tạo phiên đăng nhập. |
| POST | `/auth/refresh` | Cấp lại access token/refresh token. |
| POST | `/auth/logout` | Thu hồi phiên bằng refresh token. |
| GET | `/auth/session` | Lấy thông tin phiên hiện tại; yêu cầu access token. |

#### Tra cứu nhà xe

Đọc dùng optional auth; thao tác quản trị nằm ở mục 3.1.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/bus-companies` | Danh sách nhà xe. |
| GET | `/bus-companies/:id` | Chi tiết nhà xe. |

#### Tra cứu tuyến

Đọc dùng optional auth; thao tác quản trị nằm ở mục 3.1.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/routes` | Danh sách tuyến. |
| GET | `/routes/:id` | Chi tiết tuyến. |

### 3.4 API công khai hoặc nền tảng

Các endpoint này không thuộc riêng Admin hay Customer. API health phục vụ kiểm tra dịch vụ; form liên hệ cho phép người dùng gửi yêu cầu mà chưa cần phiên đăng nhập.

#### Health

Public; dùng để kiểm tra API có hoạt động.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/health` | Trả trạng thái health của API. |

#### Gửi form liên hệ

Public và có rate limit; đây là form một chiều, chưa phải chat realtime CSKH.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| POST | `/contacts` | Gửi yêu cầu liên hệ. |

## 4. Quy ước API và kiểm soát nghiệp vụ

- Thành công: resource đơn theo `{ "data": ... }`; danh sách phân trang theo `{ "data": [...], "meta": { "page", "pageSize", "totalItems", "totalPages" } }`.
- Query convention: `page`, `pageSize`, `search`, `sortBy`, `sortDirection`; filter nghiệp vụ bổ sung theo feature.
- Lỗi validation: `VALIDATION_ERROR` với `details` gồm `field` và `message`; lỗi nghiệp vụ dùng status/error code ổn định (ví dụ ghế vừa được người khác giữ thì `409 SEAT_UNAVAILABLE`).
- Quyền Customer/Admin/Super Admin phải được backend xác minh trên từng resource; Admin nhà xe luôn bị giới hạn tenant. API chung không đồng nghĩa quyền đọc/ghi giống nhau.
- Đặt/giữ ghế, booking, phát vé, thanh toán, refund và các thao tác ghi nhiều bảng cần transaction/atomic update phù hợp; callback/ retry thanh toán cần idempotency và xác thực phía provider.
- Timestamp dùng ISO 8601 có `Z` hoặc offset; ngày không có giờ dùng `YYYY-MM-DD`. Không dùng floating-point làm nguồn tính tiền nghiệp vụ.

Các quy ước này lấy từ AGENTS.md gốc của repository và source configure-api.ts. Khi thêm route hoặc thay đổi API contract, cần thống nhất method, params/query/body, response, lỗi và quyền trước khi triển khai.

## 5. Nguồn đối chiếu

| Nguồn | Dùng để đối chiếu |
| --- | --- |
| `apps/api/src/app.module.ts` và controller dưới `apps/api/src/`               | Module đang mount và các route hiện có.                                                                    |
| `apps/api/src/common/configure-api.ts`                                        | Prefix/version, CORS, validation, response envelope và error filter.                                       |
| `apps/admin/src/features/super-admin-dashboard/services/dashboard-service.ts` | Dashboard mặc định fixture và API URL dự kiến khi bật data source `api`.                                   |
| `docs/vexgo_admin_feature_roadmap.html`                                       | Scope/thứ tự roadmap Admin và trạng thái snapshot `develop @ f7dc5ff`.                                     |
| `docs/SUC_Chot_DeDacTa_TenantScoped.mdl`                                      | Actor, tenant scope và use case hệ thống Customer/Admin.                                                   |
| `docs/Class_Diagram_Thiet_Ke_Final_Updated_v4.mdl`                            | Domain model và thao tác dự kiến như booking, thanh toán, gửi hàng, chat, thông báo, phản hồi, phân quyền. |
| `docs/De-Cuong-Chi-Tiet.md`                                                   | Yêu cầu đề tài: Admin, Customer, responsive/mobile, cổng thanh toán và Việt–Anh.                           |
