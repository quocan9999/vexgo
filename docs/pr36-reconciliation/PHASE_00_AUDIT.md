# Phase 0 — Audit semantic conflicts và API normalization

Ngày audit: 13-10-2026
Repository/worktree: `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-pr36-integration`
Branch: `fix/pr36-integration`
PR #36 source: `6b52356b748f3db3f42215614d8ff3db97a3ddc7`
Base mới nhất đã fetch: `origin/develop` = `21e41783741c1db88040d29ac9fa590e15c1caf1`
Merge-base: `21e41783741c1db88040d29ac9fa590e15c1caf1` (trùng base PR)
Trạng thái đầu vào: worktree sạch; không merge/rebase/reset trong audit.

## Kết luận điều hành

PR #36 bổ sung booking có cargo và shipment độc lập, nhưng đồng thời thay thế một số luồng đã có trên `origin/develop`: seat hold có token bằng thao tác đổi trạng thái ghế trực tiếp, booking bắt buộc hold bằng booking cho phép bỏ qua hold, và settlement qua provider bằng endpoint xác nhận công khai. Những thay đổi này không tương đương về invariant và không thể giữ song song.

Shipment độc lập và shipment gắn với booking là hai use case hợp lệ. Chúng có thể giữ hai entry point nhưng cần dùng chung chính sách giá, xác thực điểm gửi/nhận, capacity, trạng thái, lịch sử và persistence. `GET /customers/:id/shipments` trong Admin cũng là projection theo khách hàng và tenant, không phải bản sao của danh sách shipment toàn cục.

GitHub PR #36 có **15 review threads chưa resolve** tại thời điểm audit. Chúng được lập chỉ mục ở dưới; không resolve thread nào. Các rủi ro về xác thực SePay, amount, idempotency, settlement và bảo mật shipment được ghi nhận để lập kế hoạch riêng, không sửa trong Phase 0.

## Phạm vi và cách kiểm chứng

- Đọc source độc lập ở cả `origin/develop` SHA `21e4178` và PR HEAD SHA `6b52356`; không suy luận chỉ từ diff.
- Đọc `AGENTS.md`, `docs/nhiem-vu/rule-api.md`, `docs/nhiem-vu/rule-ui-ux.md`, `docs/nhiem-vu/endpoint-api.md`, `docs/nhiem-vu/function-uiux.md`, `apps/admin/AGENTS.md` và `apps/admin/DESIGN.md`.
- Đối chiếu controller/service/DTO, frontend services/call sites, cấu hình API prefix/response wrapper và review threads của PR.
- Repo không có `apps/mobile`; vì vậy không thể xác nhận caller mobile trong source tree này. Các mobile clients ngoài repository cần được đối chiếu trước khi đổi contract.
- GitNexus MCP được thử dùng, nhưng index hiện có thuộc repo gốc `E:/.../vexgo`, được lập ở commit `da6488d` ngày 08-10-2026 và cũ hơn base PR; truy vấn worktree PR không được nhận diện đúng. Kết quả graph không được dùng làm bằng chứng “không có caller”. Các caller bên dưới được kiểm tra lại bằng source. Không re-index để tránh thay đổi trạng thái công cụ/repo ngoài phạm vi audit.
- Không cần Context7: không có hành vi thư viện/framework chưa rõ cần xác minh; contract và source hiện tại là căn cứ.
- Không chỉnh source, test, schema, migration, database hoặc `.env` trong Phase 0.

## Semantic audit

### 1. Trip read, sơ đồ ghế và tồn kho Admin

**Use case.** Khách tra cứu chuyến và ghế khả dụng; nhân viên nhà xe xem vận hành/tồn kho theo quyền tenant.

**`origin/develop`.** `TripsController` cung cấp `GET /trips/search`, `GET /trips/:id`, `GET /trips/:id/seats`, `GET /trips/:id/alternatives`; Admin có `GET /trips/:id/operational-detail` và `GET /trips/:id/seat-inventory` (`apps/api/src/trips/trips.controller.ts:31-100`). `TripsService.getCustomerSeats()` trả seat ID, số ghế, vị trí, trạng thái và giá (`apps/api/src/trips/trips.service.ts:591-645`). Admin inventory có scope tenant và thống kê phục vụ vận hành (`:647-730`).

**PR #36.** Giữ các endpoint đọc trên, thêm `GET /trips/:id/cargo-capacity` (`apps/api/src/trips/trips.controller.ts:80-84`). Customer Web đọc seat map qua `tripsApi.getSeats()`; Admin gọi operational-detail và seat-inventory trong `apps/admin/src/features/trips/services/trip-service.ts:207-224,409-425`.

**Phân loại/đề xuất — `KEEP_DEVELOP` cho read contract; giữ capacity read của PR.** Customer seat map và Admin inventory không trùng: khác principal, scope và mục đích. `mapTrip()` trả capacity cấu hình tĩnh của chuyến (`apps/api/src/trips/trips.service.ts:341-350`), còn `getCargoCapacity()` tính used/remaining từ shipment đang tồn tại (`:591-686`); đây là hai projection khác nhau, không phải endpoint dư. Duy trì `/trips/:id/cargo-capacity` nếu UI cần số liệu live, nhưng mọi thao tác ghi shipment phải dùng cùng nguồn kiểm tra capacity và chống race.

**Kiểm thử hồi quy.** Khách chỉ đọc được dữ liệu public được phép; Admin tenant A không xem inventory của tenant B; capacity live phân biệt tổng cấu hình với đã dùng/còn lại.

### 2. Seat hold: service có token và legacy endpoint theo số ghế

**Use case.** Giữ một tập ghế có thời hạn, gắn quyền sở hữu bằng capability token; tạo booking phải chứng minh token đó và consume hold nguyên tử.

**`origin/develop`.** `POST /seat-holds` và `DELETE /seat-holds` ở `apps/api/src/seat-holds/seat-holds.controller.ts:17-53`. `SeatHoldsService.createSeatHold()` tạo signed token, TTL 10 phút, token hash và record `GiuCho`, cập nhật ghế trong transaction/CAS (`apps/api/src/seat-holds/seat-holds.service.ts:191-320`). Release xác minh token và trạng thái; `verifyHold()` so khớp trip/seat/customer/expiry; `consumeHoldInTx()` được booking dùng trong transaction (`:383+`, `:509+`, `:585+`).

**PR #36.** Thêm `POST/DELETE /trips/:id/seat-holds` (`apps/api/src/trips/trips.controller.ts:92-108`) qua `TripsService.holdSeats()`/`releaseSeats()`. Hold chỉ đổi `GheChuyenXe.trangThai`; không ghi `GiuCho`, không cấp token và không xác nhận số row cập nhật (`apps/api/src/trips/trips.service.ts:744-809`). Release lọc trip + số ghế + `DANG_GIU`, không có ownership token (`:811-828`). Web có wrapper `tripsApi.holdSeats/releaseSeats()` gọi nested route bằng `seatNumbers` (`apps/web/src/features/trips/services/trips.api.ts:127-147`), nhưng source search không tìm thấy call site thực tế.

**Phân loại/đề xuất — `REMOVE_DUPLICATE`, giữ `SeatHoldsService` của develop.** Cùng nghiệp vụ nhưng hai hợp đồng không tương thích; giữ cả hai gây bypass quyền sở hữu, expiry và race protection. Cập nhật Web để chỉ dùng resource hold đã có, truyền `tripId`/`seatIds`, nhận và giữ `holdToken`, release bằng token. Token là capability bí mật; endpoint release canonical nên nhận token qua header `X-Hold-Token` (đã hỗ trợ trên develop), tránh lộ trong URL/log. Alias `DELETE /seat-holds/:holdToken` chỉ giữ tạm trong giai đoạn client migration nếu cần.

**Caller/DB.** Chưa tìm thấy caller của hai wrapper hold trên Web; booking checkout thực tế tạo booking bằng `seatNumbers`, không hold. Seat map/booking dữ liệu DB thật; mocks có tồn tại nhưng không phải đường gọi hold.

**Regression bắt buộc.** Hai khách tranh ghế; chỉ một hold thành công; token khác không thể release; token hết hạn bị từ chối; booking thiếu/sai token bị từ chối và không ghi record; consume hold + booking đồng bộ transaction; UI unmount/retry không tạo hold trùng.

### 3. Booking core, DTO và checkout callers

**Use case.** Tạo booking cho chuyến/ghế/khách, kiểm tra giá và consume hold đã sở hữu trong cùng transaction; cargo đi kèm có thể được thêm như một phần booking nếu chính sách được xác định.

**`origin/develop`.** `POST /bookings` yêu cầu `CurrentPrincipal` (`apps/api/src/bookings/bookings.controller.ts:32-38`). `CreateBookingDto` yêu cầu trip, seat IDs, contact và `holdToken` (`apps/api/src/bookings/dto/create-booking.dto.ts:58-60`). `BookingsService.createBooking()` xác thực khách, chuyến, ghế và gọi `verifyHold` (`apps/api/src/bookings/bookings.service.ts:133-252`); trong transaction, `consumeHoldInTx()` và CAS ghế cùng với booking/ticket/payment-order (`:297-420`). Không có cargo-attached trong bản develop.

**PR #36.** Controller đổi sang `@OptionalAuth()` (`apps/api/src/bookings/bookings.controller.ts:32-40`). DTO chấp nhận nhiều hình dạng `seatIds` hoặc `seatNumbers`, `pickupPoint`/`pickup`, `contact`/`passenger`, `holdToken?` và `cargoItems?` (`apps/api/src/bookings/dto/create-booking.dto.ts:105-162`). Service hỗ trợ overload `any`; nếu thiếu hold thì fallback update ghế đang `TRONG` hoặc `DANG_GIU` (`apps/api/src/bookings/bookings.service.ts:143-278,486-498,710-750`).

**Caller.** `one-way-booking.tsx:850-875` và `round-trip-booking.tsx:1074-1084` gửi `seatNumbers`, không gửi hold token. Request có thể thành công chỉ nhờ PR fallback; với develop contract hiện tại sẽ không đáp ứng DTO/hold invariant. Không thấy UI gọi `/bookings/quote`.

**Phân loại/đề xuất — `KEEP_DEVELOP` cho booking core, `MERGE_LOGIC` cho cargo.** Hợp nhất cargo vào transaction của develop sau khi hold/token và cargo policy đã chốt; không giữ permissive DTO hoặc overload `any`. Chọn một contract chuẩn: `tripId`, `seatIds`, pickup/dropoff IDs, contact đã xác thực theo policy, `holdToken` bắt buộc, promotion/cargo có schema DTO rõ. Customer authenticated là mặc định an toàn; guest checkout chỉ mở khi có cơ chế claim/ownership tách biệt, không suy ra ownership từ số điện thoại.

**Regression bắt buộc.** Hold của A + booking của B cùng seat phải trả conflict và không ghi dữ liệu; thiếu token thất bại; seatIds ngoài trip thất bại; tạo vé, booking, cargo (nếu có), order và consume hold all-or-nothing; Web chỉ gửi một shape DTO và hiển thị lỗi API thay vì tạo kết quả giả.

### 4. Guest booking và guest shipment

**Use case.** Cho khách chưa đăng nhập đặt vé/gửi hàng là lựa chọn sản phẩm riêng, không đồng nghĩa được gắn giao dịch vào tài khoản cùng số điện thoại.

**`origin/develop`.** Booking tạo dưới `CurrentPrincipal`; không có public guest booking.

**PR #36.** Optional auth cho booking; `BookingsService` tìm tài khoản theo `contactPhone` rồi gắn `resolvedCustomerId` nếu số trùng (`apps/api/src/bookings/bookings.service.ts:552-610`). `ShipmentsService` có nhánh resolution theo số điện thoại người gửi (`apps/api/src/shipments/shipments.service.ts:224-240`).

**Phân loại/đề xuất — `NEEDS_DECISION`.** Guest là use case hợp lệ nhưng liên kết tài khoản chỉ bằng phone do caller gửi tạo ownership sai và làm lẫn lịch sử. Quyết định: phase triển khai yêu cầu đăng nhập hay hỗ trợ guest bằng danh tính riêng + mã claim/OTP rồi mới link tài khoản. Không dùng số điện thoại tự khai làm bằng chứng account ownership.

**Regression bắt buộc.** Guest khai số phone đã thuộc tài khoản không được gắn record vào tài khoản đó nếu chưa chứng minh; customer A/B xem đúng lịch sử của mình; tenant scope không đổi.

### 5. Khứ hồi và tính toàn vẹn tổng tiền

**Use case.** Khứ hồi phải tạo/giữ hai leg hoặc thể hiện rõ chỉ bán một chiều; tổng tiền và payment draft phải khớp số booking tồn tại.

**PR #36.** `round-trip-booking.tsx:1070-1099` chỉ gọi `bookingsApi.createBooking()` cho outbound, nhưng giữ cả outbound/return trong draft hiển thị từ `:1100+`; lỗi API tạo mã `VG-...`/`GD-...` giả. Không có contract multi-leg trong controller/DTO.

**`origin/develop`.** `POST /bookings` tạo booking một trip; không có round-trip aggregate endpoint.

**Phân loại/đề xuất — `NEEDS_DECISION`.** Chốt khứ hồi trong phạm vi backend: endpoint tạo itinerary gồm cả hai leg trong một transaction, hoặc checkout chỉ cho phép một leg cho đến khi có contract thật. Không cho draft cộng tiền hai chiều khi DB mới giữ một chiều.

**Regression bắt buộc.** Lỗi khi tạo leg thứ hai không để lại leg đầu/hold lửng; payment total khớp tổng order authoritative; API lỗi không tạo code/booking giả.

### 6. Booking detail công khai và xác nhận thanh toán thủ công

**Use case.** Đọc trạng thái booking có scope ownership; payment success chỉ phát sinh từ provider settlement đã được xác minh, không từ thao tác frontend.

**`origin/develop`.** Chỉ `GET /bookings` và `GET /bookings/:bookingId` có `CurrentPrincipal` (`apps/api/src/bookings/bookings.controller.ts:40-60`). Payment status có `GET /payments/:paymentId/status` với principal (`apps/api/src/payments/payments.controller.ts:66-72`). Không có public booking detail/confirm route.

**PR #36.** Thêm `GET /bookings/:bookingId/detail` và `POST /bookings/:bookingId/confirm-payment`, cả hai `@Public()` (`apps/api/src/bookings/bookings.controller.ts:64-81`). `findPublicBookingById()` nhận numeric ID và trả dữ liệu booking (service `:1218+`). `confirmBookingPayment()` đổi order, booking, ticket/shipment và ghi `ThanhToan` từ frontend route (`:1146-1215`). Web gọi detail/confirm qua `apps/web/src/features/account/services/bookings.api.ts:223-260`; `payment-page.tsx:101-141,149-219` đọc trạng thái rồi vẫn gọi confirm ở các phương thức khác.

**Phân loại/đề xuất — `REMOVE_DUPLICATE` cho confirm; `NEEDS_DECISION` cho guest read.** Public confirm trùng trách nhiệm settlement provider và vi phạm invariant “frontend không xác nhận tiền”. Xóa route và không gọi confirm từ frontend; provider callback là nguồn thay đổi paid state. Booking read dùng authenticated `GET /bookings/:id`, hoặc guest claim token được cấp an toàn nếu có quyết định hỗ trợ guest; không dùng numeric ID như quyền truy cập. Không tự chuyển booking/payment thành success.

**Regression bắt buộc.** Request public confirm không còn route/không đổi DB; customer khác không đọc booking; provider callback hợp lệ cập nhật đúng một lần; API read lỗi/booking pending không điều hướng invoice success.

### 7. Provider payment, SePay và refund

**Use case.** Tạo payment intent, đọc status, nhận callback provider, xác minh giao dịch rồi settle order một lần; cancellation/refund là workflow riêng.

**`origin/develop`.** `POST /payments` yêu cầu customer principal; `GET /payments/:id` và `GET /payments/:id/status` cũng có principal (`apps/api/src/payments/payments.controller.ts:24-50`). MoMo/VNPay/ZaloPay callback chuyển qua provider handler. `PaymentsService.confirmPaymentSuccess()` xác minh provider/amount và thực hiện transaction/CAS/idempotency với booking/tickets/order (`apps/api/src/payments/payments.service.ts:374-500`; callback handlers `:672-787`). Ticket cancel API ghi cancellation và enqueue refund; `RefundProcessorService` xử lý refund nội bộ với idempotency key, không phải REST refund endpoint (`apps/api/src/tickets/tickets.controller.ts:52-63`; `apps/api/src/payments/refund-processor.service.ts:100-140`).

**PR #36.** `POST /payments/sepay-webhook` public (`apps/api/src/payments/payments.controller.ts:100+`) đi vào nhánh SePay riêng; xác thực token không fail-closed, amount guard cho phép amount không hợp lệ, và cuối cùng gọi `BookingsService.confirmBookingPayment()` thay vì common settlement (`apps/api/src/payments/payments.controller.ts:109-119,204-220`; booking service `:1146-1215`). Review cũng ghi nhận thread dò đơn đã sửa, nhưng các vấn đề token, amount và idempotency vẫn là threads riêng chưa resolve.

**Phân loại/đề xuất — `KEEP_DEVELOP` cho common settlement; `MERGE_LOGIC` cho adapter SePay sau khi xác minh.** Không sửa trong audit. SePay phải là provider adapter; event xác minh được đưa qua common settlement path cùng idempotency/provider reference, không tái hiện cập nhật booking riêng. Không đưa confirm settlement thành route user-facing. Payment API hiện chỉ khai báo MOMO/VNPAY/ZALOPAY trong `CreatePaymentDto`; Web không gọi `POST /payments` hoặc status endpoint trong payment page hiện tại, dù API read-only đó tồn tại.

**Regression bắt buộc ở phase riêng.** Token sai/missing fail-closed; amount âm/0/NaN/khác order không settle; provider reference trùng/đồng thời chỉ settle một lần; order cancelled/expired không đánh dấu paid; refund worker retry idempotent.

### 8. Shipment độc lập so với cargo gắn booking

**Use case A — gửi hàng độc lập.** PR thêm `POST /shipments` tạo `PhieuGuiHang`, `HangHoa` và history cùng `DonGiaoDich` trong transaction (`apps/api/src/shipments/shipments.controller.ts:24-36`; `shipments.service.ts:263-380`). Customer Web form gọi create tại `apps/web/src/features/shipments/components/send-freight-page.tsx:332`.

**Use case B — cargo đi kèm booking.** PR thêm `cargoItems` trong `POST /bookings`; booking service tạo shipment/cargo/detail/history trong transaction cùng booking (`apps/api/src/bookings/bookings.service.ts:329-475,500-550,790-876`). Đây là use case khác entry point và có thể giữ.

**Conflict/đề xuất — `MERGE_LOGIC`.** Hai luồng tạo cùng shipment domain bằng hai bộ tính cước, chọn điểm và kiểm tra capacity khác nhau. Giữ hai request use cases nhưng dùng chung service/domain logic cho rate resolution, role + route validation, snapshot `ChiTietCuocGuiHang`, capacity reservation và shipment/history persistence. Chỉ một order/payment/settlement source; không nhân đôi nghiệp vụ shipment.

**Regression bắt buộc.** Cùng tuyến/loại/khối lượng cho cùng rate ở cả hai entry points; booking transaction rollback toàn bộ khi cargo fail; độc lập và attached cùng tính capacity; chạy đồng thời không vượt capacity.

### 9. Shipment rate, point, capacity và dữ liệu DB

**`origin/develop`.** Chưa có `apps/api/src/shipments` controller/service độc lập; schema đã có rate table `BangCuocGuiHang`, `ChiTietCuocGuiHang`, cargo category/item, route capacity và shipment state/history. Develop có customer/tenant-scoped Admin history API.

**PR #36.** `ShipmentsService.createShipment()` hard-code base 50.000đ + 10.000đ/kg và phụ phí theo loại; không tạo `ChiTietCuocGuiHang` (`apps/api/src/shipments/shipments.service.ts:165-199,263-362`). Chọn/fallback điểm chưa xác minh đủ route/role/operator (`:104-163`). Booking attached cargo tìm rate theo điểm + loại + weight range nhưng fallback rate cùng loại hoặc `activeRates[0]`; sau đó có fee logic hard-coded (`apps/api/src/bookings/bookings.service.ts:367-463`). Capacity shipment độc lập không có guard tương ứng; booking path đọc tổng cargo trong transaction nhưng query-then-write không tạo reservation/lock cho cạnh tranh (`bookings.service.ts:500-550`; `shipments.service.ts:263-362`). Đây là rủi ro race suy ra từ thứ tự read/write trong code, cần xác nhận bằng DB-backed concurrency test.

**Đề xuất — `MERGE_LOGIC`.** `BangCuocGuiHang` theo cặp điểm, loại hàng, bracket cân nặng và thời hạn là nguồn giá. Không fallback sang rate khác loại/bracket và không giữ phí hard-code. Xác thực cả hai điểm thuộc các điểm giao nhận hoạt động của tuyến/nhà xe với role GUI_HANG/NHAN_HANG; không chọn điểm tùy ý. Lưu đúng fee detail snapshot và đảm bảo tổng phí bằng tổng detail. Capacity check/write phải atomic/serialized cho cả hai entry points.

**Regression bắt buộc.** Không có rate/multiple matching rate/weight đúng boundary/route inactive/point sai operator phải fail trước ghi; snapshot detail khớp giá; hai request tranh capacity không vượt tổng cấu hình; transaction rollback không để order hoặc cargo mồ côi.

### 10. Shipment list/detail, lookup và Admin history

**Use case.** Customer tra cứu vận đơn bằng mã + phone; user có quyền xem shipment của mình; Admin xem shipments thuộc customer trong tenant được cấp quyền.

**`origin/develop`.** Chưa có global shipment list/detail/lookup controller trong API. Admin có `GET /customers/:customerId/shipments` (`apps/api/src/customers/admin-customers.controller.ts:86-103`), class-level tenant role/permission (`:20-23`); service lọc customer + tenant (`admin-customers.service.ts:566-620`). Đây là collection lồng trong workspace customer, không tương đương danh sách toàn hệ thống.

**PR #36.** Thêm `POST /shipments/lookup` với code + phone (`shipments.controller.ts:38-44`), phù hợp use case guest lookup; Customer Web gọi tại `send-freight-page.tsx:391` và wrapper `shipments.api.ts:145-166`. Thêm `GET /shipments/:id` và `GET /shipments` với `@OptionalAuth()` (`shipments.controller.ts:53-70`). `getShipmentDetail()` không giới hạn anonymous/customer owner; chỉ scope tenant khi tenant principal có mặt (`shipments.service.ts:557-673`). `listShipments()` có thể để điều kiện rỗng khi anonymous (`:675-775`). Web service khai báo get detail nhưng UI không thấy call site; không thấy Web/Admin caller gọi global list.

**Phân loại/đề xuất.** Giữ public `POST /shipments/lookup` vì phone nằm trong body và service đối chiếu code + normalized phone (`:430+`). Giữ shipment creation. **Không giữ public numeric `GET /shipments/:id`/global list**: yêu cầu auth + owner/tenant scope, hoặc chỉ trả detail qua lookup credential. Giữ Admin `GET /customers/:customerId/shipments` riêng có scope; không gộp thành API global.

**Regression bắt buộc.** anonymous list/detail không truy xuất PII; Customer A không đọc shipment B; tenant A không đọc shipment tenant B; lookup sai code/phone không trả detail; Admin customer shipment list buộc đúng customer và tenant.

### 11. Tickets, cancellation và invoice

**Tickets.** `TicketsController` trong develop và PR giữ `GET /tickets`, `GET /tickets/:ticketId` có auth; `POST /tickets/lookup` và `POST /tickets/cancel` là guest workflows có throttle (`apps/api/src/tickets/tickets.controller.ts:30-74`). Lookup yêu cầu mã + phone; cancellation tính quote/fee và gọi refund workflow. Đây là khác use case với owner listing, không phải endpoint trùng. `docs/nhiem-vu/endpoint-api.md:246-257` lại mô tả `/tickets/:ticketId/cancel`, không khớp controller `POST /tickets/cancel`; chuẩn hóa tài liệu/client contract trước khi thêm alias.

**Invoice.** Không thấy invoice API/controller/model độc lập trong API; hai Next route `/invoice/:id` và `/invoices/:invoiceId` là frontend route aliases. `invoice-page.tsx:80-205` dựng dữ liệu từ sessionStorage với nhiều giá trị mặc định, gồm fallback trạng thái “Đã thanh toán”; nếu thiếu storage/API, `createFallbackModel()` sinh dữ liệu demo (`:207-237`). `loadInvoice()` gọi public booking detail, rồi khi lỗi chuyển sang sessionStorage/fallback (`:239-290`). Đây không phải hóa đơn có nguồn sự thật từ server. `NEEDS_DECISION`: quyết định invoice chính thức (resource/backend + quyền đọc) hay chỉ biên nhận từ booking/payment; đến khi chốt, không coi fallback là chứng từ giao dịch.

**Regression bắt buộc.** Ticket lookup/cancel sai phone không tiết lộ dữ liệu/không hủy; refund retry không tạo refund trùng; invoice API/booking read lỗi không render “đã thanh toán” từ fallback.

### 12. Các bảng giá và vai trò Admin

`apps/admin/src/features/...fare-prices...` CRUD `BangGia` là giá vé hành khách, không phải bảng cước cargo `BangCuocGuiHang`. Không gộp hai domain vì cùng tên chung “giá”. Audit không tìm thấy giao diện Admin quản trị cargo rate trong các caller hiện có. Nếu sản phẩm cần chỉnh `BangCuocGuiHang`, cần xác định owner/permission và UI riêng; không đổi API fare-prices hiện hữu thành cargo rates.

## 15 review threads chưa resolve

| Priority | Thread | Vị trí | Vấn đề ghi trong review |
|---|---|---|---|
| P0 | `PRRT_kwDOUfyB7s6rbMPJ` | `bookings.controller.ts:71` | Public `confirm-payment` cho phép xác nhận không có bằng chứng provider. |
| P0 | `PRRT_kwDOUfyB7s6rbMPO` | `payments.controller.ts:107` | SePay callback không xác thực token/signature fail-closed. |
| P0 | `PRRT_kwDOUfyB7s6rbMPU` | payments service | Amount 0/âm/NaN không bị loại đúng cách. |
| P1 | `PRRT_kwDOUfyB7s6rbMPZ` | `trips.service.ts:790` | Legacy hold thiếu GiuCho/token/expiry/CAS count. |
| P1 | `PRRT_kwDOUfyB7s6rbMPj` | `trips.service.ts:814` | Release seat IDOR theo trip + số ghế. |
| P1 | `PRRT_kwDOUfyB7s6rbMPr` | `bookings.service.ts` | Booking bypass hold, không chứng minh quyền sở hữu. |
| P1 | `PRRT_kwDOUfyB7s6rbMPy` | `bookings.service.ts:1169` | Settlement không idempotent/atomic theo provider reference. |
| P0 | `PRRT_kwDOUfyB7s6rrr4p` | `shipments.controller.ts:63` | Public list có thể liệt kê PII vận đơn toàn hệ thống. |
| P0 | `PRRT_kwDOUfyB7s6rrr4s` | `shipments.controller.ts:53` | Numeric IDOR đọc PII shipment. |
| P1 | `PRRT_kwDOUfyB7s6rrr4u` | `shipments.service.ts:171` | Independent shipment không dùng bảng rate/không ghi fee detail. |
| P1 | `PRRT_kwDOUfyB7s6rrr4y` | `shipments.service.ts:103` | Điểm gửi/nhận không xác minh theo route/operator/role. |
| P1 | `PRRT_kwDOUfyB7s6rrr43` | `bookings.service.ts:449` | Attached cargo fallback rate sai và hard-code phí. |
| P1 | `PRRT_kwDOUfyB7s6rrr46` | `round-trip-booking.tsx:1096` | Chỉ tạo leg đi nhưng checkout hiển thị/tính khứ hồi, có mã giả khi lỗi. |
| P1 | `PRRT_kwDOUfyB7s6rrr4_` | `bookings.service.ts:574` | Guest booking gắn tài khoản theo phone chưa xác minh. |
| P2 | `PRRT_kwDOUfyB7s6ryIAt` | `payment-page.tsx:139` | Polling tiếp tục sau timer hold = 0, không dùng trạng thái expired/cancelled authoritative. |

Danh sách này phản ánh review threads, không có nghĩa các vấn đề đã được sửa/đóng. Các thread F1/F2 khởi động Next và thread VietQR thiếu config cùng các thread stale/resolved không tính vào 15 thread mở; audit không đề xuất resolve thread.

## Các quyết định phải chốt trước phase triển khai

1. Có hỗ trợ guest booking/shipment hay bắt buộc đăng nhập? Nếu guest, cơ chế claim/OTP và ownership được cấp lúc nào?
2. Khứ hồi là một aggregate booking với hai trip trong một transaction, hay tạm ngừng checkout khứ hồi?
3. Ai trả cargo fee khi gắn booking; chính sách phân loại/weight bracket/phụ phí chính thức lấy từ trường nào trong `BangCuocGuiHang`?
4. Independent shipment có online payment/settlement ngay trong scope hay giữ `CHO_THANH_TOAN` cho đến khi định nghĩa payment flow?
5. Guest shipment detail/lookup trả projection nào, credential code+phone có giới hạn/rate-limit/audit ra sao?
6. “Invoice” là tài liệu kế toán chính thức hay booking receipt? Ai được quyền xem và trạng thái nào được in?
7. Có caller mobile ngoài repository không, và họ đang dùng route/DTO nào?

## Giới hạn Phase 0

Đây là audit source và kế hoạch, không phải xác nhận runtime/DB. Không chạy test, migration hay thay đổi nghiệp vụ trong Phase 0. Phase triển khai phải dùng test integration DB phù hợp để chứng minh transaction, tenant scope, idempotency và concurrency.
