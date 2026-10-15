# Endpoint normalization — PR #36 reconciliation

Phạm vi: API Trips, Seat Holds, Bookings, Payments, Shipments/Cargo, Tickets/Refund và các caller Customer Web/Admin có trong repository. Đây là contract recommendation cho phase triển khai; **Phase 0 không đổi endpoint hoặc application code**.

Nguồn source: `origin/develop` `21e41783741c1db88040d29ac9fa590e15c1caf1`; PR #36 HEAD `6b52356b748f3db3f42215614d8ff3db97a3ddc7`. Tài liệu convention: `docs/nhiem-vu/rule-api.md`, `docs/nhiem-vu/endpoint-api.md`, `AGENTS.md`.

## Quy ước contract chung

- API gắn prefix `/api/v1` toàn cục tại `apps/api/src/common/configure-api.ts:91`; controller khai báo resource path không lặp prefix.
- Thành công được `ApiResponseInterceptor` bọc thành `{ "data": ... }` nếu handler chưa trả envelope (`apps/api/src/common/interceptors/api-response.interceptor.ts:10-38`). Collection phân trang dùng `{data, meta:{page,pageSize,totalItems,totalPages}}`.
- Lỗi theo `{statusCode,error,message,details?}`; `ValidationPipe` toàn cục validate DTO (`configure-api.ts:93-107`). Không trả PII chỉ vì một route public hoặc numeric ID được đoán.
- Query phân trang/tìm kiếm/sắp xếp thống nhất `page`, `pageSize`, `search`, `sortBy`, `sortDirection`; filter domain có thể thêm `status`, `tripId`, `customerId`. Ngày/giờ dùng ISO 8601; tiền VND dùng integer/Decimal ở server.
- Giữ plural English kebab-case cho resource. Dùng subresource khi quyền/scope thật sự khác; action endpoint chỉ giữ khi biểu đạt nghiệp vụ rõ, ví dụ `POST /tickets/cancel` hoặc provider webhook.
- Không tạo API platform-specific. Customer Web/Admin dùng cùng API; Admin khác quyền và projection, không nhân bản domain endpoint.

## Inventory hiện có và hướng chuẩn hóa

| Resource / operation | `origin/develop` | PR #36 và caller thực tế | Hướng quyết định |
|---|---|---|---|
| Trip admin CRUD/actions | `POST /trips`, `GET /trips`, `PATCH /trips/:id`, `PATCH /trips/:id/status`, `POST /trips/:id/cancel` (`trips.controller.ts:37-55,102-155`) với tenant roles/permissions. | Các routes còn giữ nguyên trong PR; Admin tạo/chỉnh chuyến qua trip service. | Giữ; đây là mutation vận hành có permission/scope, không thay bằng customer APIs. |
| Trip search/read | `GET /trips/search`, `/trips/:id`, `/trips/:id/seats`, `/trips/:id/alternatives` (`trips.controller.ts:31-100`) | Giữ các route; Web `trips.api.ts:80-118` gọi search/detail/seats/alternatives. | Giữ; contract read khách hàng dùng một route thống nhất. |
| Admin trip operation | `GET /trips/:id/operational-detail`, `GET /trips/:id/seat-inventory`, create/update/status/cancel (`trips.controller.ts:37-65,128-155`) | Admin `trip-service.ts:207-224,409-425`. | Giữ do tenant permission và projection khác; không thay bằng customer seat map. |
| Live cargo capacity | Không có endpoint capacity riêng trong develop. | `GET /trips/:id/cargo-capacity`; Web wrapper `trips.api.ts:112-125`. Trip detail trả capacity cấu hình tĩnh (`TripsService.mapTrip`, `:341-350`). | Giữ read endpoint live; thống nhất response field/type với trip detail, nhưng không gộp số used/remaining vào field cấu hình tĩnh. |
| Seat holds | Resource `POST /seat-holds`, `DELETE /seat-holds` và alias `DELETE /seat-holds/:holdToken` (`seat-holds.controller.ts:17-53`). | PR thêm `POST/DELETE /trips/:id/seat-holds` (`trips.controller.ts:92-108`); Web wrapper gửi `seatNumbers`, hiện không tìm thấy call site (`trips.api.ts:127-147`). | Chỉ giữ resource `/seat-holds`. Xóa nested duplicate sau khi caller đã migrate. |
| Booking quote/create/read | `POST /bookings/quote`, `POST /bookings`, `GET /bookings`, `GET /bookings/:bookingId` (`bookings.controller.ts:22-60`). | Giữ route; PR cho booking DTO nhiều dạng và hold optional; Web gửi seatNumbers không hold (`one-way-booking.tsx:850-875`, `round-trip-booking.tsx:1074-1084`). | Giữ endpoints, giữ core develop; DTO chuẩn duy nhất + holdToken bắt buộc. Cargo attached là extension có schema rõ. |
| Booking cancellation | Không có controller action hủy booking riêng trong `BookingsController`; cancellation của khách đi qua `POST /tickets/cancel` và ticket/refund workflow. | Không có endpoint hủy booking thay thế được xác nhận. | Giữ cancellation theo ticket/booking policy hiện hữu; không tạo `/bookings/:id/cancel` trùng trước khi xác định phạm vi nhiều vé/ghế và refund. |
| Booking detail/confirm | Không có public detail hoặc confirm. | `GET /bookings/:bookingId/detail` và `POST /bookings/:bookingId/confirm-payment` public (`bookings.controller.ts:64-81`); Web gọi qua `bookings.api.ts:223-260`. | Bỏ public confirm; thay public detail bằng `GET /bookings/:id` có principal hoặc capability riêng nếu quyết định hỗ trợ guest. |
| Payments | `POST /payments`, `GET /payments/:paymentId/status`, `GET /payments/:paymentId` có principal (`payments.controller.ts:54-80`). Public provider callbacks MoMo/VNPAY/ZaloPay (`:82-99`). | Thêm public `POST /payments/sepay-webhook` (`:100+`); Web hiện không gọi payment create/status; payment page đọc booking detail. | Giữ API resource + provider webhook; callback provider đưa về common settlement; Web đọc status qua scoped payment read khi contract/payment flow được nối. |
| Independent shipments | Chưa có shipment controller/service trong develop. | PR `POST /shipments`, `POST /shipments/lookup`, `GET /shipments/categories`, `GET /shipments/:id`, `GET /shipments` (`shipments.controller.ts:24-70`). Web dùng create, lookup, categories (`send-freight-page.tsx:160-171,332,391`); detail wrapper không có UI call site; global list không có Web/Admin caller. | Giữ create, lookup, categories; list/detail chỉ auth + scope. Không để OptionalAuth tạo list toàn cục hoặc numeric IDOR. |
| Admin customer shipment history | `GET /customers/:customerId/shipments`, role/permission tenant (`admin-customers.controller.ts:20-23,86-103`), filter customer+tenant trong service (`:566-620`). | Admin `customer-service.ts:165-194`. | Giữ scoped nested collection; semantics khác global list nên không gộp/xóa. |
| Customer tickets | `GET /tickets`, `GET /tickets/:ticketId`, `POST /tickets/lookup`, `POST /tickets/cancel` (`tickets.controller.ts:30-74`). | Web gọi qua account ticket service. Project endpoint doc mô tả cancel path khác (`endpoint-api.md:246-257`). | Giữ owner reads và guest code+phone workflows; sửa tài liệu sai path. Không đưa PII vào GET query. |
| Refund | Không có REST controller cho refund; cancellation tạo refund job nội bộ và processor dùng idempotency key. | Không thấy client gọi refund resource. | Giữ internal workflow; không thêm `/refunds` trước khi có use case/authorization/contract sản phẩm. |
| Invoice | Không có invoice API/model backend. | Hai client routes `/invoice/:id`, `/invoices/:invoiceId`; UI gọi public booking detail rồi fallback sessionStorage/mock. | Không xem UI route là REST endpoint; quyết định invoice domain riêng hay booking receipt trước khi đặt endpoint. |

`apps` trong repository chỉ có `api`, `admin`, `web`; chưa thể inventory caller mobile ngoài repo.

## Contract đề xuất theo resource

### Trips và Seat Holds

| Method/path | Auth | Request/query | Success data | Error/compatibility |
|---|---|---|---|---|
| `GET /trips/search` | Public/optional | Query search hiện có; chuẩn hóa pagination/date/filter theo `rule-api.md`. | Trips + `meta` | Validation/query error thống nhất. |
| `GET /trips/:tripId` | Public/optional | `tripId` path | Trip projection; cargo capacity ở đây là cấu hình tĩnh. | 404 trip không tồn tại/không public. |
| `GET /trips/:tripId/seats` | Public/optional | `tripId` path | Seat IDs, label/position/status/price; trạng thái chỉ là snapshot, không cam kết giữ ghế. | Booking vẫn cần hold token server. |
| `GET /trips/:tripId/cargo-capacity` | Public/optional | `tripId` path | Capacity, used, remaining và `acceptsShipments` từ dữ liệu live. | Giữ khác nghĩa với capacity cấu hình trong trip detail. |
| `POST /seat-holds` | Customer principal hoặc guest-session cookie do backend cấp; bearer hợp lệ phải resolve Customer. Không có bearer vẫn phải có cookie guest hợp lệ; anonymous không cookie không phải guest principal. | Header `Idempotency-Key`; body `{tripId, seatIds}` với IDs là `gheChuyenXeId` dương, unique | `201` `{holdToken,tripId,seatIds,status,expiresAt}` trong `data`; TTL backend 10 phút | Idempotent retry cùng key/payload/owner trả cùng active hold; khác payload/owner/session `409 IDEMPOTENCY_KEY_REUSED`; seat hoặc active quota conflict `409`; vượt rate window `429 TOO_MANY_REQUESTS` kèm `Retry-After`. |
| `DELETE /seat-holds` | Guest capability; hold Customer cần đúng Customer principal | Header `X-Hold-Token`; không body/path/query token | `200` `{tripId,seatIds,status}` trong `data`; retry released là idempotent | Xác minh DB record active/terminal trước khi thay đổi; consumed trả `409 HOLD_ALREADY_CONSUMED`. Alias `DELETE /seat-holds/:holdToken` chỉ giữ tạm cho client đã phát hành. |

Guest `POST /seat-holds` bắt buộc cookie session do backend cấp; nếu chưa có bootstrap/middleware cấp session thì chưa được mở guest hold. Không có endpoint verify riêng: `POST /bookings` xác minh active `GiuCho`, owner, expiry và chính xác tập seat IDs rồi consume trong cùng transaction. Signed `holdToken` không chứng minh record còn active; thiếu DB record phải fail closed. PR nested `POST/DELETE /trips/:tripId/seat-holds` bị loại vì biểu diễn sai resource ownership và không tương đương token hold. `holdToken` là capability; Web không log hoặc đưa vào URL. Contract chi tiết và các lỗi source hiện tại nằm ở [TASK_A0_SEAT_HOLD_CONTRACT.md](TASK_A0_SEAT_HOLD_CONTRACT.md).

### Bookings và khứ hồi

| Method/path | Auth | Request/query | Success data | Quy tắc |
|---|---|---|---|---|
| `POST /bookings/quote` | Public/optional | Một DTO quote chuẩn gồm trip, seat count/IDs, promotion và cargo request nếu cần quote cargo. | Fare/promotion breakdown + expiry nếu quote có thời hạn. | Quote chỉ preview; create phải tính lại ở server. |
| `POST /bookings` | Customer principal theo default; guest chỉ sau quyết định ownership | `{tripId,seatIds,pickupPoint,dropoffPoint,contact,holdToken,promotionCode?,cargoItems?}`. Giữ tên `pickupPoint`/`dropoffPoint` và shape `contact` theo DTO develop; không hỗ trợ đồng thời alias `seatNumbers`, `pickup`, `dropoff`, `passenger`. | Booking, tickets, order/payment intent reference theo response contract hiện hành. | `holdToken` required; verify + consume hold trong cùng transaction; DTO cụ thể; cargo là một phần transaction khi policy được chốt. |
| `GET /bookings` | Customer principal | Query pagination/search/status | Chỉ booking thuộc customer; `{data,meta}`. | Tenant/customer scope ở backend. |
| `GET /bookings/:bookingId` | Owner principal | ID path | Booking detail private. | Chỉ chủ tài khoản được liên kết đọc; guest booking trả `403`. |
| `GET /bookings/:bookingId/detail` | Optional principal; registered booking yêu cầu đúng owner; guest booking yêu cầu `x-booking-code` và `x-booking-phone` khớp đơn | ID path + hai header guest credentials | `{data: booking}`; guest credentials sai/thiếu trả `404 BOOKING_NOT_FOUND` | Numeric ID một mình không cấp quyền. Guest booking vẫn độc lập, không liên kết tài khoản theo số điện thoại; mã booking mới dùng UUID entropy cao. |
| Khứ hồi | Cần quyết định | Nếu có hỗ trợ: request aggregate gồm hai trip legs, hai seat sets và holds; một operation duy nhất. | Aggregate booking/order thể hiện đủ hai leg. | Không mô phỏng bằng một `POST /bookings` rồi cộng cả hai leg ở client. Nếu aggregate chưa triển khai, client không được checkout như khứ hồi. |

Create DTO hiện tại và các frontend caller chưa thống nhất; trước rollout phải version/migrate caller có trong Web và caller mobile ngoài repo. API errors cần phân biệt validation (`VALIDATION_ERROR`), hold/seat conflict (`409`), quote/rate conflict và not-found; không trả success envelope cho lỗi nghiệp vụ.

### Payments, provider callbacks và settlement

| Method/path | Auth | Contract hiện trạng / hướng |
|---|---|---|
| `POST /payments` | Customer principal | Tạo payment intent cho order đã tồn tại; DTO provider hiện hỗ trợ MoMo/VNPAY/ZaloPay. Không dùng endpoint này để tự set paid. Response chứa payment ID/status/provider redirect hoặc QR data theo provider contract. |
| `GET /payments/:paymentId` | Owner principal | Payment detail của đúng customer/order. |
| `GET /payments/:paymentId/status` | Owner principal | Read-only status từ DB; Web polling phải đọc endpoint này (hoặc booking status private có contract tương ứng), không tự xác nhận. |
| `POST /payments/momo/webhook`, `/payments/vnpay/webhook`, `/payments/zalopay/webhook` | Public transport, xác minh chữ ký/provider trong service | Giữ provider-required path/body; sau verify gọi chung settlement. |
| `POST /payments/sepay-webhook` | Public transport, nhưng callback phải được verify fail-closed | Giữ provider callback route; validate token/signature, amount, currency/reference/replay theo provider contract; sau đó gọi `PaymentsService.confirmPaymentSuccess()` chung. Đây là đề xuất phase sau, không phải sửa trong audit. |
| `POST /bookings/:id/confirm-payment` | Không còn | Xóa public direct confirmation; không thay bằng endpoint confirm khác nhận lệnh từ frontend. |

Provider callbacks có thể không dùng response envelope thông thường nếu protocol bắt buộc format provider; ghi rõ ngoại lệ ở controller/documentation. Settlement là transaction có CAS/idempotency, chỉ do backend thực hiện. Không thêm REST refund route: ticket cancellation hiện enqueue internal refund job có idempotency key.

### Shipments/Cargo

| Method/path | Auth | Request/query | Success data | Chuẩn hóa |
|---|---|---|---|---|
| `GET /shipments/categories` | Public/optional | Không có | Danh sách category active dùng trong form. | Giữ caller hiện tại. |
| `POST /shipments/quote` | Chưa có; đề xuất nếu UI cần báo phí trước | Body gồm trip, pickup/dropoff IDs, item category/weight/quantity | Cước breakdown theo rate thật, expiry/version nếu cần. | Gap đề xuất, chỉ thêm nếu quote là use case được xác nhận. Quote không đặt hàng. |
| `POST /shipments` | Customer principal; guest theo quyết định | Body shipment + sender/receiver + items + trip/route points; không chấp nhận điểm ngoài tuyến/tenant. | Shipment/order pending theo payment contract. | Giữ entry point independent; dùng chung cargo domain service/policy với attached cargo. |
| `POST /shipments/lookup` | Public/optional + throttle/rate limit | Body `{waybillCode,phoneNumber}`; giữ PII trong body, không GET query. | Projection tối thiểu shipment status/timeline/route. | Giữ code+phone verification; không trả mọi PII contact fields. |
| `GET /shipments` | Customer principal hoặc tenant role/permission | Query `page,pageSize,search,status,sortBy,sortDirection`; filter ownership/tenant bắt buộc từ principal. | `{data,meta}` chỉ trong scope caller. | Hiện public `@OptionalAuth`; cần bỏ anonymous list. |
| `GET /shipments/:shipmentId` | Owner principal hoặc tenant permission | ID path; không dùng ID như access token. | Scoped projection; PII chỉ theo permission cần thiết. | Hiện OptionalAuth + service thiếu customer owner check; không giữ public numeric detail. |
| `POST /shipments/:shipmentId/cancel` | Cần quyết định policy | Body reason/idempotency key nếu nghiệp vụ cho phép | State transition + refund request/reference, không tự refund trong client. | Endpoint chưa có. Không thêm trước khi quyết định thời điểm cancel, fee, actor và refund. |
| `GET /customers/:customerId/shipments` | Admin tenant role + `customer:read` | Customer ID + pagination/search | Customer shipments scoped customer + tenant. | Giữ trong Admin customer workspace; không đồng nghĩa `GET /shipments`. |

`POST /shipments` independent và `POST /bookings` có `cargoItems` là hai use cases; rate calculation, route-point validation, snapshot fees, capacity reservation, status history và persistence phải dùng một logic chung. `GET /shipments/:id` public không được giữ chỉ để hỗ trợ UI invoice/detail.

### Tickets, cancellation, invoices

| Method/path | Auth | Request/result | Hướng |
|---|---|---|---|
| `GET /tickets` và `GET /tickets/:ticketId` | Customer principal/owner | Private ticket data, pagination khi list. | Giữ; không nhập vào booking public read. |
| `POST /tickets/lookup` | Public + throttle | Body mã vé + phone; chỉ trả projection đã kiểm chứng. | Giữ guest lookup; không đổi thành GET query có PII. |
| `POST /tickets/cancel` | Public + throttle, server verify code/phone và policy | Body cancellation request; response cancellation/refund pending state. | Giữ action path hiện tại; cập nhật `docs/nhiem-vu/endpoint-api.md` đang mô tả sai `/tickets/:ticketId/cancel`. |
| Refund worker | Internal | Refund record/provider reference + idempotency key. | Không có REST resource hiện tại; không thêm endpoint do audit tự suy luận. |
| Invoice | Chưa có API | Hai route frontend là UI route, không phải server contract. | Quyết định receipt vs invoice trước khi thiết kế endpoint. Success state chỉ dựa vào verified payment/booking từ API, không từ `sessionStorage` fallback. |

## Breaking changes và chuyển đổi caller

1. Booking: thay shape permissive bằng DTO chuẩn và bắt buộc `holdToken`. Migrate Customer Web booking screens + `trips.api.ts`; kiểm tra mọi caller ngoài repo/mobile trước khi bật validation.
2. Seat holds: Web map seat label sang `tripSeatId`, gửi `POST /seat-holds` cùng `Idempotency-Key`; guest phải có cookie session server-issued (chưa có bootstrap thì chưa mở guest hold). Gửi `holdToken` bắt buộc vào `POST /bookings` và release bằng `DELETE /seat-holds` + `X-Hold-Token`; verify/consume phải kiểm tra DB record active. Áp dụng active quota trả `409`, rate limit trả `429` + `Retry-After`. Bỏ nested trip hold routes trước rollout; chỉ giữ `DELETE /seat-holds/:holdToken` trong giai đoạn deprecation sau khi inventory client phát hành.
3. Payment: loại bỏ public `confirm-payment`; payment page chỉ poll status read-only và chỉ mở invoice khi backend báo paid. Migrate mọi phương thức Web; không thay contract provider callbacks tùy tiện.
4. Booking detail: Web truyền code + phone của draft guest qua header để đọc đúng guest booking; tài khoản đăng nhập vẫn chỉ đọc booking thuộc owner. Không tự claim/liên kết booking guest bằng số điện thoại.
5. Shipment list/detail: `GET /shipments` và `GET /shipments/:id` chuyển sang auth + scope; global list không có caller hiện tại trong repo. Guest dùng lookup `POST` code+phone. Giữ Admin customer subresource.
6. Cargo: quote/rate changes cần tương thích với `BangCuocGuiHang`, `ChiTietCuocGuiHang` và các cột đã dùng; không thay schema/migration trước khi xác định snapshot và lịch sử dữ liệu.
7. Tài liệu: cập nhật `docs/nhiem-vu/endpoint-api.md` sau quyết định contract, đánh dấu alias deprecated và ngày loại bỏ. Chưa thể kết luận mobile compatibility do không có app mobile trong repo.

## Regression matrix tối thiểu

- Seat hold: race, expiry, owner/token mismatch, missing/inactive DB record fail-closed, cleanup-vs-consume CAS, idempotent create/release, consume transaction.
- Booking: thiếu token, wrong customer/token, multi-seat all-or-nothing, cargo failure rollback, idempotent retry.
- Payment: unauthenticated direct confirm không còn; provider invalid signature/token, amount sai, replay/parallel callback, expired/cancelled order.
- Shipment: anonymous list/detail, cross-customer, cross-tenant, lookup code/phone mismatch, wrong route point, no/multiple rates, weight boundaries, concurrent capacity reservation.
- Customer Web: request shape khớp DTO; backend pending/error không render paid; round-trip không tính tiền lệch record; invoice không hiện “đã thanh toán” khi chỉ có local fallback.
- Admin: customer shipment history scope customer + tenant; trip seat inventory role/permission; fare prices vẫn là passenger fare.
- Tickets/refund: lookup/cancel phone mismatch; cancellation policy; duplicate refund job idempotency.
