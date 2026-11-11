# R3 — Bàn giao Customer Web Booking một chiều

## Kết quả

R3 đã nối luồng đặt vé một chiều của Customer Web với contract backend R2. Luồng dùng `tripSeatId` làm `seatIds`, tạo giữ ghế trước khi tạo booking, và chỉ chuyển sang trang thanh toán khi backend trả về booking/order đã lưu cùng số tiền từ server.

Guest booking vẫn được phép. Request guest không gửi bearer token và không tìm/liên kết `KhachHang` theo số điện thoại. Request của tài khoản dùng bearer token; khi API từ chối request đã xác thực, frontend không thử lại dưới danh tính guest.

Luồng khứ hồi hiện thông báo chưa khả dụng và không gọi API tạo booking, không sinh mã giả, không tạo payment draft.

## Contract frontend đang dùng

| Bước | Request | Dữ liệu chính | Kết quả dùng ở frontend |
| --- | --- | --- | --- |
| Đọc sơ đồ ghế | `GET /api/v1/trips/:tripId/seats` | `tripSeatId`, `seatNumber`, `status` từ API | Chỉ cho chọn ghế `TRONG`; không gửi số ghế thay ID |
| Giữ ghế | `POST /api/v1/seat-holds` | `{ tripId, seatIds }`, trong đó `seatIds` là `gheChuyenXeId` | Kiểm tra `holdToken`, `tripId`, tập `seatIds`, `expiresAt` từ backend |
| Tạo booking | `POST /api/v1/bookings` | `{ tripId, seatIds, holdToken, contact, pickupPoint, dropoffPoint, cargoItems? }` | Chỉ dùng response có booking/order ID và code hợp lệ để tạo payment draft |
| Nhả hold | `DELETE /api/v1/seat-holds` | Header `X-Hold-Token` | Gọi best-effort khi hold chưa được booking consume; TTL backend vẫn là authority |
| Đọc đơn của tài khoản | `GET /api/v1/bookings/:bookingId/detail` | Bearer token qua auth session | Payment và invoice gửi token khi tài khoản đăng nhập; guest tiếp tục đọc theo luồng public hiện có |

Không đặt hold token trong URL, log hoặc analytics. Không thêm `Idempotency-Key`, guest session, API mới, hoặc thay đổi Backend.

## Hành vi và giới hạn

- Hold chỉ được tạo sau khi khách bấm tiếp tục đặt vé; request tạo hold và tạo booking được khóa chống gửi chồng.
- Nếu hold trả 409, UI hiển thị lỗi và tải lại sơ đồ ghế; không gọi `POST /bookings`.
- Nếu hold hết hạn trước khi booking, frontend thử nhả token rồi yêu cầu chọn lại; không gửi booking bằng hold đã hết hạn.
- Nếu đổi chuyến khi tạo hold còn chờ, frontend không mở một lần submit khác; khi response cũ đến, hold cũ được nhả và không tạo booking cho chuyến cũ.
- Nếu booking bị từ chối 4xx, frontend nhả hold. Nếu không xác nhận được việc nhả, hoặc kết quả request là network/5xx/malformed success, UI khóa gửi lại và báo kết quả chưa xác định; không tạo ID giả, không tự nhả hold có thể đã được booking consume.
- Khi booking response hợp lệ, draft dùng `bookingId`, `orderId`, code và `totalAmount` từ backend. Giá giao diện chỉ còn là preview.
- Luồng thanh toán, VietQR, xác nhận/settlement, giá và capacity cargo không được thay đổi trong R3.

## Files thay đổi

- `apps/web/src/features/account/services/bookings.api.ts` — thêm typed DTO/response cho seat hold và booking canonical; thêm API create/release hold; hỗ trợ bearer token khi đọc detail.
- `apps/web/src/features/booking/components/one-way-booking.tsx` — chuyển sang hold → booking, kiểm tra response, refresh ghế khi conflict, xử lý trạng thái chưa xác định và cleanup hold.
- `apps/web/src/features/booking/components/round-trip-booking.tsx` — gỡ nhánh tạo booking/payment draft giả và khóa CTA khứ hồi bằng trạng thái rõ ràng.
- `apps/web/src/features/booking/services/payment-draft.ts` — lưu `orderId` đã được backend cấp.
- `apps/web/src/features/payments/components/payment-page.tsx` — gửi access token khi đọc chi tiết đơn thuộc tài khoản; logic confirm/settlement giữ nguyên.
- `apps/web/src/features/payments/components/invoice-page.tsx` — gửi access token khi đọc chi tiết đơn thuộc tài khoản.
- `apps/web/test/unit/booking/one-way-booking-flow.spec.tsx` — regression component/API-boundary cho flow một chiều, lỗi, cleanup, auth và round-trip bị khóa.
- `apps/web/test/unit/payments/payment-page.spec.tsx` — kiểm tra đọc trạng thái đơn tài khoản có bearer token.
- `apps/web/package.json` — đưa component regression của booking vào script `test` hiện có.

Không sửa Backend, schema, migration, database, `.env`, `.env.example` hoặc `.env.local`.

## Kiểm thử

- `npm --workspace @vexgo/web test`: **PASS** — 103 Node unit tests và 21 Vitest component tests.
- `npm --workspace @vexgo/web run typecheck`: **PASS** — `next typegen` và `tsc --noEmit`.
- ESLint các file Web liên quan: **PASS, 0 errors**; có 11 warnings sẵn có trong payment/invoice/round-trip code (unused imports/state, `<img>`, callback unused).
- `git diff --check`: **PASS**.
- Kiểm tra caller source: chỉ one-way còn gọi `bookingsApi.createBooking`; không còn payload `seatNumbers` trong luồng đó; payment và invoice đều gửi bearer token khi đã đăng nhập.
- Không có `.codegraph/` trong worktree. GitNexus chỉ có index của checkout khác (`SourceCode/vexgo`, branch `feature/booking-ticket-status-history`, sau HEAD worktree này), nên không dùng index đó; đã đối chiếu callers trực tiếp trong source hiện tại.
- Chưa chạy browser smoke, request thật qua Network, hoặc booking DB-backed. Không ghi PASS cho các bước này; chưa ghi dữ liệu nghiệp vụ mới vào DB worktree.

## Checklist smoke test thủ công

### Customer Web

1. Chạy Customer Web bằng cấu hình local của worktree (`3004`) và API local (`4002`); không thay file env thật.
2. Tìm chuyến chưa khởi hành, mở Network, chọn ghế trống.
3. Bấm thanh toán một chiều. Xác nhận `POST /api/v1/seat-holds` gửi `tripId` cùng `seatIds` lấy từ `tripSeatId`, không gửi `seatNumber`.
4. Xác nhận response hold có cùng `tripId`, đúng tập `seatIds`, `holdToken` và `expiresAt` hợp lệ.
5. Xác nhận tiếp theo `POST /api/v1/bookings` gửi đúng token, cùng tập ghế, `contact`, `pickupPoint` và `dropoffPoint`. So sánh booking/order IDs, codes và `totalAmount` với payment draft.
6. Đăng nhập Customer rồi lặp flow: request hold/booking có bearer token. Với guest, request không có bearer token; kiểm tra booking guest có contact snapshot và `khachHangId = NULL`, không tự link tài khoản trùng phone.
7. Mở một session khác giữ cùng ghế trước: session hiện tại phải nhận conflict, tải lại sơ đồ và không gọi create booking.
8. Kiểm tra response hold hết hạn, đổi chuyến khi hold request còn pending, API 401/403/500 và mất mạng: không tạo mã giả hoặc gửi lặp mù quáng; hold cũ được nhả khi có thể xác nhận.
9. Mở flow khứ hồi: thấy cảnh báo chưa khả dụng; CTA disabled; không có request `POST /bookings` và không có payment draft.
10. Trên viewport hẹp và bàn phím, kiểm tra vùng lỗi/trạng thái đọc được, ghế và CTA giữ focus ring, không tràn ngang.

### Postman API

1. `GET http://localhost:4002/api/v1/trips/{tripId}/seats`; chọn `tripSeatId` có trạng thái `TRONG`.
2. Guest: `POST /api/v1/seat-holds` với `Content-Type: application/json` và body `{ "tripId": 123, "seatIds": [456] }`. Không gửi `Authorization`; lưu `data.holdToken` chỉ trong Postman environment tạm.
3. Dùng một ghế kiểm thử khác tạo hold thứ hai, sau đó gọi `DELETE /api/v1/seat-holds` với header `X-Hold-Token: <holdToken>`; xác nhận ghế trở lại `TRONG`.
4. Tạo hold mới rồi gọi `POST /api/v1/bookings` cùng `tripId`, `seatIds`, `holdToken`, `contact: { "fullName": "Khách kiểm thử", "phone": "0900000000" }`, `pickupPoint`, `dropoffPoint`. Xác nhận response có booking/order IDs và amount từ backend.
5. Xác nhận hold được consume (`DA_DAT`) và ghế không thể được giữ lần hai. Không dùng request confirm-payment trong smoke R3.
6. Gửi hold token giả, token đã hết hạn, sai `tripId` hoặc tập ghế khác; API phải từ chối. Giữ một ghế ở session khác để xác minh cạnh tranh trả 409.
7. Với Customer đã đăng nhập, thêm `Authorization: Bearer <access-token>` cho hold/booking và `GET /api/v1/bookings/{bookingId}/detail`; guest không gửi bearer. Không chia sẻ token trong report/log.

Chỉ chạy các bước tạo booking trên DB test riêng `vexgo_pr36` và dữ liệu được chủ dự án cho phép; không chạy migration/seed/reset để phục vụ smoke.

## Việc ngoài R3 còn tồn tại

- Manual browser và DB-backed smoke vẫn chờ chạy trên worktree; đây là bước xác minh chủ dự án có thể thực hiện theo checklist trên.
- Khi kết quả booking hoặc nhả hold không xác định, UI hiện yêu cầu kiểm tra lịch sử/hỗ trợ và khóa gửi lại. R3 không có API tra cứu attempt để tự khôi phục trạng thái.
- Payment settlement, confirm-payment/webhook, VietQR và các finding R4/R5 vẫn chưa được xử lý.
- Một số fallback dữ liệu hóa đơn/payment cũ nằm ngoài flow tạo booking một chiều; cần xử lý trong phase payment riêng, không xem là đã xác nhận thanh toán thật.
- Guest detail public theo `bookingId` và các rủi ro ownership/payment đã ghi trong R2 vẫn là việc riêng, không thuộc R3.

## Trạng thái nghiệm thu

- Code, regression tests, typecheck và lint: **PASS**.
- Browser UI smoke và booking DB-backed: **DEFERRED** — chưa chạy trong lượt này.
- Payment settlement/VietQR, khứ hồi thật: **OUT OF SCOPE**.
- R4 chưa bắt đầu. Chờ chủ dự án kiểm tra smoke và review R3.
