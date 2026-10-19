# Danh mục API dự kiến

> **Ảnh chụp kiểm kê:** nhánh `develop`, commit `f7dc5ff` (03/10/2026).  
> **Base URL local:** `http://localhost:4000/api/v1`. Các đường dẫn trong bảng bên dưới được ghi tương đối với `/api/v1`.

## Mục lục

- [1. Phạm vi và cách đọc](#1-phạm-vi-và-cách-đọc)
- [2. Trạng thái roadmap Admin](#2-trạng-thái-roadmap-admin-theo-tài-liệu-đính-kèm)
- [3. API dự kiến cho Admin và Customer](#3-api-dự-kiến-cho-admin-và-customer)
- [4. Hợp đồng API dùng chung và kiểm soát nghiệp vụ](#4-hợp-đồng-api-dùng-chung-và-kiểm-soát-nghiệp-vụ)
- [5. Nguồn đối chiếu](#5-nguồn-đối-chiếu)

## 1. Phạm vi và cách đọc

Tài liệu này liệt kê các API còn thiếu hoặc cần mở rộng để hoàn thành scope Admin và Customer theo source, roadmap, Use Case, Class Diagram và đề cương. Các endpoint trong phần kế hoạch là đề xuất, chưa khẳng định đã có backend handler. Danh sách route đang có nằm trong [Danh-Muc-API-Da-Co.md](Danh-Muc-API-Da-Co.md).

Mọi path là đề xuất trong API dùng chung dưới /api/v1; Admin Web, Customer Web và mobile (nếu có) cùng gọi một backend. Endpoint dùng nhiều vai trò được liệt kê tại một scope dùng chung; backend vẫn giới hạn dữ liệu theo chủ sở hữu, role và tenant.

| Trạng thái | Ý nghĩa |
| --- | --- |
| **Chưa có** | Chưa có controller/route tương ứng trong source tại snapshot ghi ở đầu tài liệu. |
| **Đề xuất** | Cần chốt contract, permission và business rules trước khi triển khai. |
| **Client target** | Client đã có URL dự kiến gọi nhưng backend chưa mount handler tương ứng. |

Các tài liệu đính kèm là nguồn tham chiếu về nghiệp vụ và trạng thái dự án.

## 2. Trạng thái roadmap Admin theo tài liệu đính kèm

Roadmap HTML ghi nhận snapshot `develop @ f7dc5ff`. Bảng này giữ trạng thái đúng theo scope Admin; một API Customer hoặc model trong Class Diagram không tự làm feature Admin thành DONE.

| Mã  | Chức năng Admin                      | Trạng thái ở snapshot | API / phần còn lại                                                                           |
| ---:| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------- |
| #00 | Nền API dùng chung                   | DONE                  | Đã có prefix/version, validation, error/response contract và convention cơ bản.              |
| #01 | Nhà xe                               | DONE                  | CRUD thật; tham chiếu API bảng trên.                                                         |
| #02 | Loại xe, xe và sơ đồ ghế             | DONE                  | CRUD loại xe/xe/ghế.                                                                         |
| #03 | Tuyến xe                             | DONE                  | CRUD tuyến và tenant scope.                                                                  |
| #04 | Bảng giá                             | DONE                  | CRUD và tìm giá áp dụng cho nghiệp vụ quản trị.                                              |
| #05 | Chuyến xe và ghế chuyến              | DONE                  | CRUD/trạng thái/hủy và workspace inventory.                                                  |
| #06 | Khách hàng                           | DONE                  | Quản lý đọc theo tenant, lịch sử giao dịch/vé/gửi hàng; điểm tích lũy read-only.             |
| #07 | Phiếu đặt vé và vé                   | PARTIAL · NEXT        | Có history Customer; còn Admin tenant list/detail, hỗ trợ đổi/hủy/cập nhật trạng thái.       |
| #08 | Soát vé                              | Chưa DONE             | Cần xác thực đúng chuyến, trạng thái và chống soát trùng cho nhân viên phụ xe/thiết bị quét. |
| #09 | Gửi hàng                             | PARTIAL               | Workspace có lịch sử Customer; chưa có API/module CRUD vận hành gửi hàng.                    |
| #10 | Khuyến mãi                           | Chưa DONE             | PR #27 được roadmap ghi là chưa merge tại snapshot; không tính source ngoài commit này.      |
| #11 | Thanh toán và hóa đơn                | Chưa DONE             | Chưa có module quản trị giao dịch/hoàn tiền/hóa đơn.                                         |
| #12 | Doanh thu và báo cáo                 | Chưa DONE             | Cần dữ liệu giao dịch thật và lọc theo thời gian/nhà xe/tuyến/dịch vụ.                       |
| #13 | Dashboard tổng quan                  | PARTIAL               | UI có, mặc định fixture; target API overview chưa có backend.                                |
| #14 | Nhân viên                            | Chưa DONE             | Tài khoản Admin hiện có không thay module hồ sơ/ca/trạng thái nhân viên.                     |
| #15 | Tài khoản, vai trò và quyền          | DONE                  | Tài khoản và RBAC platform/tenant có API thật.                                               |
| #16 | Đăng nhập, đăng xuất và bảo vệ route | DONE                  | Session/token, revoke, route guard, permission và tenant checks.                             |
| #17 | Chat realtime CSKH                   | Chưa DONE             | Contact form không thay thế hội thoại, tin nhắn, trạng thái đã đọc và realtime channel.      |
| #18 | Sao lưu và phục hồi                  | Chưa DONE             | Chưa thấy API/module vận hành backup/restore.                                                |

## 3. API dự kiến cho Admin và Customer

Các scope bên dưới được tách theo client sử dụng. Mọi path là đề xuất trong API dùng chung dưới /api/v1; không tạo bản sao /admin và /customer. Endpoint nhiều vai trò được liệt kê một lần tại mục 3.3, backend giới hạn dữ liệu theo chủ sở hữu hoặc tenant.

### 3.1 API dự kiến cho Admin

#### Quản trị booking và vé (#07)

Hai API đọc hiện chỉ trả dữ liệu của Customer đăng nhập. Admin cần quyền tra cứu theo tenant; giữ nguyên route.

| Method | Endpoint | Phạm vi Admin | Trạng thái |
| --- | --- | --- | --- |
| PATCH | `/bookings/:bookingId/status` | Cập nhật trạng thái nghiệp vụ được phép. | Chưa có. |
| PATCH | `/tickets/:ticketId/status` | Cập nhật trạng thái vé theo chính sách. | Chưa có. |

Hủy/đổi booking do Customer khởi tạo hoặc Admin hỗ trợ, xem cùng endpoint tại mục 3.3.

#### Soát vé (#08)

Nhân viên hoặc thiết bị quét dùng API chung; backend xác minh vé thuộc chuyến, còn hiệu lực và chưa được soát.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| POST | `/tickets/check-in` | Xác thực và đánh dấu vé đã soát. | Chưa có. |
| GET | `/tickets/:ticketId/validation` | Kiểm tra trước khi xác nhận soát; có thể gộp vào kết quả POST. | Đề xuất. |

#### Quản trị gửi hàng (#09)

API nghiệp vụ cho Admin nhà xe/điều hành. API theo dõi và tạo đơn của Customer nằm ở mục 3.3.

| Method | Endpoint | Mục đích Admin | Trạng thái |
| --- | --- | --- | --- |
| GET | `/shipment-branches` | Danh sách bưu cục. | Chưa có. |
| POST | `/shipment-branches` | Tạo bưu cục. | Chưa có. |
| GET | `/shipment-branches/:id` | Chi tiết bưu cục. | Chưa có. |
| PATCH | `/shipment-branches/:id` | Cập nhật bưu cục. | Chưa có. |
| GET | `/shipping-rates` | Tra cứu bảng cước. | Chưa có. |
| POST | `/shipping-rates` | Tạo bảng cước. | Chưa có. |
| PATCH | `/shipping-rates/:id` | Cập nhật bảng cước. | Chưa có. |
| GET | `/cargo-types` | Tra cứu loại hàng. | Chưa có. |
| POST | `/cargo-types` | Tạo loại hàng. | Chưa có. |
| PATCH | `/cargo-types/:id` | Cập nhật loại hàng. | Chưa có. |
| PATCH | `/shipments/:id/status` | Cập nhật trạng thái và lịch sử xử lý. | Chưa có. |
| PUT | `/shipments/:id/trip` | Gán hoặc đổi chuyến vận chuyển. | Chưa có. |

Contract cần bao phủ người trả cước, hình thức nhận/giao, cách tính cước, hàng hóa/ảnh và lịch sử trạng thái.

#### Quản lý khuyến mãi (#10)

Backend phải tính và xác thực lại mã khi ghi booking/thanh toán. API kiểm tra mã Customer nằm ở mục 3.2.

| Method | Endpoint | Mục đích Admin | Trạng thái |
| --- | --- | --- | --- |
| GET | `/promotions` | Danh sách chương trình/mã. | Chưa có. |
| POST | `/promotions` | Tạo chương trình khuyến mãi. | Chưa có. |
| GET | `/promotions/:id` | Chi tiết chương trình. | Chưa có. |
| PATCH | `/promotions/:id` | Cập nhật điều kiện, giá trị và thời hạn. | Chưa có. |
| PATCH | `/promotions/:id/status` | Kích hoạt hoặc dừng chương trình. | Chưa có. |

#### Thanh toán và hoàn tiền (#11)

Tenant Admin tra cứu giao dịch và xử lý refund. Endpoint chi tiết/hóa đơn dùng chung nằm ở mục 3.3.

| Method | Endpoint | Mục đích Admin | Trạng thái |
| --- | --- | --- | --- |
| GET | `/payments` | Lọc giao dịch trong phạm vi tenant. | Chưa có. |
| POST | `/payments/:id/refund` | Yêu cầu hoàn tiền theo chính sách. | Chưa có. |

#### Báo cáo doanh thu (#12)

Tenant Admin chỉ xem nhà xe mình; Super Admin có phạm vi hệ thống.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| GET | `/reports/revenue` | Tổng hợp theo ngày/tháng/quý, tuyến và loại dịch vụ. | Chưa có. |

#### Dashboard (#13)

Client Admin đang có target URL chưa được backend mount; cần chốt contract và đồng bộ client/backend.

| Method | Endpoint | Ý nghĩa | Trạng thái |
| --- | --- | --- | --- |
| GET | `/super-admin/dashboard/overview` | URL hiện client Admin đang chờ. | Client target; backend chưa có handler. |
| GET | `/dashboard/overview` | Path đề xuất để Super Admin lấy KPI theo quyền. | Chưa có; cần chốt path. |

#### Nhân viên (#14)

Admin nhà xe quản lý hồ sơ theo tenant; liên kết tài khoản và role phải kiểm tra cùng phạm vi tenant.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| GET | `/employees` | Danh sách/tìm nhân viên. | Chưa có. |
| POST | `/employees` | Tạo hồ sơ nhân viên. | Chưa có. |
| GET | `/employees/:id` | Chi tiết nhân viên. | Chưa có. |
| PATCH | `/employees/:id` | Cập nhật hồ sơ nhân viên. | Chưa có. |
| PATCH | `/employees/:id/status` | Cập nhật trạng thái làm việc. | Chưa có. |

#### Backup và restore (#18)

Chỉ Super Admin; cần audit log và kiểm soát môi trường trước khi restore.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| GET | `/system/backups` | Xem lịch sử backup. | Chưa có. |
| POST | `/system/backups` | Tạo bản backup. | Chưa có. |
| GET | `/system/backups/:id` | Xem thông tin một bản backup. | Chưa có. |
| POST | `/system/backups/:id/restore` | Khôi phục bản backup đã chọn. | Chưa có. |

### 3.2 API dự kiến cho Customer

Nếu có app mobile, các flow này cũng gọi cùng /api/v1; không tạo API hoặc business logic riêng cho mobile.

#### Đặt vé và giữ ghế

API đọc lịch sử booking/vé của Customer đã có trong [Danh-Muc-API-Da-Co.md](Danh-Muc-API-Da-Co.md); API đó được mở rộng cho Admin tại mục 3.3. Route tạo booking, giữ ghế và hủy/đổi còn thiếu.

| Method | Endpoint | Mục đích Customer | Trạng thái |
| --- | --- | --- | --- |
| POST | `/trips/:tripId/seat-holds` | Giữ các ghế đã chọn trong thời hạn ngắn. | Chưa có. |
| DELETE | `/seat-holds/:holdId` | Chủ động giải phóng ghế đã giữ. | Chưa có. |
| POST | `/bookings` | Tạo booking sau khi giữ ghế thành công. | Chưa có. |

Hủy/đổi booking xem tại mục 3.3. Backend phải giữ ghế atomic trước khi tạo booking/vé, đồng thời xử lý TTL, retry và concurrency.

#### Đặt lại mật khẩu Customer

Use Case/Class Diagram có OTP quên mật khẩu; auth API hiện mới có OTP đăng ký.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| POST | `/auth/password/reset/request-otp` | Gửi OTP đặt lại mật khẩu. | Chưa có. |
| POST | `/auth/password/reset/verify-otp` | Xác minh OTP đặt lại mật khẩu. | Chưa có. |
| POST | `/auth/password/reset` | Đặt mật khẩu mới. | Chưa có. |

Cần giới hạn lượt gửi OTP, thời hạn mã và chống lạm dụng.

#### Khuyến mãi khi checkout

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| POST | `/promotions/validate` | Kiểm tra mã áp dụng cho checkout. | Chưa có. |

#### Tạo thanh toán

Customer khởi tạo thanh toán; xem giao dịch và hóa đơn theo tài khoản qua endpoint dùng chung tại mục 3.3.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| POST | `/payments` | Khởi tạo thanh toán cho booking/đơn hàng. | Chưa có. |

#### Gửi hàng Customer

Customer tạo và theo dõi đơn của mình. Các endpoint dùng chung được liệt kê một lần tại mục 3.3; backend giới hạn dữ liệu theo Customer hoặc tenant Admin.

#### Thông báo, đánh giá, gợi ý và chatbot

Các use case này có trong System Use Case nhưng chưa thấy backend/service tương ứng.

| Method | Endpoint | Mục đích | Trạng thái |
| --- | --- | --- | --- |
| GET | `/notifications` | Xem thông báo của mình. | Chưa có. |
| PATCH | `/notifications/:id/read` | Đánh dấu một thông báo đã đọc. | Chưa có. |
| POST | `/reviews` | Gửi đánh giá dịch vụ đã sử dụng. | Chưa có. |
| GET | `/trips/:tripId/alternatives` | Gợi ý chuyến thay thế. | Chưa có. |
| POST | `/support/assistant/messages` | Gửi tin nhắn tới chatbot AI. | Chưa có. |

Đánh giá cần kiểm tra khách đã hoàn tất dịch vụ; thông báo chủ động cần kênh push/realtime; chatbot AI cần tách khỏi hội thoại CSKH.

### 3.3 API dự kiến dùng chung cho Admin và Customer

Các endpoint bên dưới dùng cùng method/path cho hai nhóm. Backend kiểm tra chủ sở hữu, role và tenant; không tạo endpoint bản sao theo client.

#### Booking và vé

Các route đọc hiện có trả dữ liệu Customer sở hữu. Khi mở rộng Admin, giữ nguyên path và thêm kiểm tra tenant; hủy/đổi dùng cùng endpoint với quyền theo vai trò.

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| GET | `/bookings` | Customer xem booking của mình; Admin tra cứu booking thuộc tenant. | Customer đã có; cần mở rộng quyền Admin. |
| GET | `/bookings/:bookingId` | Customer xem booking của mình; Admin xem booking trong tenant. | Customer đã có; cần mở rộng quyền Admin. |
| GET | `/tickets` | Customer xem vé của mình; Admin tra cứu vé thuộc tenant. | Customer đã có; cần mở rộng quyền Admin. |
| GET | `/tickets/:ticketId` | Customer xem vé của mình; Admin xem vé trong tenant. | Customer đã có; cần mở rộng quyền Admin. |
| POST | `/bookings/:bookingId/cancel` | Customer tự hủy theo chính sách; Admin hỗ trợ theo permission. | Chưa có. |
| POST | `/bookings/:bookingId/change` | Customer yêu cầu đổi; Admin hỗ trợ theo chính sách. | Chưa có. |

#### Thanh toán và hóa đơn

Customer xem giao dịch/hóa đơn của mình; Admin tra cứu theo tenant. Callback provider được tách ở mục 3.4.

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| GET | `/payments/:id` | Customer xem giao dịch của mình; Admin xem theo tenant. | Chưa có. |
| GET | `/invoices` | Customer xem hóa đơn của mình; Admin tra cứu theo tenant. | Chưa có. |
| GET | `/invoices/:id` | Customer/Admin xem hóa đơn theo quyền. | Chưa có. |

#### Theo dõi đơn gửi hàng

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| GET | `/shipments` | Customer xem đơn của mình; Admin tra cứu trong tenant. | Chưa có. |
| GET | `/shipments/:id` | Customer xem đơn của mình; Admin xem trong tenant. | Chưa có. |
| POST | `/shipments` | Customer tạo đơn; Admin có thể lập đơn tại quầy theo permission. | Chưa có. |
| POST | `/shipments/:id/items` | Customer/Admin thêm hàng theo trạng thái đơn và permission. | Chưa có. |

#### Chat hỗ trợ realtime (#17)

Customer chỉ truy cập hội thoại của mình; CSKH theo permission và tenant. Form liên hệ hiện tại là luồng một chiều.

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| GET | `/support/conversations` | Customer xem hội thoại của mình; CSKH xem hàng chờ được phép. | Chưa có. |
| POST | `/support/conversations` | Customer mở hội thoại hỗ trợ. | Chưa có. |
| GET | `/support/conversations/:id/messages` | Đọc lịch sử trong hội thoại được phép. | Chưa có. |
| POST | `/support/conversations/:id/messages` | Customer/CSKH gửi tin nhắn theo quyền. | Chưa có. |
| PATCH | `/support/conversations/:id/read` | Đánh dấu hội thoại đã đọc. | Chưa có. |

Chuyển đổi ngôn ngữ Việt–Anh có trong đề cương và Use Case. Nếu bản dịch là nội dung giao diện, nên quản lý ở Web/Mobile client bằng resource locale; chưa có căn cứ trong source để bắt buộc tạo REST API cho việc đổi ngôn ngữ.

### 3.4 API dự kiến cho hệ thống hoặc đối tác

Các endpoint này không do Customer/Admin gọi trực tiếp trong luồng thông thường: backend phát hành vé theo nghiệp vụ booking và nhà cung cấp thanh toán gọi webhook.

#### Phát hành vé theo flow booking

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| POST | `/bookings/:bookingId/tickets` | Backend phát hành vé khi booking/thanh toán hợp lệ. | Chưa có; xử lý nội bộ theo flow. |

#### Webhook thanh toán

| Method | Endpoint | Phạm vi | Trạng thái |
| --- | --- | --- | --- |
| POST | `/payments/webhooks/:provider` | Provider gửi callback trạng thái giao dịch. | Chưa có. |

Webhook phải xác minh chữ ký/trạng thái từ provider, xử lý idempotent và không giữ DB transaction khi chờ network.

## 4. Hợp đồng API dùng chung và kiểm soát nghiệp vụ

- Thành công: resource đơn theo `{ "data": ... }`; danh sách phân trang theo `{ "data": [...], "meta": { "page", "pageSize", "totalItems", "totalPages" } }`.
- Query convention: `page`, `pageSize`, `search`, `sortBy`, `sortDirection`; filter nghiệp vụ bổ sung theo feature.
- Lỗi validation: `VALIDATION_ERROR` với `details` gồm `field` và `message`; lỗi nghiệp vụ dùng status/error code ổn định (ví dụ ghế vừa được người khác giữ thì `409 SEAT_UNAVAILABLE`).
- Quyền Customer/Admin/Super Admin phải được backend xác minh trên từng resource; Admin nhà xe luôn bị giới hạn tenant. API chung không đồng nghĩa quyền đọc/ghi giống nhau.
- Đặt/giữ ghế, booking, phát vé, thanh toán, refund và các thao tác ghi nhiều bảng cần transaction/atomic update phù hợp; callback/ retry thanh toán cần idempotency và xác thực phía provider.
- Timestamp dùng ISO 8601 có `Z` hoặc offset; ngày không có giờ dùng `YYYY-MM-DD`. Không dùng floating-point làm nguồn tính tiền nghiệp vụ.

Các quy ước này lấy từ `AGENTS.md` gốc của repository và source `configure-api.ts`; phần endpoint đề xuất phía trên chưa thay thế việc chốt contract method/query/body/response/error/permission cho từng feature trước khi code.

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
