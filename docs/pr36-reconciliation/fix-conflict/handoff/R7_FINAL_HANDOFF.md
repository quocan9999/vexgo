# R7 — Handoff hợp nhất sức chứa Cargo

## Kết quả

Đã hợp nhất cách tính sức chứa và chặn ghi vượt hạn mức cho hàng gửi riêng, hàng gửi kèm booking và API đọc sức chứa. Chủ dự án đã duyệt policy: đếm theo tổng `HangHoa.soLuong` của từng nhóm; `MOI_TAO`, `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN` chiếm chỗ; `DA_HUY`, `DA_GIAO` nhả chỗ. Phiếu gửi kèm booking ở trạng thái chờ thanh toán vẫn chiếm chỗ. Không cần đổi schema hoặc migration.

## Thiết kế và phạm vi

- Thêm `CargoCapacityService` dùng chung để đọc snapshot theo chuyến/nhóm, tính `total`, `used`, `remaining`, và trả `409 CARGO_CAPACITY_EXCEEDED` nếu request vượt giới hạn.
- Trong cùng transaction ghi đơn, cả `POST /api/v1/shipments` và `POST /api/v1/bookings` khi có cargo khóa hàng chuyến `ChuyenXe` bằng parameterized `SELECT ... FOR UPDATE` trước khi đọc/kiểm tra capacity. Khóa theo trip dùng chung giữa hai API instance; check và tạo dữ liệu nằm cùng transaction.
- `GET /api/v1/trips/:id/cargo-capacity` dùng cùng policy và giữ nguyên response shape. Khi trip tắt nhận hàng, API vẫn trả đủ ba nhóm với total/used/remaining bằng 0; writer từ chối tạo cargo.
- Không thay đổi công thức giá, booking seat-hold, payment, trạng thái thanh toán hoặc tồn kho ghế. Việc chuyển trạng thái shipment hợp lệ vẫn do luồng nghiệp vụ hiện có đảm nhiệm.

## Files thuộc R7

- `apps/api/src/cargo-capacity/cargo-capacity.module.ts`
- `apps/api/src/cargo-capacity/cargo-capacity.service.ts`
- `apps/api/src/trips/trips.module.ts`
- `apps/api/src/trips/trips.service.ts`
- `apps/api/src/bookings/bookings.module.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/shipments/shipments.module.ts`
- `apps/api/src/shipments/shipments.service.ts`
- `apps/api/test/unit/cargo-capacity/cargo-capacity.service.spec.ts`
- `apps/api/test/unit/trips/trips.service.spec.ts`
- `apps/api/test/unit/trips/trip-alternatives.spec.ts`
- `apps/api/test/unit/bookings/bookings.service.spec.ts`
- `apps/api/test/unit/shipments/shipments.service.spec.ts`
- `apps/api/test/integration/bookings/booking-status-history.spec.ts`
- `docs/pr36-reconciliation/fix-conflict/handoff/R7_FINAL_HANDOFF.md`

Hai thay đổi có sẵn của người dùng trong `README.md` và `docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md` được giữ nguyên, không đưa vào commit R7.

## Kiểm thử và tự rà soát

- PASS — unit tests liên quan: 5 files, 87 tests.
- PASS — MySQL integration `booking-status-history.spec.ts`: 22 tests trên database `vexgo_pr36`, không migrate/reset/seed database.
- PASS — API TypeScript typecheck.
- PASS — API lint (`oxlint --type-aware src/`). Lint target cho test files có hai warning ở dòng fixture có sẵn ngoài phần R7: optional chaining trong `bookings.service.spec.ts` và spread `MomoWebhookDto` ở đầu integration test.
- PASS — `git diff --check`.
- PASS — kiểm thử concurrency dùng hai Nest app độc lập cùng database: hai shipment tranh một đơn vị, và shipment tranh cùng booking có cargo; mỗi cuộc đua chỉ có một transaction ghi thành công. Khi booking thua, hold/booking/ticket/order được rollback.
- PASS — kiểm thử request vượt hạn mức không tạo order/shipment/item; booking nhiều nhóm vượt nhóm cuối rollback; lỗi sau capacity check rollback và cho phép retry hold; trạng thái active/terminal cập nhật đúng projection; `soLuong > 1` không bị tính thành một row.
- GitNexus detect-changes ghi nhận risk tổng thể HIGH do thay đổi các flow dùng chung; đã đối chiếu caller trong source và chạy unit/integration tests cho các entry point bị ảnh hưởng. Kết quả impact cho các tên symbol trùng có `UNKNOWN`; caller đã được xác nhận bằng text search/source (`BookingsController`, `ShipmentsController`, `TripsController` và frontend API callers).

## Postman smoke checklist

1. Dùng API đang chạy trên database worktree và một `tripId` tương lai có `nhanGuiHang=true`; kiểm tra `GET /api/v1/trips/{tripId}/cargo-capacity` để ghi lại total/used/remaining.
2. Gửi `POST /api/v1/shipments` với `tripId`, `senderPointId`, `receiverPointId`, `sender` gồm `fullName`/`phoneNumber`, `receiver` gồm `fullName`/`phoneNumber`, và `items` gồm `name`, `loaiHangHoaId`, `quantity`, `weight`. Dùng loại hàng thuộc nhóm còn chỗ. Kỳ vọng 201.
3. Gọi lại capacity endpoint; `used` tăng đúng `quantity`, `remaining` giảm tương ứng. Đặt `quantity` vượt phần còn lại và gửi lại: kỳ vọng 409 `CARGO_CAPACITY_EXCEEDED`; gọi capacity và kiểm tra không đổi.
4. Thử `POST /api/v1/bookings` có cargo: tạo hold trước qua `POST /api/v1/seat-holds` với `tripId` và `seatIds` (ID ghế chuyến), rồi gửi `tripId`, `seatIds`, `holdToken`, `contact`, `pickupPoint`, `dropoffPoint`, `senderPointId`, `receiverPointId`, `cargoItems`. Khi quá hạn mức, kỳ vọng 409 và không có đơn/vé/shipment mới; hold vẫn dùng được.
5. Trạng thái `MOI_TAO` (bao gồm chờ thanh toán) vẫn tính used; chỉ shipment được nghiệp vụ chuyển thành `DA_HUY` hoặc `DA_GIAO` mới nhả chỗ. Dùng test integration để kiểm tra cạnh tranh đồng thời giữa hai API instance; không thể xác minh race bằng gửi tuần tự trên Postman.

## Rủi ro còn lại và bước tiếp theo

- Kiểm thử status ở đây xác minh projection theo các trạng thái đã duyệt; không thay thế test riêng cho quyền và tính hợp lệ của các API transition shipment.
- Hệ thống vẫn dùng phép tổng hợp từ các row shipment hiện tại, không có counter/cache hoặc migration. Mọi writer mới trong tương lai phải dùng `CargoCapacityService.lockTrip()` trước snapshot và ghi dữ liệu trong cùng transaction.
- Không có blocker R7. Đề nghị chủ dự án smoke test và reviewer kiểm tra commit; dừng tại R7, không tự chuyển phase.
