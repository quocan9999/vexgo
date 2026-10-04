# Customer API Endpoint Plan — VexGo

> Phạm vi tài liệu: **API backend dùng chung cho Customer Web và Customer Mobile**.  
> Không mô tả API quản trị Admin trong tài liệu này.  
> Nguồn phạm vi hiện tại: `De-Cuong-Chi-Tiet.md`, `SUC_Chot_DeDacTa.mdl`, `Class_Diagram_Thiet_Ke_Final_Updated_v2.mdl`, `AGENTS.md`.

## 1. Mục tiêu

- Customer Web và Customer Mobile **dùng chung một backend, một database, một business rule và một API contract**.
- Không tạo `/web/*`, `/mobile/*`, `/customer-web/*`, `/customer-mobile/*` chỉ vì khác nền tảng.
- Hệ thống là mô hình **nhiều nhà xe** tương tự sàn đặt vé: tìm kiếm mặc định có thể trả chuyến của nhiều nhà xe; `busCompanyId` chỉ là filter khi cần.
- Hai thành viên cùng viết backend nhưng chia theo **bounded context/module**, không chia nửa controller/service trong cùng một module, nhằm giảm conflict Git.
- Mỗi người đồng thời làm UI/UX cho nền tảng mình phụ trách và có thể tích hợp ngay các API thuộc phần backend mình sở hữu. Các API của người còn lại phải được thống nhất contract trước để không phải chờ nhau mới dựng UI.

## 2. Quy ước chung dùng trong file này

- Base URL: `/api/v1`.
- URL tiếng Anh, resource-oriented, dùng kebab-case khi cần.
- Không tách endpoint theo Admin/Customer nếu cùng resource và cùng business use case; authorization quyết định dữ liệu/quyền được phép thao tác.
- Response đơn:

```json
{ "data": {} }
```

- Response danh sách phân trang:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

- Query list chuẩn: `page`, `pageSize`, `search`, `sortBy`, `sortDirection`.
- Timestamp: ISO 8601 có timezone/offset; date-only: `YYYY-MM-DD`.
- Mọi giá tiền do backend tính và xác thực lại; client không phải nguồn sự thật cho giá, khuyến mãi, ghế trống, phí gửi hàng hay trạng thái giao dịch.

## 3. Phân chia ownership backend cho 2 thành viên

### Bạn A — phụ trách Customer Web + Backend nhóm Discovery & Engagement

**Module sở hữu:**

- `auth/`
- `customers/`
- `bus-companies/` — customer read APIs
- `routes/` — customer read APIs
- `trips/` — search/detail/alternative trips, **không sở hữu seat mutation**
- `reviews/`
- `support-chat/`
- `notifications/`
- `content/` nếu triển khai trang nội dung động
- `chatbot/` nếu team quyết định làm use case Chatbot AI mở rộng

**Không sửa trực tiếp module do Bạn B sở hữu.** Nếu cần dữ liệu booking/payment/ticket/shipment thì gọi service public/exported của module B hoặc dùng API contract đã thống nhất ở frontend.

### Bạn B — phụ trách Customer Mobile + Backend nhóm Commerce & Fulfillment

**Module sở hữu:**

- `seat-holds/` hoặc phần seat reservation nằm trong `bookings/`
- `bookings/`
- `promotions/`
- `payments/`
- `tickets/`
- `invoices/`
- `shipments/`
- `branch-offices/`
- `cargo-types/`
- phần tra cứu bảng cước/quote gửi hàng

**Không sửa trực tiếp module do Bạn A sở hữu.** Khi booking cần kiểm tra chuyến xe, dùng interface/service đọc do `trips` export thay vì tự tạo logic chuyến xe thứ hai.

### Vì sao chia như trên

- Một người sở hữu toàn bộ **tìm kiếm/khám phá/khách hàng/tương tác**; người còn lại sở hữu toàn bộ **giao dịch/tiền/vé/gửi hàng**.
- `GheChuyenXe` có mutation giữ/đặt/giải phóng ghế chỉ do **Bạn B** sở hữu để tránh hai người cùng sửa logic concurrency.
- `ThanhToan`, `DonGiaoDich`, `KhuyenMai`, `PhieuDatVe`, `Ve`, `PhieuGuiHang` tập trung ở Bạn B để các transaction nghiệp vụ không bị chia đôi.
- `TaiKhoan`, `KhachHang`, `ChuyenXe`, `TuyenXe`, `NhaXe` phần đọc/customer-facing tập trung ở Bạn A để không tạo API tìm kiếm trùng.

## 4. Mức ưu tiên

- **HIGH — Ưu tiên cao:** phải có trước để demo được flow tìm chuyến → chọn ghế → đặt vé → thanh toán.
- **MEDIUM — Ưu tiên trung bình:** nằm trong nhóm chức năng người dùng của đề cương và cần hoàn thành cho khóa luận.
- **LOW — Ưu tiên thấp:** có trong System Use Case hiện tại hoặc giúp hoàn thiện sản phẩm nhưng có thể làm sau HIGH/MEDIUM.
- **TBD:** cần chốt thêm business rule/schema trước khi code để tránh làm sai rồi sửa lớn.

---

# 5. Endpoint catalog

## 5.1 Authentication — owner: Bạn A

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | POST | `/api/v1/auth/register/request-otp` | Public | Gửi OTP đăng ký theo số điện thoại/email đã chốt. |
| HIGH | POST | `/api/v1/auth/register/verify-otp` | Public | Xác thực OTP trước khi hoàn tất đăng ký. |
| HIGH | POST | `/api/v1/auth/register` | Public | Tạo tài khoản khách hàng. Body tối thiểu: thông tin định danh/liên hệ + mật khẩu + proof OTP. |
| HIGH | POST | `/api/v1/auth/login` | Public | Đăng nhập bằng `{ phoneNumber, password }` (Customer/Mobile) hoặc `{ identifier, password }` với số điện thoại/email (Admin); trả access token và refresh theo transport đã chọn. |
| HIGH | POST | `/api/v1/auth/refresh` | Refresh credential | Customer/Mobile gửi refresh token trong body; Admin Web gửi HttpOnly cookie để xoay refresh token và nhận access token mới. |
| HIGH | POST | `/api/v1/auth/logout` | Refresh credential | Customer/Mobile gửi refresh token trong body; Admin Web gửi HttpOnly cookie; thu hồi session hiện tại. |
| HIGH | GET | `/api/v1/auth/session` | Bearer access token | Đọc identity và role/tenant hiện hành từ backend để khôi phục Admin session. |
| MEDIUM | POST | `/api/v1/auth/forgot-password/request-otp` | Public | Gửi OTP quên mật khẩu. |
| MEDIUM | POST | `/api/v1/auth/forgot-password/verify-otp` | Public | Xác thực OTP reset password. |
| MEDIUM | POST | `/api/v1/auth/forgot-password/reset` | Public | Đặt mật khẩu mới bằng reset token/proof hợp lệ. |

**Không tạo API login riêng cho web và mobile.** Hai client dùng cùng contract.

---

## 5.2 Customer account/profile — owner: Bạn A

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | GET | `/api/v1/me` | Customer | Lấy hồ sơ tài khoản + thông tin khách hàng hiện tại. |
| MEDIUM | PATCH | `/api/v1/me` | Customer | Cập nhật họ tên, ngày sinh, CCCD/email/số điện thoại theo rule xác thực. |
| MEDIUM | PATCH | `/api/v1/me/password` | Customer | Đổi mật khẩu khi đã đăng nhập. |
| MEDIUM | GET | `/api/v1/me/transactions` | Customer | Lịch sử giao dịch của chính khách hàng, phân trang/filter theo loại/trạng thái. |

> Backend bắt buộc suy ra customer từ token; client không được truyền `customerId` để truy cập dữ liệu cá nhân của người khác.

---

## 5.3 Bus companies, routes, trips — owner: Bạn A

### Nhà xe

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | GET | `/api/v1/bus-companies` | Public | Danh sách nhà xe đang hoạt động; dùng cho filter/search. |
| HIGH | GET | `/api/v1/bus-companies/:busCompanyId` | Public | Chi tiết nhà xe. |

### Tuyến xe

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | GET | `/api/v1/routes` | Public | Filter tối thiểu: `from`, `to`, `busCompanyId`, `status`; phân trang nếu dữ liệu lớn. |
| MEDIUM | GET | `/api/v1/routes/:routeId` | Public | Chi tiết tuyến. |

Route write/read contract dùng `durationMinutes` là số phút nguyên dương. Backend
lưu vào `TuyenXe.thoiGianChayPhut`; khi tạo hoặc cập nhật chuyến, `gioDen` được
suy ra từ `departureTime + durationMinutes`. Migration chỉ backfill `gioDen` cho
những tuyến hiện hữu đã có thời lượng đáng tin cậy.

### Chuyến xe

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | GET | `/api/v1/trips/search` | Public | Tìm chuyến nhiều nhà xe. Query chính: `from`, `to`, `departureDate`, `busCompanyId`, `vehicleTypeId`, `minPrice`, `maxPrice`, `page`, `pageSize`, `sortBy`, `sortDirection`. |
| HIGH | GET | `/api/v1/trips/:tripId` | Public | Chi tiết chuyến: nhà xe, tuyến, giờ đi, xe/loại xe, giá niêm yết hiện hành, trạng thái. |
| LOW | GET | `/api/v1/trips/:tripId/alternatives` | Public | Gợi ý chuyến thay thế theo System Use Case hiện tại; dùng khi chuyến hết chỗ/đổi vé/chuyến bị hủy. |

**Quy tắc multi-company:** nếu không truyền `busCompanyId`, search phải có khả năng trả kết quả của nhiều nhà xe; không hard-code một nhà xe cụ thể.

---

## 5.4 Seat availability & reservation — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | GET | `/api/v1/trips/:tripId/seats` | Public | Sơ đồ ghế của chuyến + trạng thái hiện tại + giá nếu có biến thể theo ghế. |
| HIGH (TBD) | POST | `/api/v1/seat-holds` | Customer hoặc guest-session | Giữ một hoặc nhiều `seatIds` cho một `tripId`, trả `holdToken`, `expiresAt`. |
| HIGH (TBD) | DELETE | `/api/v1/seat-holds/:holdToken` | Chủ hold | Chủ động giải phóng hold khi bỏ chọn/hủy checkout. |

### Gap bắt buộc xử lý trước khi code seat hold

Class diagram hiện có `GheChuyenXe.trangThai = TRONG | DANG_GIU | DA_DAT` và hành vi `giuGhe/giaiPhongGhe`, nhưng **chưa thể hiện rõ ai đang giữ ghế và giữ đến khi nào**. Nếu triển khai hold tạm thời, schema cần bổ sung một trong hai hướng:

1. Entity `SeatHold` riêng có `holdToken`, owner/session, `expiresAt`, trip/seat; hoặc
2. Bổ sung thông tin hold tương đương vào `GheChuyenXe`.

Không được chỉ đổi `TRONG → DANG_GIU` mà không có owner/expiry vì sẽ tạo ghế bị treo và khó xử lý concurrency.

---

## 5.5 Booking — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | POST | `/api/v1/bookings/quote` | Public/Customer | Backend tính preview: giá vé, số lượng ghế, khuyến mãi hợp lệ, tổng tiền. Không ghi booking. |
| HIGH | POST | `/api/v1/bookings` | Customer; guest checkout nếu team chốt hỗ trợ | Tạo `PhieuDatVe` + `Ve` trong transaction; re-check trip/seat/price/promotion; gắn hold nếu có. |
| HIGH | GET | `/api/v1/bookings/:bookingId` | Owner | Chi tiết booking + tickets + payment summary. |
| MEDIUM | GET | `/api/v1/bookings` | Customer | Danh sách booking của chính khách hàng; filter `status`, date range. |
| MEDIUM | POST | `/api/v1/bookings/:bookingId/cancel` | Owner | Hủy toàn booking khi rule cho phép; backend quyết định refund/fee. |

### Request chính khi tạo booking

Client chỉ gửi các lựa chọn cần thiết, ví dụ:

```json
{
  "tripId": 123,
  "seatIds": [10, 11],
  "pickupPoint": "...",
  "promotionCode": "SUMMER26",
  "contact": {
    "fullName": "...",
    "phone": "...",
    "email": "..."
  },
  "holdToken": "optional"
}
```

**Client không gửi `unitPrice`, `discountAmount`, `totalAmount`, `finalPrice` như nguồn sự thật.** Backend tự tính lại.

---

## 5.6 Promotions — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | GET | `/api/v1/promotions` | Public/Customer | Danh sách khuyến mãi customer có thể xem; filter `scope=BOOKING|SHIPMENT`, `busCompanyId`. |
| HIGH | POST | `/api/v1/promotions/validate` | Public/Customer | Kiểm tra code/khuyến mãi với context; trả mức giảm preview + reason nếu không hợp lệ. |

> Việc `validate` chỉ để UX. Khi tạo booking/shipment, backend **phải validate lại** khuyến mãi trong transaction/flow nghiệp vụ tương ứng.

---

## 5.7 Payment — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| HIGH | POST | `/api/v1/payments` | Owner của order | Tạo giao dịch online cho `orderId`/`DonGiaoDich`; provider: `MOMO`, `VNPAY`, `ZALOPAY`; trả redirect/deeplink/payment URL theo provider. |
| HIGH | GET | `/api/v1/payments/:paymentId` | Owner | Chi tiết payment. |
| HIGH | GET | `/api/v1/payments/:paymentId/status` | Owner | Poll trạng thái sau redirect/deeplink hoặc khi app resume. |

### Provider callback/webhook — không gọi trực tiếp từ Customer UI nhưng bắt buộc cho flow

| Priority | Method | Endpoint | Caller | Mục đích |
|---|---|---|---|---|
| HIGH | POST | `/api/v1/payments/momo/webhook` | MoMo | Verify signature + idempotency + cập nhật payment/order. |
| HIGH | POST | `/api/v1/payments/vnpay/webhook` | VNPAY | Verify signature + idempotency + cập nhật payment/order. |
| HIGH | POST | `/api/v1/payments/zalopay/webhook` | ZaloPay | Verify signature + idempotency + cập nhật payment/order. |

**Không có customer endpoint `refund` trực tiếp.** Refund phát sinh từ use case hủy/đổi vé hoặc nghiệp vụ khác và do backend điều phối.

---

## 5.8 Tickets — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | GET | `/api/v1/tickets` | Customer | Danh sách vé của chính khách hàng. |
| MEDIUM | GET | `/api/v1/tickets/:ticketId` | Owner | Chi tiết vé. |
| MEDIUM | GET | `/api/v1/tickets/lookup` | Public | Tra cứu bằng `ticketCode` + thông tin xác minh như phone; không lộ vé của người khác. |
| MEDIUM | POST | `/api/v1/tickets/:ticketId/cancel` | Owner | Hủy một vé khi booking có nhiều vé và rule cho phép. |
| LOW | POST | `/api/v1/tickets/:ticketId/exchange/quote` | Owner | Tính chênh lệch/điều kiện đổi vé sang chuyến/ghế mới. |
| LOW | POST | `/api/v1/tickets/:ticketId/exchange` | Owner | Đổi vé; transaction cập nhật ghế/vé/payment chênh lệch nếu có. |

> `Soát vé` thuộc nhân viên/nhà xe, không phải Customer API nên không đưa vào scope file này.

---

## 5.9 Invoices — owner: Bạn B

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | GET | `/api/v1/invoices` | Customer | Danh sách hóa đơn thuộc giao dịch của customer. |
| MEDIUM | GET | `/api/v1/invoices/:invoiceId` | Owner | Chi tiết hóa đơn. |
| MEDIUM | GET | `/api/v1/invoices/lookup` | Public | Tra cứu `invoiceCode` + thông tin xác minh phù hợp. |

> Class diagram hiện mô tả dữ liệu hóa đơn nhưng chưa mô tả file PDF/e-invoice provider. Chỉ thêm endpoint download/xuất PDF khi team chốt cơ chế tạo tài liệu hóa đơn.

---

## 5.10 Shipment / gửi hàng hóa — owner: Bạn B

### Dữ liệu tham chiếu

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | GET | `/api/v1/branch-offices` | Public | Danh sách bưu cục; filter `busCompanyId`, tỉnh/thành, trạng thái. |
| MEDIUM | GET | `/api/v1/cargo-types` | Public | Danh sách loại hàng hóa đang hoạt động. |

### Quote + shipment

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | POST | `/api/v1/shipments/quote` | Public/Customer | Backend tính `cuocChinh`, `phiDichVu`, discount, `tongPhi` từ bưu cục, khối lượng/kích thước, hình thức lấy/giao, promo. |
| MEDIUM | POST | `/api/v1/shipments` | Customer; guest nếu team chốt hỗ trợ | Tạo `PhieuGuiHang` + `HangHoa` trong transaction; revalidate rate/promo. |
| MEDIUM | GET | `/api/v1/shipments` | Customer | Danh sách phiếu gửi của chính customer. |
| MEDIUM | GET | `/api/v1/shipments/:shipmentId` | Owner | Chi tiết phiếu gửi + hàng hóa + trạng thái hiện tại. |
| MEDIUM | GET | `/api/v1/shipments/lookup` | Public | Tra cứu bằng `trackingCode` + phone/xác minh phù hợp. |
| MEDIUM | POST | `/api/v1/shipments/:shipmentId/cancel` | Owner | Hủy nếu trạng thái cho phép. |
| LOW | POST | `/api/v1/shipments/:shipmentId/items/:itemId/images` | Owner | Upload hình ảnh hàng hóa nếu chức năng này được dùng trong UI. |

### Lưu ý dữ liệu tracking

Class diagram hiện chỉ có **trạng thái hiện tại** của `PhieuGuiHang`, chưa thấy entity lịch sử trạng thái. Vì vậy chưa nên hứa UI timeline tracking nhiều mốc cho đến khi bổ sung `ShipmentStatusHistory` hoặc cấu trúc tương đương.

---

## 5.11 Realtime customer support chat — owner: Bạn A

### REST baseline

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| MEDIUM | GET | `/api/v1/support/messages` | Customer | Lịch sử chat của customer, phân trang theo cursor/page. |
| MEDIUM | POST | `/api/v1/support/messages` | Customer | Gửi và persist tin nhắn; server broadcast realtime. |
| MEDIUM | PATCH | `/api/v1/support/messages/:messageId/read` | Customer | Đánh dấu tin nhận được là đã đọc nếu model hỗ trợ. |

### WebSocket events đề xuất

Namespace/channel: `/support`

| Event | Direction | Ý nghĩa |
|---|---|---|
| `support.message.send` | Client → Server | Gửi tin realtime nếu chọn WS làm write path. |
| `support.message.new` | Server → Client | Tin mới từ nhân viên CSKH. |
| `support.message.read` | 2 chiều | Đồng bộ trạng thái đã đọc. |
| `support.connected` | Server → Client | Xác nhận socket/auth thành công. |

### Gap bắt buộc xử lý trước khi code chat 2 chiều

`TinNhanHoTro` hiện có nội dung, thời gian, trạng thái, khách hàng nhưng **chưa thể hiện đầy đủ người gửi là customer hay nhân viên, conversation/session nào**. Chat realtime 2 chiều nên bổ sung tối thiểu:

- sender identity/type;
- conversation/support session hoặc quy ước 1 conversation/customer có thể truy xuất rõ ràng;
- id tin nhắn client-generated hoặc idempotency key nếu cần chống gửi trùng.

Nếu không bổ sung, frontend khó phân biệt bubble bên gửi/bên nhận và backend khó quản lý nhiều phiên hỗ trợ.

---

## 5.12 Notifications — owner: Bạn A

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| LOW | GET | `/api/v1/notifications` | Customer | Danh sách thông báo của customer. |
| LOW | GET | `/api/v1/notifications/unread-count` | Customer | Số thông báo chưa đọc. |
| LOW | PATCH | `/api/v1/notifications/:notificationId/read` | Customer | Đánh dấu một thông báo đã đọc. |
| LOW | PATCH | `/api/v1/notifications/read-all` | Customer | Đánh dấu toàn bộ đã đọc. |

> Push notification thực tế (FCM/APNs/Web Push) sẽ cần cơ chế đăng ký device token/subscription; chưa thấy entity device token trong class diagram hiện tại, nên để sang thiết kế mở rộng nếu team muốn push ngoài ứng dụng.

---

## 5.13 Reviews / feedback — owner: Bạn A

| Priority | Method | Endpoint | Auth | Mục đích / dữ liệu chính |
|---|---|---|---|---|
| LOW | GET | `/api/v1/reviews` | Public | Xem đánh giá; filter `tripId`, `busCompanyId` nếu có thể suy từ trip, `shipmentId`, rating. |
| LOW | POST | `/api/v1/reviews` | Customer | Đánh giá chuyến xe hoặc dịch vụ gửi hàng; backend kiểm tra customer đã sử dụng dịch vụ. |
| LOW | PATCH | `/api/v1/reviews/:reviewId` | Owner | Sửa nội dung/mức đánh giá nếu business rule cho phép. |
| LOW | GET | `/api/v1/me/reviews` | Customer | Danh sách đánh giá của chính customer. |

Không tạo review giả chỉ bằng `tripId`; backend phải xác minh booking/ticket/shipment thuộc customer.

---

## 5.14 Dynamic content — owner: Bạn A, optional

Class diagram hiện có `TrangNoiDung`, `PhienBanTrangNoiDung`, `TepDinhKem`. Nếu Customer Web/Mobile có trang điều khoản, chính sách, hướng dẫn được quản lý động thì dùng:

| Priority | Method | Endpoint | Auth | Mục đích |
|---|---|---|---|---|
| LOW | GET | `/api/v1/content-pages/:slug` | Public | Lấy phiên bản nội dung đang hiệu lực của slug. |

Nếu toàn bộ nội dung là static frontend thì **không cần tạo API này**.

---

## 5.15 Chuyển đổi ngôn ngữ Việt – Anh

**Không cần endpoint `/language` chỉ để đổi ngôn ngữ giao diện.**

Ở scope hiện tại nên xử lý bằng i18n trên Web/Mobile:

- label/menu/button/form validation phía client lấy từ translation resources;
- backend trả **error code ổn định** để client map sang câu tiếng Việt/Anh;
- dữ liệu nghiệp vụ như tên nhà xe, tuyến xe, địa chỉ không tự động dịch nếu database không có dữ liệu song ngữ.

Nếu sau này `TrangNoiDung` cần song ngữ thì phải bổ sung field/model locale trước, không tự giả định trong API hiện tại.

---

## 5.16 Chatbot AI — owner: Bạn A, LOW optional

System Use Case hiện có `Chatbot AI hỗ trợ`, nhưng class diagram hiện chưa mô tả model/domain tương ứng và đây không phải yêu cầu cốt lõi trong đề cương ban đầu.

Chỉ triển khai sau HIGH/MEDIUM. Contract tối thiểu có thể là:

| Priority | Method | Endpoint | Auth | Mục đích |
|---|---|---|---|---|
| LOW | POST | `/api/v1/chatbot/messages` | Public/Customer | Nhận câu hỏi + context được phép, trả câu trả lời hỗ trợ. |

Không để chatbot trực tiếp xác nhận giá, ghế trống, hủy/đổi vé hay trạng thái thanh toán nếu không gọi lại các service nghiệp vụ nguồn sự thật.

---

# 6. Các flow frontend cần được unblock bằng contract này

## Flow 1 — Tìm và đặt vé (HIGH)

```text
GET  /trips/search
GET  /trips/:id
GET  /trips/:id/seats
POST /seat-holds                (nếu dùng hold)
POST /bookings/quote
POST /bookings
POST /payments
GET  /payments/:id/status
GET  /bookings/:id
```

**Backend ownership:** A làm search/trip; B làm seat/booking/payment.  
Hai người có thể code song song nếu thống nhất response của `GET /trips/:id` và identifier `tripId` từ đầu.

## Flow 2 — Quản lý vé (MEDIUM/LOW)

```text
GET  /tickets
GET  /tickets/:id
GET  /tickets/lookup
POST /tickets/cancel
POST /tickets/:id/exchange/quote   (LOW)
POST /tickets/:id/exchange         (LOW)
```

`GET /tickets/lookup` trả thêm `data.cancellation` gồm `eligible`, `reason`,
`cancelFeeRate`, `cancelFee` và `refundAmount`. Backend tính báo giá theo thời
điểm hiện tại: dưới 12 tiếng không được hủy; từ 12 đến hết 24 tiếng phí 20%;
trên 24 tiếng phí 10%.

`POST /tickets/cancel` nhận `ticketCode` và `phoneNumber`. Khi thành công,
backend hủy vé và giải phóng ghế trong transaction, đồng thời tạo giao dịch
`HOAN_TIEN` ở trạng thái `DANG_XU_LY`; response chỉ xác nhận yêu cầu hoàn tiền
đã được ghi nhận, không khẳng định tiền đã hoàn tất.

Sau khi transaction commit, refund processor gửi yêu cầu tới
`REFUND_PROVIDER_URL` với idempotency key ổn định theo `thanhToanId`. Record
`DANG_XU_LY` là hàng đợi bền vững và được quét lại định kỳ; request thành công
chuyển sang `THANH_CONG`, lỗi mạng/provider được trả lại `DANG_XU_LY` để retry.
Không cấu hình provider thì API giữ refund ở trạng thái pending và ghi cảnh báo.

## Flow 3 — Tra cứu hóa đơn (MEDIUM)

```text
GET /invoices
GET /invoices/:id
GET /invoices/lookup
```

## Flow 4 — Gửi hàng (MEDIUM)

```text
GET  /branch-offices
GET  /cargo-types
POST /shipments/quote
POST /shipments
POST /payments                 (nếu thanh toán online)
GET  /shipments/:id
GET  /shipments/lookup
```

## Flow 5 — CSKH realtime (MEDIUM)

```text
GET  /support/messages
POST /support/messages
WS   /support
```

## Flow 6 — Tài khoản cá nhân (HIGH/MEDIUM)

```text
POST  /auth/login
GET   /me
PATCH /me
GET   /me/transactions
POST  /auth/logout
```

---

# 7. Contract giữa hai backend developer để tránh conflict

## 7.1 Bạn A phải export/read contract cho Bạn B

`trips` cần cung cấp service method tương đương (tên implementation có thể khác):

```ts
getTripForBooking(tripId: number)
```

Kết quả phải đủ để Booking xác minh:

- trip tồn tại;
- trip còn bookable;
- route/busCompany/vehicle liên quan;
- departure date/time;
- price source/bảng giá cần dùng.

Bạn B **không copy** logic tìm chuyến hoặc tự tạo `customer-trips.service.ts` thứ hai.

## 7.2 Bạn B sở hữu toàn bộ seat mutation

Bạn A có thể cần hiển thị thông tin ghế trên Web nhưng không được tự thêm logic `giuGhe`, `giaiPhongGhe`, `DA_DAT` trong module trips.

`GET /trips/:tripId/seats` và các thao tác hold/reserve do Bạn B chịu trách nhiệm contract/backend.

## 7.3 Payment chỉ có một owner

Booking và Shipment đều sử dụng `payments` của Bạn B. Không tạo `booking-payments` và `shipment-payments` với logic provider trùng nhau.

## 7.4 Promotion chỉ có một owner

Booking/Shipment truyền context vào `promotions` service. Không copy công thức giảm giá vào `bookings.service.ts`, `shipments.service.ts`, Web hoặc Mobile.

## 7.5 Auth/customer chỉ có một owner

Bạn B lấy current customer từ auth guard/decorator/shared auth contract; không tự tạo auth strategy thứ hai trong module commerce.

---

# 8. Những quyết định phải chốt trước khi implementation HIGH

1. **Có cho guest booking không?**  
   Class `DonGiaoDich` có snapshot tên/số điện thoại/email và quan hệ khách hàng, nhưng tài liệu hiện tại chưa đủ để khẳng định guest checkout. Nếu không chốt, endpoint `POST /bookings` mặc định yêu cầu Customer auth.

2. **Seat hold timeout bao lâu và lưu ở đâu?**  
   Class diagram hiện thiếu owner/expiry của hold. Đây là gap cần sửa trước khi code.

3. **Một booking có được hủy từng vé hay chỉ hủy cả booking?**  
   Model hiện có cả `PhieuDatVe.huyDatVe()` và `Ve.huyVe()`, vì vậy API đang chừa cả hai use case; business rule cần chốt rõ.

4. **Đổi vé có cho phép đổi nhà xe khác không?**  
   Với mô hình nhiều nhà xe, mặc định an toàn nên coi đây là rule cần xác định, không tự cho phép cross-company exchange.

5. **Payment return/deeplink cho Web và Mobile.**  
   Cùng endpoint tạo payment nhưng `returnUrl/deepLink` phải được whitelist/validate, không để client truyền arbitrary redirect URL.

6. **Chat 2 chiều cần bổ sung sender/conversation.**  
   Không nên code realtime hoàn chỉnh trước khi sửa gap model này.

---

# 9. Thứ tự triển khai để hai người không chờ nhau

### Sprint A — contract freeze + foundation

- Chốt DTO/response cho: auth, trip search/detail, seats, booking quote/create, payment create/status.
- Mỗi owner tạo module/controller/service/DTO skeleton của phần mình.
- Web và Mobile dựng service layer theo contract, có thể tạm dùng fixture **chỉ trong UI**.

### Sprint B — HIGH chạy end-to-end

- Bạn A: auth + trip search/detail.
- Bạn B: seat availability/hold + booking + payment sandbox.
- Cả hai client tích hợp flow tìm chuyến → đặt vé → thanh toán bằng API thật.

### Sprint C — MEDIUM

- Bạn A: profile + support chat.
- Bạn B: ticket + invoice + shipment + promotion hoàn chỉnh.
- Cả Web/Mobile tích hợp các API còn lại theo cùng contract.

### Sprint D — LOW

- Notifications, reviews, đổi vé, chuyến thay thế, chatbot AI, content động nếu còn thời gian và schema/business rule đã chốt.

---

# 10. Definition of Done cho một endpoint Customer

Một endpoint chỉ được đánh dấu hoàn thành khi:

- đúng method/path/DTO đã thống nhất;
- có validation backend;
- authorization/data scope đúng customer;
- service chứa business rule, controller mỏng;
- Prisma/MySQL là nguồn dữ liệu thật;
- transaction/concurrency/idempotency được xử lý khi liên quan;
- success/error response theo convention;
- có test cho happy path và negative/edge case quan trọng;
- Web hoặc Mobile service layer gọi được API thật;
- không còn fixture/mock là nguồn dữ liệu chính của flow hoàn chỉnh.

---

# 11. Tóm tắt ownership nhanh

| Domain | Bạn A — Web | Bạn B — Mobile |
|---|:---:|:---:|
| Auth / Customer profile | ✅ | |
| Bus companies / Routes / Trips search | ✅ | |
| Seat availability / hold / reserve | | ✅ |
| Booking | | ✅ |
| Promotions | | ✅ |
| Payments | | ✅ |
| Tickets / cancel / exchange | | ✅ |
| Invoices | | ✅ |
| Shipment / cargo / branch / rate | | ✅ |
| Support chat realtime | ✅ | |
| Notifications | ✅ | |
| Reviews | ✅ | |
| Content pages | ✅ | |
| Chatbot AI (optional) | ✅ | |
| Customer Web UI/UX | ✅ | |
| Customer Mobile UI/UX | | ✅ |

**Nguyên tắc quan trọng:** ownership chỉ nói **ai chịu trách nhiệm code backend module**, không có nghĩa API chỉ dành cho platform của người đó. **Cả Web và Mobile đều được dùng toàn bộ Customer API.**
