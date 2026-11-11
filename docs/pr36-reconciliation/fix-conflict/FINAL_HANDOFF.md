# PR #36 — R1: Handoff hợp nhất luồng giữ/nhả ghế

## Phạm vi và quyết định

- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-pr36-integration`; branch `fix/pr36-integration`.
- HEAD trước R1: `283b86364eb9b79f499bd63982607d5e37756ca0`; đối chiếu với `origin/develop` tại `21e41783741c1db88040d29ac9fa590e15c1caf1`.
- Chọn `SeatHoldsController`/`SeatHoldsService` làm đường mutation duy nhất: tạo record `GiuCho`, gắn ghế bằng `giuChoId`, cấp hold token và TTL; thao tác ghế chạy trong transaction với cập nhật có điều kiện. Đây là nền có định danh và vòng đời hold rõ hơn.
- Bỏ `TripsService.holdSeats/releaseSeats` và routes lồng dưới `/trips/:id/seat-holds`: chúng giữ ghế chỉ bằng trạng thái, không có record/token ownership; release theo số ghế có thể nhả hold của người khác; kết quả cập nhật CAS không được kiểm tra.
- Không tích hợp logic mutation nào từ TripsService. Giữ nguyên sơ đồ ghế Customer, Admin seat inventory, các truy vấn/CRUD chuyến và cargo-capacity.
- Prompt yêu cầu handoff tại `docs/pr36-reconciliation/fix-conflict/FINAL_HANDOFF.md`; spec ghi đường dẫn cũ `docs/fix-conflict/FINAL_HANDOFF.md`. Handoff được đặt theo prompt hiện hành.

## File thay đổi

- `apps/api/src/trips/trips.controller.ts`: xóa POST/DELETE routes giữ ghế trùng.
- `apps/api/src/trips/trips.service.ts`: xóa hai phương thức mutation trùng.
- `apps/api/src/trips/dto/create-seat-hold.dto.ts`: xóa DTO chỉ phục vụ nested routes.
- `apps/web/src/features/trips/services/trips.api.ts`: xóa hai wrapper không có caller; giữ `getCargoCapacity`.
- `apps/api/src/seat-holds/dto/release-seat-hold.dto.ts`: cho phép body DTO vắng mặt khi client gửi token qua `X-Hold-Token`; controller vẫn trả 400 khi không có token ở cả header lẫn body.
- `apps/api/test/integration/seat-holds/seat-holds-concurrency.spec.ts`: thêm regression tests xác nhận nested POST/DELETE trả 404 và không làm đổi trạng thái hold/ghế; kiểm tra canonical release qua header và request thiếu token bị từ chối.
- `docs/pr36-reconciliation/fix-conflict/PR36_R1_SEAT_HOLD_RECONCILIATION.md`: spec R1 được force-add vì local `.git/info/exclude` bỏ qua `docs/*`; chỉ chuẩn hóa khoảng trắng cuối dòng để `git diff --check` sạch, nội dung đặc tả không đổi.
- `docs/pr36-reconciliation/fix-conflict/FINAL_HANDOFF.md`: tài liệu bàn giao này.

Thay đổi DTO release là cần thiết cho AC04: global validation trước đây yêu cầu `holdToken` trong body ngay cả khi controller có token ở header. Bản sửa chỉ làm body tùy chọn; kiểm tra token bắt buộc vẫn nằm ở controller.

## API và callers sau thay đổi

- Giữ nguyên `POST /api/v1/seat-holds` với `tripId` và `seatIds` là ID từ `gheChuyenXeId`.
- Giữ nguyên `DELETE /api/v1/seat-holds` với header `X-Hold-Token` hoặc `holdToken` trong body; alias `DELETE /api/v1/seat-holds/:holdToken` cũng không đổi.
- Xóa `POST /api/v1/trips/:id/seat-holds` và `DELETE /api/v1/trips/:id/seat-holds`; cả hai hiện trả 404 và không mutate dữ liệu.
- Giữ `GET /api/v1/trips/:id/seats`, `GET /api/v1/trips/:id/seat-inventory` và cargo-capacity. Tìm kiếm callers trong API, Web, Admin và tests không thấy runtime caller nào của hai wrapper/routes bị xóa; external/mobile clients chưa kiểm kê được.
- Customer Web booking chưa được nối vào canonical hold trong R1; không kết luận checkout end-to-end đã được xác minh.

## Kiểm thử và self-review

- TDD: hai regression tests mới thất bại trước khi xóa route (nested POST/DELETE trả 201/200 thay vì 404), sau đó pass khi triển khai.
- API unit + integration mục tiêu: **4 files, 77 tests passed** (`seat-holds.service`, `trips.service`, `seat-holds-concurrency`, `trips`). Integration dùng MySQL của worktree; không chạy migration, seed hoặc reset DB.
- API typecheck: pass.
- API lint: pass.
- Web typecheck: pass.
- Web lint cho `src/features/trips/services/trips.api.ts`: pass.
- Trước commit chạy lại `git diff --check` và kiểm tra staged diff/file list; kết quả cuối được báo trong chat cùng commit SHA và git status.
- Không chạy full test suite hoặc Postman smoke test trong task này.

## Postman smoke test cho người dùng

API local đang cấu hình port `4002`; dùng base URL `http://localhost:4002/api/v1` và dữ liệu của DB worktree `vexgo_pr36`. Chọn một chuyến chưa khởi hành có ghế trống.

1. Gửi `GET /trips/{tripId}/seats`; ghi `tripSeatId` và `seatNumber` của một ghế `TRONG`.
2. Gửi `POST /seat-holds`, `Content-Type: application/json`, body:

   ```json
   { "tripId": 123, "seatIds": [456] }
   ```

   Thay `123` bằng `tripId`, `456` bằng `tripSeatId`; lưu `holdToken` trong response.
3. Gửi lại `GET /trips/{tripId}/seats`; ghế đã chọn phải ở trạng thái `DANG_GIU`.
4. Gửi `POST /trips/{tripId}/seat-holds` với body cũ `{ "seatNumbers": ["{seatNumber}"] }`: phải trả 404.
5. Gửi `DELETE /trips/{tripId}/seat-holds` với cùng body cũ: phải trả 404; `GET /trips/{tripId}/seats` phải tiếp tục cho thấy ghế `DANG_GIU`.
6. Gửi `DELETE /seat-holds` với header `X-Hold-Token: {holdToken}`; phải thành công.
7. Gửi lại `GET /trips/{tripId}/seats`; ghế phải trở về `TRONG`.

Không chạy bước smoke trên production hoặc DB dùng chung. API có thể áp dụng envelope response hiện có; đọc token trong `data` nếu response được bọc.

## Rủi ro còn lại và bước kế tiếp

- Các vấn đề đã được audit trong `SeatHoldsService` về secret/token, xác minh trạng thái hold, ownership/fallback, hết hạn và race cleanup chưa được xử lý trong R1; cần task hardening riêng theo thứ tự đã thống nhất. R1 không khẳng định canonical service đã an toàn tuyệt đối.
- Có thể còn ghế cũ ở `DANG_GIU` nhưng không liên kết `GiuCho` do nested route trước đây; không truy vấn hay sửa dữ liệu, không chạy cleanup. Trước rollout cần kiểm tra read-only và quyết định reconciliation riêng.
- Chưa xác minh client Mobile hoặc tích hợp ngoài repository có dùng nested routes hay không; kiểm tra các caller đó trước rollout công khai.
- Booking/Web hiện chưa tích hợp vòng đời canonical hold; đề xuất task tiếp theo là đặc tả và triển khai tích hợp Booking/Web riêng sau khi chủ dự án smoke test và review R1.
- Không có blocker để hoàn thành scope R1. Commit SHA và trạng thái Git cuối được cung cấp trong phản hồi hoàn tất task.
