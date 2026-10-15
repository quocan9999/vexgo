# R9 — Handoff rà soát semantic conflict cuối

## Trạng thái

R9 hoàn tất phần reconciliation và regression trong phạm vi được giao. Kết quả này **không xác nhận PR #36 an toàn để merge hoặc deploy**. Các finding P0/P1 ngoài phạm vi còn mở; R1 Postman smoke và thanh toán qua SePay trên trình duyệt chưa được xác nhận.

## Baseline và nguồn implementation

- Worktree: `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-pr36-integration`; branch: `fix/pr36-integration`; baseline R9: `d684ca8a8cbd0df59c30b148e07d684c83933133` (R8).
- Merge cần đối chiếu: `0b99882dee37c092069bd85afe0f3546e76ff7a7`; `origin/develop` được đối chiếu ở `21e41783741c1db88040d29ac9fa590e15c1caf1`; code Sony trước merge ở first parent `2dc2ff7d0998f06bc0066eff44cb3e9e2cdd10ac`. Đây là mốc so sánh, không phải lệnh reset.
- Không chọn code theo nhánh. Theo các phase handoff đã nghiệm thu, giữ `SeatHoldsService` làm lõi giữ ghế, `BookingsService` làm transaction booking, `PaymentsService.confirmPaymentSuccess` làm settlement core, `CargoPricingService`/`CargoCapacityService` làm nguồn rule cước và sức chứa, `ShipmentPersistenceService` làm lõi lưu shipment dùng chung. Chúng được chọn vì caller và transaction hiện tại hội tụ vào các lõi này; các mutation trùng đã bỏ ở phase tương ứng.
- R9 không đổi Prisma schema, migration, API Backend, payment, auth hoặc hành vi Admin. Hai file đang sửa sẵn của chủ dự án (`README.md`, `docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md`) được giữ nguyên và không thuộc commit R9.

## Contract và callers tại source hiện tại

Prefix API toàn cục là `/api/v1`. Dữ liệu thành công dùng envelope `data`, danh sách dùng `data` + `meta`.

| Method và endpoint | Auth; request → success | Backend owner / DB | Caller trong repo | Status/error tiêu biểu |
|---|---|---|---|---|
| `GET /trips/:id/seats` | Optional auth; `id` → `{ data: [{ tripSeatId, ... }] }` | `TripsService`; `ChuyenXe`, `GheChuyenXe` | Customer Web seat map/booking | 400 ID không hợp lệ; 404 chuyến không có |
| `GET /trips/:id/seat-inventory` | Tenant role + `trip:read`; query `status?` → seats + `meta` | `TripsService`; `ChuyenXe`, `GheChuyenXe`, `Ghe` | Admin trip inventory | 401/403 auth/permission; 404 trip ngoài tenant |
| `GET /trips/:id/cargo-capacity` | Optional auth; `id` → capacity theo group | `TripsService` + `CargoCapacityService`; `HangHoa`, `LoaiHangHoa`, trip capacity | Customer Web tra cứu; chỉ đọc | 404 chuyến không tồn tại |
| `POST /seat-holds` | Optional auth; `{ tripId, seatIds }` → `data` gồm token và expiry | `SeatHoldsService`; `GiuCho`, `GheChuyenXe` | Customer Web `bookingsApi.createSeatHold` | 400 `INVALID_SEATS`; 404 trip; 409 `SEATS_NOT_FOUND`, `TRIP_NOT_AVAILABLE`, `TRIP_DEPARTED`, `SEAT_UNAVAILABLE` |
| `DELETE /seat-holds` | Optional auth; `X-Hold-Token` hoặc `{ holdToken }` → `{ success: true }` | `SeatHoldsService`; `GiuCho`, `GheChuyenXe` | Customer Web `bookingsApi.releaseSeatHold` | 400 thiếu token; controller không chuyển principal vào Service nên token là bearer; hiện trả success cả khi hold không được tìm thấy/đã terminal — đây không xác nhận hold active |
| `DELETE /seat-holds/:holdToken` | Optional auth; token trong path, header có thể thay token path → kết quả nhả hold | Cùng `SeatHoldsService` và DB hold như route canonical | Không thấy caller Web/Admin; caller ngoài repo chưa xác minh | Lỗi token/hold cùng nhóm route canonical |
| `POST /bookings/quote` | Public; `{ tripId, seatIds, promotionCode? }` → quote trong `data` | `BookingsService`; trip/fare/promotion read | Customer Web booking | 400 input/ghế; 404 trip; 409 trip/fare không khả dụng |
| `POST /bookings` | Optional auth; DTO `tripId`, `seatIds`, `holdToken`, `contact`, điểm đón/trả và cargo tùy chọn → booking/order/payment trong `data` | `BookingsService` transaction, `SeatHoldsService`, pricing/capacity/persistence; `DonGiaoDich`, `PhieuDatVe`, `Ve`, `ThanhToan`, `GheChuyenXe`, shipment nếu có | Customer Web một chiều; guest không auto-link phone | 400 `INVALID_BOOKING_CONTACT`; 404 `TRIP_NOT_FOUND`; 409 `HOLD_INVALID`, `SEAT_UNAVAILABLE`, `CARGO_POINTS_REQUIRED` hoặc lỗi capacity |
| `GET /bookings/:bookingId/detail` | Optional auth; guest gửi `X-Booking-Code`, `X-Booking-Phone` → booking snapshot trong `data` | `BookingsService`; booking/order/payment/tickets/cargo | Web payment polling và invoice | 403 `FORBIDDEN_BOOKING_ACCESS` cho account không sở hữu; 404 `BOOKING_NOT_FOUND` |
| `GET /bookings`, `GET /bookings/:bookingId` | Authentication; query paging hoặc ID → danh sách/detail trong `data` | `BookingsService`; booking/order/tickets | Customer Web lịch sử booking | 401 thiếu auth; 403/404 ngoài phạm vi hoặc không có record |
| `POST /payments` | Authentication; `{ bookingId, provider }` → payment attempt trong `data` | `PaymentsService`; `ThanhToan`, `DonGiaoDich` | Không tìm thấy caller Web/Admin; booking transaction đã tạo payment SePay ban đầu | 404 booking; 409 hết hạn/hủy/đã trả; 503 provider chưa cấu hình hoặc chỉ demo |
| `GET /payments/:paymentId/status`, `GET /payments/:paymentId` | Authentication; payment ID → trạng thái/payment snapshot | `PaymentsService`; `ThanhToan`, order/booking | Web hiện poll booking detail thay vì status endpoint | 401/403 ownership; 404 payment không tồn tại |
| `POST /payments/sepay-webhook` | Provider callback; raw body + `X-SePay-Signature`, `X-SePay-Timestamp` → `{ success: true }` ở acknowledgment | SePay adapter trong `PaymentsService`, sau đó `confirmPaymentSuccess`; `ThanhToan`, order/booking/ticket/cargo state | SePay; không phải browser | 401 `UNAUTHORIZED_WEBHOOK`; 400 payload/reference/amount invalid; 404 order; 409 transaction/payment conflict; 503 secret thiếu |
| `POST /shipments` | Optional auth; DTO shipment/contact/points/items → `{ data }` | `ShipmentsService` + `ShipmentPersistenceService`; order/shipment/items/fee/history | Customer Web gửi hàng độc lập | 400 `EMPTY_CARGO_ITEMS`/validation; 404 trip; 409 trip không nhận cargo hoặc pricing/capacity |
| `GET /shipments/categories`, `GET /shipments/trips/:tripId/route-points` | Optional auth; trip ID khi lấy points → category/điểm gửi nhận trong `data` | `ShipmentsService` + `CargoPricingService`; `LoaiHangHoa`, điểm và rate theo route | Customer Web form gửi hàng và booking cargo | 404 trip/không có điểm; 409 điểm/rate không hợp lệ |
| `POST /shipments/lookup` | Optional auth; waybill/order code + phone sender/receiver → shipment snapshot trong `data` | `ShipmentsService`; shipment/order/points/trip/items/history | Customer Web tra cứu vận đơn | 404 `SHIPMENT_NOT_FOUND` nếu mã/phone không khớp; validation 400 |
| `GET /shipments`, `GET /shipments/:id` | Authentication; query paging hoặc shipment ID → scoped list/detail | `ShipmentsService`; shipment/order/points/trip/items/history | Admin/customer scoped history | 401 thiếu auth; 403 `FORBIDDEN_SCOPE`; 404 shipment không có |
| `GET /customers/:id/shipments` và customer subresources | Tenant role + `customer:read`; customer ID + paging → `data`/`meta` | `CustomersService`; customer/order/ticket/shipment projections | Admin Customer Workspace/Shipments tab | 400 invalid ID/query; 401/403 quyền hoặc tenant scope |
| `POST /tickets/lookup`, `POST /tickets/cancel`, `GET /tickets` | Lookup/cancel public có throttling và mã/phone hoặc request hủy; danh sách cần authentication | `TicketsService` + `RefundProcessorService`; ticket/order/payment/refund/history | Customer Web tra cứu/hủy; Admin history qua customer subresource | 400 validation; 404 không khớp; 409 trạng thái/chính sách; 429 public rate limit |

Không còn nested trip hold mutation hoặc `TripsService.holdSeats/releaseSeats`. Web write DTO dùng `seatIds`; `seatNumbers` còn ở response/UI để hiển thị vé, không phải alias tạo booking. Không có public `confirm-payment` caller; payment UI không tự chuyển trạng thái thành công. Guest invoice chỉ lấy thông tin xác thực từ payment draft cục bộ rồi để Backend xác minh.

Các route `POST /payments/momo/webhook`, `/vnpay/webhook` và `/zalopay/webhook` vẫn tồn tại; provider adapter gọi chung settlement core. Hủy vé tạo refund record và chuyển qua `RefundProcessorService`; R9 không thêm refund endpoint hoặc thay đổi provider/refund flow.

## Quyết định reconciliation và hành vi giữ lại

- Trip/hold: `SeatHoldsService` còn là đường tạo/nhả/consume; API Admin inventory và trip CRUD được giữ. Legacy DELETE alias chưa xóa do chưa chứng minh không có consumer ngoài repo.
- Booking: một chiều dùng `tripSeatId`/`seatIds` và hold token; booking, order, ticket, trạng thái ghế, payment ban đầu và cargo kèm vé được ghi trong transaction. Guest booking độc lập với tài khoản trùng số điện thoại.
- Payment: SePay webhook đi qua xác minh adapter rồi vào `confirmPaymentSuccess`; không có thao tác frontend tự xác nhận. Payment page chỉ điều hướng sau khi Backend trả trạng thái đã thanh toán; invoice từ chối trạng thái pending/expired/cancelled.
- Cargo pricing/points: các flow booking-attached và standalone gọi resolver dùng chung. Giá cuối do Backend snapshot; R9 thay nhãn giá ước lượng cứng sai trên card chuyến gửi hàng thành `Theo bảng cước`.
- Cargo capacity: khóa chuyến và đếm `HangHoa.soLuong` theo capacity group. Theo quyết định R7 đã được chủ dự án xác nhận, `MOI_TAO` (kể cả chờ thanh toán), `DA_TIEP_NHAN`, `DANG_VAN_CHUYEN` chiếm chỗ; `DA_HUY`, `DA_GIAO` nhả chỗ.
- Shipment persistence: shipment độc lập và cargo kèm booking giữ hai entry point nhưng dùng chung `ShipmentPersistenceService` trong transaction của caller. Lịch sử và snapshot phí giữ nguyên.
- Client: gửi hàng độc lập không phải booking vé. R9 xóa đoạn lưu một object shipment với shape booking sai vào payment draft; không thay đổi flow payment vé.
- Mock source: các mock trip/seat nằm trong `TripDetail`/`SeatPicker` không được route Next hiện tại import; route trip hiện tại nạp API thật và render `OneWayBooking`/`RoundTripBooking`. Trang `/booking/:id/payment` cũ tự ghi chú là demo và không phải caller checkout đang dùng; cần tiếp tục giữ tách khỏi production flow.
- GitNexus pre-edit impact của `SendFreightPage` là `UNKNOWN`; đã xác minh caller bằng source search: route `/send-freight` và `/shipments/new` cùng import component. Sau sửa, `detect-changes --scope staged` báo risk `medium`, 4 staged files, 4 symbols và 3 flow (`SearchTrips`, `ParseError`, `ApiError`) trong component; regression component và test suite đã chạy. `detect-changes --scope all` cũng thấy 2 thay đổi tài liệu có sẵn của chủ dự án (`README.md`, `R4_FINAL_HANDOFF.md`); chúng không được stage.

## File thuộc thay đổi R9

- `apps/web/src/features/shipments/components/send-freight-page.tsx` — bỏ draft booking sai sau khi tạo standalone shipment; xóa state/sort giá đã chết dựa trên `trip.price` và fallback 50.000đ; thay số giá hard-code trên card bằng nhãn theo bảng cước.
- `apps/web/test/unit/shipments/send-freight-page.spec.tsx` — regression component thực hiện nhập form, chọn loại hàng, gọi API tạo shipment và xác minh không ghi payment draft; kiểm tra card không quảng bá giá 50.000đ hard-code.
- `apps/web/package.json` — đưa regression mới vào `npm test` của Customer Web.
- `docs/pr36-reconciliation/fix-conflict/handoff/R9_FINAL_HANDOFF.md` — tài liệu handoff phase này.

## Ma trận R1–R9

| Phase | Kết quả hiện tại | Giới hạn hoặc bằng chứng |
|---|---|---|
| R1 | `DONE_WITH_LIMITATIONS` | Canonical seat hold được hội tụ; Postman smoke do chủ dự án tự chạy vẫn chưa xác nhận. Các việc hardening token/ownership/cleanup/idempotency/guest abuse còn backlog |
| R2 | `DONE_WITH_LIMITATIONS` | Guest booking độc lập, không auto-link theo số điện thoại; DB migration nullable chỉ thuộc worktree. Claim/OTP chưa có |
| R3 | `DONE_WITH_LIMITATIONS` | Luồng booking một chiều dùng API thật; round-trip bị UI chặn rõ ràng, chưa có aggregate multi-leg |
| R4 | `DONE_WITH_LIMITATIONS` | HMAC SePay, transaction ID unique và settlement core có code/test; chưa có xác nhận live provider end-to-end, refund provider phụ thuộc cấu hình |
| R5 | `DONE_WITH_LIMITATIONS` | QR và polling dựa dữ liệu Backend, không public confirm; browser với webhook/QR thật chưa được chạy trong R9 |
| R6 | `DONE` | Resolver giá/điểm dùng chung; phụ phí đã giữ theo quyết định chủ dự án |
| R7 | `DONE` | Capacity lõi dùng chung, atomic và concurrency test MySQL; policy trạng thái được chủ dự án duyệt |
| R8 | `DONE` | Shipment độc lập và attached dùng chung persistence; transaction/rollback và guest phone không auto-link có integration coverage |
| R9 | `DONE_WITH_LIMITATIONS` | Audit/caller regression hoàn tất; Postman/browser smoke chưa chạy, R1 smoke vẫn deferred |

## Kiểm thử đã chạy

| Lệnh/phạm vi | Kết quả |
|---|---|
| `apps/web`: `npm test` | PASS — 104 Node tests và 54 Vitest tests trên 4 component test files, gồm regression shipment R9 |
| `apps/api`: 12 unit test files về seat holds, trips, booking, payment/refund, cargo pricing/capacity, shipment persistence/codes, tickets | PASS — 175 tests |
| `apps/api`: `npx vitest run --no-file-parallelism test/integration/seat-holds/seat-holds-concurrency.spec.ts test/integration/trips/trips-concurrency.spec.ts test/integration/payments/payments-webhook.spec.ts test/integration/bookings/booking-status-history.spec.ts test/integration/customers/admin-customers.spec.ts test/integration/tickets/ticket-lookup-rate-limit.spec.ts` | PASS — 6 files, 107 tests; các MySQL test chạy trên `vexgo_pr36` trong worktree và dùng fixture ID ngẫu nhiên/cleanup theo fixture. Không chạy migration, seed hoặc reset |
| `apps/admin`: `npm test` | PASS — 47 files, 349 tests |
| Root `npm run typecheck` | PASS — API, Admin, Customer Web |
| Root `npm run lint` | PASS — exit 0; Web báo 40 cảnh báo ở file khác, không có cảnh báo trên file R9; API không có warning/error |
| `npx prettier --check apps/web/package.json apps/web/test/unit/shipments/send-freight-page.spec.tsx` | PASS |
| `git diff --check` | PASS — working và staged diff sạch |
| `apps/api/test/integration/tickets/booking-ticket-status-history-db.spec.ts` | `NOT_RUN`: test yêu cầu `BOOKING_TICKET_STATUS_HISTORY_TEST_DATABASE_URL` trỏ schema test chuyên biệt; biến này không được cấu hình. Không đổi qua dùng DB production/local mặc định |
| Postman/browser/SePay live | `NOT_RUN`: chưa có thao tác thủ công hoặc xác nhận từ chủ dự án trong R9 |

Các log ERROR trong integration output là fault injection chủ ý để kiểm tra rollback/fail-closed; toàn bộ 107 assertions kết thúc PASS.

## Postman/browser smoke checklist — chưa thực hiện

Chỉ chạy trên API và DB worktree `vexgo_pr36`; dùng SePay test mode, không chuyển tiền thật.

1. Gọi `GET /api/v1/trips/{tripId}/seats` và `GET /api/v1/trips/{tripId}/cargo-capacity`; ghi lại `tripSeatId`, trạng thái ghế và capacity hiện tại.
2. Gọi `POST /api/v1/seat-holds` với `{ "tripId": ..., "seatIds": [...] }`; kỳ vọng có hold token và thời hạn. Tạo booking bằng `POST /api/v1/bookings` với cùng `seatIds`, `holdToken`, contact và điểm đón/trả; với cargo kèm vé, bổ sung `cargoItems` cùng point IDs. Kiểm tra response `data`, tổng tiền và booking/order code.
3. Mở `/payment?draftId=...` từ flow Web. Xác nhận pending không hiển dụng thành công; sau webhook đã xác minh, frontend chỉ điều hướng khi API detail trả cả booking/order ở trạng thái đã thanh toán. Với timeout/hủy, xác nhận không có invoice success.
4. Tạo shipment độc lập bằng `POST /api/v1/shipments`; xác nhận có waybill/order, không có booking/ticket/payment draft. Tra cứu bằng `POST /api/v1/shipments/lookup` với mã và phone hợp lệ.
5. Gửi cargo attached và standalone để đối chiếu cùng bảng cước và `GET /trips/:id/cargo-capacity`; thử vượt capacity, kiểm tra API từ chối và không ghi một phần.
6. Với Admin tenant hợp lệ, mở Customer Workspace → Shipments và so sánh với `GET /api/v1/customers/{id}/shipments`; thử tenant khác để xác nhận phạm vi bị từ chối.
7. Thử release hold qua `DELETE /api/v1/seat-holds` với header `X-Hold-Token`; legacy `DELETE /api/v1/seat-holds/{token}` chỉ kiểm tra tương thích nếu có consumer cần alias.

## Findings và việc còn mở ngoài R9

- **P1 — Chưa xác minh tài khoản nhận tiền SePay (`PRRT_kwDOUfyB7s6sWMrd`, `PREEXISTING_FINDING`, ngoài R6–R9):** Tại HEAD `9d54b9a`, `handleSepayWebhook()` kiểm tra chữ ký HMAC, mã tham chiếu, chiều tiền vào, số tiền và currency nhưng chưa đọc `payload.accountNumber` hoặc đối chiếu với allowlist cấu hình backend. Nếu SePay theo dõi nhiều tài khoản, khoản tiền vào tài khoản khác vẫn có thể được ghép với đơn. R6–R9 không sửa finding này; task riêng cần cấu hình backend fail-closed, so khớp chính xác tài khoản nhận, và unit/HTTP integration tests cho thiếu hoặc sai `accountNumber` không làm đổi payment/order.
- **P0/P1 — PII shipment lookup công khai (`PREEXISTING_FINDING`):** `POST /api/v1/shipments/lookup` là optional-auth, kiểm tra mã + phone người gửi hoặc người nhận rồi trả sender email/phone, receiver phone, địa chỉ, kiện hàng và timeline. Controller không gắn `ThrottlerGuard` (throttling hiện chỉ gắn rõ ở ticket/contact/auth routes). API list/detail thông thường yêu cầu auth và Service áp tenant/Customer ownership, nhưng lookup công khai cần review/rate-limit/redaction riêng trước merge/deploy.
- **P0 — seat hold hardening (`PREEXISTING_FINDING`):** R1/A0.1 chưa triển khai đầy đủ secret chuyên biệt/rotation, ownership fail-closed, cleanup/cạnh tranh, khôi phục token bền vững qua idempotency và quota chống abuse guest. `releaseSeatHold` còn fallback từ signed token/in-memory khi không tìm thấy record DB, rồi có thể cập nhật ghế đang `DANG_GIU` với `giuChoId = null`; đường này phải bị loại trong hardening riêng, không được xem là bằng chứng hold active. Release không nhận principal và token là bearer. Endpoint hiện trả success cả khi không tìm thấy hold. R1 smoke chưa chạy.
- **P1 — guest ownership/claim:** guest order không tự gắn theo phone; guest booking detail hiện dựa mã booking + phone. Chưa có OTP/claim flow để liên kết lịch sử guest với Customer.
- **P1 — provider/payment vận hành:** chưa có smoke live SePay; callback/trạng thái/refund phụ thuộc cấu hình provider. Payment late/cancelled cần theo dõi reconciliation/refund theo policy đã chốt; R9 không sửa settlement hoặc webhook.
- **P1 — round-trip:** Web vẫn cho tìm/chọn chuyến khứ hồi nhưng màn hình booking chặn rõ “chưa được hỗ trợ”; chưa có contract/backend aggregate multi-leg. Không được coi là booking đã hỗ trợ.
- **P2 — payment demo cũ:** `/booking/:id/payment` chứa fixture/`setPaid` nhưng UI ghi rõ demo; không được nối vào production checkout. Kiểm tra route isolation khi có thay đổi routing.
- **External client:** không có app Mobile trong workspace/API caller inventory đã kiểm tra; caller Mobile hoặc consumer ngoài repo là `UNVERIFIED_EXTERNAL_CLIENT`.
- Không thấy invoice dùng dữ liệu local làm nguồn sự thật: trang invoice tải booking detail và chỉ hiển thị khi cả payment/order đã `DA_THANH_TOAN`; guest credentials cục bộ chỉ dùng cho request mà Backend vẫn xác minh.

## Trạng thái review GitHub (đã tra cứu, không thao tác)

Tại lần kiểm tra R9, năm review thread sau vẫn unresolved trên PR #36. Bốn finding R6–R8 đã có implementation/regression trong branch này nhưng vẫn cần reviewer kiểm tra lại; finding tài khoản SePay chưa được xử lý và vẫn nằm ngoài scope R6–R9.

- `PRRT_kwDOUfyB7s6sX8yH` — R6 shared cargo rate: implementation và parity test đã có; reviewer cần xác minh rồi resolve.
- `PRRT_kwDOUfyB7s6sX8xr` — R7 shared atomic capacity: implementation và MySQL concurrency tests đã có; policy status đã được chủ dự án duyệt; reviewer cần xác minh rồi resolve.
- `PRRT_kwDOUfyB7s6sX8xz` — R8 guest shipment không tự liên kết theo phone: implementation và DB regression đã có; reviewer cần xác minh rồi resolve.
- `PRRT_kwDOUfyB7s6sX8x8` — R8 shipment code collision: generator và regression đã có; reviewer cần xác minh rồi resolve.
- `PRRT_kwDOUfyB7s6sWMrd` — P1 xác minh tài khoản nhận SePay: chưa triển khai trong R6–R9; giữ mở cho task SePay riêng.

## Git hygiene và điểm dừng

- `.env` và các biến SePay không bị chỉnh sửa; không có schema/migration, dump, seed/reset, cache hoặc DB artifact thuộc R9.
- `README.md` và `R4_FINAL_HANDOFF.md` là thay đổi có sẵn của chủ dự án, giữ unstaged/ngoài commit.
- `git diff --check` được xác nhận trên staged diff trước commit. Sau commit, Git status dự kiến chỉ còn hai thay đổi có sẵn của chủ dự án: `README.md` và `R4_FINAL_HANDOFF.md`; commit SHA được ghi trong phản hồi bàn giao vì SHA tự tham chiếu không thể được chèn vào chính commit chứa handoff.
- Chỉ reviewer xác nhận và resolve review conversation sau khi xem diff. Không push, không tạo PR, không merge, không tiếp tục sang phase/finding khác.

## Theo dõi finding P2 về hiển thị cước hàng

- Finding yêu cầu Customer Web không quảng bá mức cước hàng ước lượng cố định. Booking Web đã bỏ nội dung “dưới 20kg miễn phí/20–40kg 30.000đ”; giá vé trong lúc chọn chuyến được ghi rõ là tạm tính khi có hàng gửi, còn cước hàng sẽ được xác định khi tạo đơn.
- Trang thanh toán chỉ đọc `ticketSubtotal`, `cargoFee` và `totalAmount` từ booking detail do Backend trả về. Bảng giá không lấy cước từ draft hoặc tự chia cước theo kiện; khi Backend chưa trả cước hiển thị “Chưa có dữ liệu cước từ máy chủ”. Chỉ hiện “Miễn phí” khi booking detail trả `cargoFee = 0` hợp lệ.
- Chi tiết từng kiện ghi rõ cước được tính chung theo đơn; giá hàng theo đơn được trình bày riêng với cước vé và tổng thanh toán. Không thay đổi API, QR, SePay, polling, settlement hoặc payment flow.
- Regression component tests kiểm tra cước Backend 32.000đ, cước Backend 0đ, thiếu trường cước, thiếu ticket subtotal và modal chi tiết; booking flow tests tiếp tục kiểm tra 10kg, 2×25kg, xe máy 100kg và chặn kiện thường 41kg.
- Kiểm thử lần cập nhật này: `apps/web` `npm test` PASS — 104 Node tests và 71 Vitest tests; `npm run typecheck` PASS; ESLint trên các file liên quan PASS, còn 2 warning không chặn (unused `handleReloadUserInfo` trong round-trip booking và `<img>` trong payment page); `git diff --check` PASS.
- `GitNexus detect_changes --scope staged` trả mức `critical` với 14 symbol và 18 process bị ảnh hưởng; index cũ hơn HEAD 5 commit. Đã đối chiếu source và kiểm tra các flow `PaymentContent → GetPublicBookingDetail`, `PostDetailPage → GetCargoCategories`, `TripDetailPage → GetCargoCapacity` cùng các booking callers; test component/API giữ regression cho các đường liên quan.
- `Prettier --check` báo chưa chuẩn định dạng trên 8 file UI/test được kiểm tra; không auto-format toàn file để tránh tạo diff lớn ngoài các dòng liên quan finding.
- Browser/SePay smoke chưa chạy; regression tests render component thực và kiểm tra API/UI. Có thể smoke test thủ công bằng cách tạo booking có cargo, mở trang `/payment?draftId=...`, đối chiếu `Cước vé`, `Cước hàng`, `Tổng thanh toán` với `GET /api/v1/bookings/{bookingId}/detail`; thử response `cargoFee` dương, bằng 0 và thiếu trường để xác nhận UI lần lượt hiện số tiền, miễn phí, hoặc thiếu dữ liệu.
- Files follow-up thuộc finding: `apps/web/src/features/booking/components/luggage/luggage-step.tsx`, `apps/web/src/features/booking/components/luggage/luggage-summary.tsx`, `apps/web/src/features/booking/components/one-way-booking.tsx`, `apps/web/src/features/booking/components/round-trip-booking.tsx`, `apps/web/src/features/posts/components/post-detail.tsx`, `apps/web/src/features/payments/components/payment-page.tsx`, `apps/web/test/unit/booking/one-way-booking-flow.spec.tsx`, `apps/web/test/unit/payments/payment-page.spec.tsx` và handoff này.
