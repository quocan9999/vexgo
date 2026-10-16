# R2 — Handoff hợp nhất Booking Backend

## Kết luận

- Đã chuẩn hóa backend booking theo một contract duy nhất: `POST /api/v1/bookings`, `tripId`, `seatIds` là `gheChuyenXeId`, `holdToken`, `contact`, `pickupPoint`, `dropoffPoint` và `cargoItems?` đã được validate.
- Booking chỉ tiêu thụ hold có token hợp lệ và record `GiuCho` đang `DANG_GIU`; kiểm tra chuyến, khách, hạn dùng và chính xác tập ghế, sau đó CAS chuyển hold sang `DA_DAT` trong transaction booking. Không còn nhánh đặt ghế `TRONG`, đổi `gheId`, dùng `seatNumbers` hoặc fallback khi thiếu bảng/record hold.
- Guest Booking được giữ theo quyết định của chủ dự án. `DonGiaoDich.khachHangId` nullable; tên, số điện thoại và email được lưu thành snapshot liên hệ. Không tìm tài khoản theo số điện thoại, không tạo `TaiKhoan`/`KhachHang` giả và không liên kết booking guest vào khách hàng hiện có.
- Lịch sử booking/vé của khách đăng nhập lọc theo `khachHangId`; guest record không xuất hiện trong history và truy cập chi tiết history qua endpoint dành cho tài khoản trả 403. `GET /api/v1/bookings/:bookingId/detail` yêu cầu đúng principal khi đơn gắn với tài khoản; guest detail vẫn dùng đường public hiện tại.

## So sánh và quyết định implementation

| Năng lực | Develop trước merge | Sony trước merge | Kết quả R2 |
| --- | --- | --- | --- |
| DTO/entry point | Contract principal-first, dùng `seatIds` | Overload nhiều shape, `seatNumbers`/`passenger` và guest | Một DTO chuẩn; dùng ID ghế chuyến, contact snapshot và token bắt buộc |
| Giữ ghế | Gọi consume hold trong transaction | Có nhánh thiếu hold và cập nhật ghế không qua hold | Dùng `SeatHoldsService`, xác minh DB và CAS; không có đường fallback |
| Guest | Phụ thuộc hồ sơ khách đăng nhập | Tự dò/tạo tài khoản và khách hàng theo số điện thoại | Giữ guest với foreign key nullable theo quyết định của chủ dự án |
| Hàng đi kèm vé | Không có phần mở rộng tương đương | Có `cargoItems` và persistence phiếu gửi/hàng hóa | Giữ DTO và persistence hiện hữu; không hợp nhất thuật toán giá/capacity của R6–R8 |

`POST /api/v1/bookings` trả `{ data: { bookingId, bookingCode, orderId, orderCode, tripId, status, contact, pickupPoint, dropoffPoint, seats, seatIds, ticketCount, tickets, ticketSubtotal, shippingFee, totalAmount, shipment, createdAt } }` theo interceptor/envelope hiện có. Lỗi thiếu hold bị DTO pipe trả `400 VALIDATION_ERROR`; hold giả/hết hạn/đã consume trả lỗi conflict, sai ownership trả `403 HOLD_OWNERSHIP_MISMATCH`.

## Files thay đổi

- `apps/api/src/bookings/bookings.controller.ts`: inject principal optional vào endpoint chi tiết booking.
- `apps/api/src/bookings/bookings.service.ts`: bỏ overload/alias, yêu cầu hold và ghế thuộc hold; xác định khách chỉ từ principal; lưu guest bằng quan hệ null; giới hạn endpoint chi tiết đơn thuộc tài khoản; ghi history guest bằng nguồn `SYSTEM` với `taiKhoanId = NULL` đúng CHECK constraint.
- `apps/api/src/bookings/dto/create-booking.dto.ts`: chốt DTO, bắt buộc liên hệ/điểm đón-trả/token, từ chối seat ID trùng và không còn DTO alias.
- `apps/api/src/seat-holds/seat-holds.service.ts`: xác minh owner khớp cả guest/authenticated; bắt buộc record DB active, TTL/chuyến/ghế khớp và CAS; xóa nhánh fallback không có `GiuCho`.
- `apps/api/src/tickets/tickets.service.ts`: kiểm tra quyền vé an toàn khi đơn guest không có quan hệ khách hàng.
- `prisma/schema.prisma` và `prisma/migrations/20261014170000_allow_guest_bookings_without_customer_account/migration.sql`: chỉ `DonGiaoDich.khachHangId` chuyển nullable, giữ nguyên FK và dữ liệu cũ.
- `apps/api/test/unit/bookings/create-booking.dto.spec.ts`, `apps/api/test/unit/bookings/bookings.service.spec.ts`, `apps/api/test/unit/seat-holds/seat-holds.service.spec.ts`, `apps/api/test/unit/tickets/tickets.service.spec.ts`: regression cho DTO, guest isolation, ownership, store/record thiếu, hold inactive/expired và CAS.
- `apps/api/test/integration/bookings/booking-status-history.spec.ts`: HTTP/MySQL regression cho guest không bị auto-link theo phone, history guest không gắn tài khoản, principal ownership, token giả, alias/duplicate, concurrency, rollback và đọc detail theo owner.
- Không sửa code Customer Web/Admin. ZIP `PR36_R2_R9_PHASE_SPECS.zip` được giữ nguyên, không đưa vào commit.

## Callers và tương thích

- Trong repository, Customer Web one-way và round-trip vẫn gửi `seatNumbers`, `passenger`, không gửi `holdToken`; `apps/web/src/features/account/services/bookings.api.ts` cũng còn kiểu payload cũ. Chúng phải được chuyển sang canonical hold + DTO trong R3; hiện chưa thể kết luận checkout Web chạy end-to-end.
- Customer Web gọi `GET /bookings/:bookingId/detail` không gửi Authorization. Đơn tài khoản cần bearer token sau thay đổi này; sửa caller tại R3. Guest detail vẫn có thể đọc bằng ID như luồng hiện tại.
- Không thấy caller booking tương ứng trong Admin hoặc Mobile trong source đã kiểm tra. Client Mobile/ngoài repository chưa được xác minh.
- API detail có kiểm tra owner, nhưng `POST /api/v1/bookings/:bookingId/confirm-payment` vẫn là endpoint public hiện hữu và vẫn có thể trả dữ liệu booking sau khi chạy nhánh confirm. Đây là vấn đề payment/settlement ngoài R2; không được xem R2 là đã xử lý finding đó.

## Kiểm thử và xác minh

- Prisma schema validate: **PASS**.
- Prisma Client generate: **PASS**; client chỉ được sinh từ schema, không chỉnh sửa thủ công.
- API unit target: **PASS — 4 files, 53 tests**.
- Booking service unit target: **PASS — 1 file, 13 tests**.
- MySQL booking integration target: **PASS — 1 file, 8 tests**; xác nhận cả history booking và vé của guest dùng `SYSTEM`/`taiKhoanId = NULL`.
- API typecheck: **PASS**.
- API lint (`npm run lint`): **PASS**.
- Guest booking integration ban đầu phát hiện service ghi `HE_THONG`, trái với CHECK constraint chỉ chấp nhận `CUSTOMER`/`STAFF`/`SYSTEM`; service đã đổi sang `SYSTEM`, và regression test DB kiểm chứng giá trị cùng `taiKhoanId = NULL`.
- Migration nullable đã deploy **chỉ** vào MySQL worktree `vexgo_pr36`; Prisma báo 25 migrations và schema up to date. Không reset/seed DB.
- `git diff --check`: **PASS** tại lần kiểm tra gần nhất.
- GitNexus index không có entry cho worktree này; các index trùng tên trỏ sang checkout khác, nên không dùng graph làm bằng chứng. Đã rà soát callers bằng source trong worktree.

## Postman smoke checklist

Chỉ chạy trên DB riêng `vexgo_pr36` đã áp dụng migration. Dùng base URL local đang cấu hình, ví dụ `http://localhost:4002/api/v1`.

1. `GET /trips/{tripId}/seats`; chọn một hoặc nhiều `gheChuyenXeId` ở trạng thái `TRONG`.
2. Guest: `POST /seat-holds` với `{ "tripId": 123, "seatIds": [456] }`; lưu `data.holdToken` và xác nhận ghế chuyển `DANG_GIU`.
3. Guest: `POST /bookings` với `tripId`, đúng `seatIds`, `holdToken`, `contact`, `pickupPoint`, `dropoffPoint`; xác nhận response có booking/order/ticket ID, DB lưu `DonGiaoDich.khachHangId = NULL` cùng snapshot liên hệ, hold `DA_DAT` và ghế `DA_DAT`.
4. Lặp request với token giả: phải bị từ chối, không tăng order/ticket và không đổi ghế/hold.
5. Giữ ghế khi đăng nhập Customer A, gửi cùng token khi không có principal hoặc dưới Customer B: phải bị từ chối và hold vẫn của A.
6. Chạy hai `POST /bookings` đồng thời với cùng token: tối đa một request thành công; chỉ có một order và một vé cho một ghế.
7. Với đơn gắn Customer A, gọi `GET /bookings/{bookingId}/detail` không token hoặc dưới Customer B: 403; dưới A: 200. Lịch sử account không chứa guest booking dù phone guest trùng phone A.
8. Xác nhận payload chỉ dùng `seatIds`; `seatNumbers`/seat ID trùng phải bị validation từ chối.

Các bước Postman chưa được chạy thủ công; integration tests đã chạy qua HTTP thật với MySQL worktree.

## Blockers và việc còn lại

- Không còn DB blocker cho R2 integration: migration và target HTTP/MySQL integration đã chạy trên `vexgo_pr36`. Postman smoke vẫn chờ chủ dự án tự kiểm tra.
- **R3:** cập nhật one-way/round-trip Web sang hold token, `seatIds`, DTO liên hệ và gửi access token khi đọc detail đơn tài khoản.
- **Security còn tồn tại:** endpoint public confirm-payment có thể thay đổi trạng thái và lộ response booking; không xử lý trong R2 theo giới hạn task. Cần chặn/đặc tả trong phase payment trước rollout.
- **Guest detail:** public detail guest vẫn dựa trên `bookingId`, chưa có claim/OTP; không tạo flow đó trong R2 theo quyết định của chủ dự án. Nếu cần bảo vệ PII guest trước người biết ID, cần task/decision riêng.
- **Cargo:** DTO/persistence được giữ; tính đúng của giá/capacity và thống nhất với shipment độc lập thuộc R6–R8.
- Không push, không tạo PR, không resolve review conversations. R3 là bước tiếp theo sau khi R2 được chủ dự án chấp thuận.
