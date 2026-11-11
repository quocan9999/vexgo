# R8 — Handoff tích hợp Cargo với Booking và Shipment độc lập

## Kết quả

R8 hoàn tất. Hai API tiếp tục là hai use case riêng: `POST /api/v1/bookings` tạo vé và có thể kèm shipment; `POST /api/v1/shipments` tạo shipment độc lập, không phát sinh booking hay vé. Cả hai dùng cùng `ShipmentPersistenceService.persistInTransaction(tx, input)` để tạo `PhieuGuiHang`, `HangHoa`, `ChiTietCuocGuiHang` và lịch sử trạng thái ban đầu bằng transaction client do caller cấp.

Không thay schema, migration, endpoint, DTO, Customer Web hoặc Admin. Transaction booking vẫn bao trùm order/payment, booking, vé, consume hold, cập nhật ghế và cargo. Shipment độc lập vẫn có transaction riêng, dùng chung pricing/capacity/point resolver R6/R7.

## Policy và mapping đã xác nhận

- Booking có cargo dùng chung `DonGiaoDich` và một payment attempt của booking. Tổng order gồm tiền vé sau giảm giá cộng cước cargo; không tạo order/payment thứ hai cho shipment đính kèm.
- Shipment độc lập tạo order riêng chỉ cho cargo, không có `PhieuDatVe`, `Ve` hoặc payment mới trong R8.
- Guest shipment lưu snapshot tên, số điện thoại và email trong order nhưng `DonGiaoDich.khachHangId = null`. Số điện thoại khai báo trùng tài khoản không xác minh quyền sở hữu và không được dùng để gắn Customer.
- Request có principal chỉ liên kết Customer theo `taiKhoanId` đã xác thực; history cargo ghi `taiKhoanId` của principal hoặc `null` cho guest.
- Hai flow dùng chung snapshot giá theo loại hàng, item quantities/dimensions, điểm gửi/nhận, nhóm capacity và trạng thái đầu `MOI_TAO`. Chờ thanh toán vẫn giữ capacity theo policy R7; không đổi state machine.
- Mã order/waybill shipment độc lập giữ cấu trúc prefix + loại + timestamp, thay `COUNT()+1` bằng 25 ký tự hex ngẫu nhiên; giới hạn prefix 8 ký tự để mã không quá 50 ký tự. Ràng buộc unique DB hiện có là lớp bảo vệ cuối.

## Files thuộc R8

- `apps/api/src/shipments/shipment-persistence.service.ts` — core ghi shipment/items/fee snapshot/history qua transaction client.
- `apps/api/src/shipments/shipment-codes.ts` — tạo mã order và waybill riêng có suffix ngẫu nhiên.
- `apps/api/src/shipments/shipments.service.ts` — dùng core chung, bỏ tự liên kết guest bằng phone, bỏ mã `COUNT()+1`.
- `apps/api/src/shipments/shipments.module.ts` — đăng ký và export persistence service.
- `apps/api/src/bookings/bookings.service.ts` — gọi persistence service trong transaction booking, dùng cùng order và fail-closed nếu thiếu điểm.
- `apps/api/src/bookings/bookings.module.ts` — import `ShipmentsModule` để dùng core.
- `apps/api/test/unit/shipments/shipment-persistence.service.spec.ts` — kiểm tra các bản ghi chung được ghi qua tx caller và lỗi được truyền lên.
- `apps/api/test/unit/shipments/shipment-codes.spec.ts` — kiểm tra định dạng, giới hạn chiều dài, fallback prefix và tính khác nhau của mã.
- `apps/api/test/unit/shipments/shipments.service.spec.ts` — kiểm tra guest order không liên kết Customer, không tra phone/tạo account và caller gửi đúng dữ liệu cho core.
- `apps/api/test/unit/bookings/bookings.service.spec.ts` — kiểm tra mapping item/rate/order booking vào core.
- `apps/api/test/integration/bookings/booking-status-history.spec.ts` — kiểm tra hai flow trên MySQL, guest phone trùng tài khoản, payer/order/history và rollback thật sau khi core đã ghi cargo.
- `docs/pr36-reconciliation/fix-conflict/handoff/R8_FINAL_HANDOFF.md` — handoff phase.

Thay đổi có sẵn của người dùng trong `README.md` và `docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md` được giữ nguyên, không thuộc commit R8.

## API và callers sau sửa

- `POST /api/v1/bookings`: Customer Web booking tiếp tục gửi `cargoItems`, `senderPointId`, `receiverPointId`; order của booking bao gồm phí cargo và shipment tham chiếu cùng order đó.
- `POST /api/v1/shipments`: Customer Web gửi hàng tiếp tục dùng DTO cũ; endpoint tạo order cargo riêng. Khi guest, order không tham chiếu Customer.
- `POST /api/v1/shipments/lookup`, categories, route points, capacity và các API đọc shipment/Admin giữ nguyên contract. Không đổi caller frontend/Admin.

## Kiểm thử và self-review

- PASS — 4 unit-test files liên quan: 38 tests.
- PASS — `booking-status-history.spec.ts` trên MySQL `vexgo_pr36`: 23 tests; có hai API instance cho các bài kiểm tra race.
- PASS — `admin-customers.spec.ts`: 37 tests, bảo toàn projection Admin và phạm vi truy cập hiện có.
- PASS — API typecheck và lint.
- PASS — Prettier cho các file mới và module wiring; `git diff --check`.
- PASS — fault injection chạy qua persistence service thật và Prisma transaction thật, sau đó ném lỗi có chủ đích; xác nhận không còn order/payment/booking/ticket/shipment/item/fee/history và hold/ghế vẫn ở trạng thái trước request.
- PASS — guest gửi hàng với phone thuộc tài khoản test vẫn có `khachHangId = null`; guest không tạo booking, vé hay payment.
- PASS — booking-attached cargo cùng `DonGiaoDich`, cùng trip, có một payment; standalone shipment có order riêng, không booking/payment.
- PASS — source audit cho thấy các lệnh ghi shipment/item/fee/history dùng chung chỉ còn trong persistence service; không còn cấp mã độc lập bằng `COUNT()+1`.
- REVIEW — GitNexus pre-edit upstream impact của hai service là LOW/exact; staged `detect_changes` xếp risk tổng HIGH và liệt kê 12 flow liên quan booking/shipment. Đã kiểm tra controller/module callers và chạy regression cho cả hai API; kết quả `scope=all` còn thấy README có sẵn của người dùng nhưng README không được stage.
- PASS — không sửa `.env`, schema, migration, payment/webhook, booking settlement hay UI.

## Postman smoke test

Chỉ dùng API local và database worktree `vexgo_pr36`; không chuyển tiền thật.

1. Chọn chuyến tương lai đang nhận hàng; lấy `tripId`, `senderPointId`, `receiverPointId`, loại hàng và bảng cước hợp lệ. Ghi lại `GET /api/v1/trips/{tripId}/cargo-capacity`.
2. Tạo ghế giữ chỗ bằng `POST /api/v1/seat-holds` với `tripId` và `seatIds`; dùng `holdToken` trả về cho `POST /api/v1/bookings` cùng contact, pickup/dropoff, hai point ID và `cargoItems` hợp lệ.
3. Kỳ vọng 201; kiểm tra `shipment.shipmentId`, `shippingFee`, `totalAmount` và order code. Gọi `POST /api/v1/shipments/lookup` với waybill code và phone người gửi để đọc lại shipment; đối chiếu trip, items, fee breakdown và history `MOI_TAO`.
4. Tạo `POST /api/v1/shipments` độc lập với cùng chuyến/points và `items`. Có thể thử guest bằng số điện thoại tài khoản thử nghiệm: order vẫn độc lập, không xuất hiện trong lịch sử Customer đó nếu chưa claim/xác minh.
5. Dùng response shipment/order code và lookup để xác nhận standalone shipment không có booking/vé; capacity tăng đúng tổng `soLuong`.
6. Gửi request với rate/point không hợp lệ hoặc quantity vượt capacity. Kỳ vọng lỗi nghiệp vụ và các bản ghi/capacity không đổi. Race giữa booking và shipment cần integration test hai API instance, không thể kết luận từ gửi Postman tuần tự.
7. Với tài khoản Admin có đúng tenant, kiểm tra `GET /api/v1/customers/{customerId}/shipments`; xác nhận kết quả không lộ dữ liệu nhà xe khác.

## Giới hạn còn lại

- **DEFERRED R8-T11:** API chưa có idempotency key bền vững cho booking hoặc shipment. Nếu server commit nhưng client mất response rồi gửi request mới, có thể tạo order/shipment mới; mã ngẫu nhiên chỉ tránh va chạm mã, không ngăn nghiệp vụ lặp. Idempotency cần phase riêng, không được triển khai trong R8.
- Không thay đổi xác thực/settlement payment, cancellation/refund, webhook, OTP/claim Customer hoặc Admin cargo UI.

## Bước tiếp theo

R8 không có blocker để tiếp tục tích hợp. Trước khi vận hành, chủ dự án smoke test các bước trên; idempotency sau commit là rủi ro cần được chốt ở phase riêng.
