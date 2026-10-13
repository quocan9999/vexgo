# TASK A0 — Đặc tả canonical API giữ ghế

Ngày: 13-10-2026

- Worktree: `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-pr36-integration`
- Branch: `fix/pr36-integration`
- PR HEAD: `6b52356b748f3db3f42215614d8ff3db97a3ddc7`
- `origin/develop`: `21e41783741c1db88040d29ac9fa590e15c1caf1`
- Merge-base: `21e41783741c1db88040d29ac9fa590e15c1caf1`

> Tài liệu chốt đề xuất cho A0. Không thay đổi implementation, DTO, schema, migration, test hay database trong task này. Contract dưới đây là đích A1/A2, không mô tả rằng code hiện tại đã đáp ứng đầy đủ.

## 1. Quyết định canonical

- Tạo hold qua `POST /api/v1/seat-holds` với `tripId` và `seatIds`; mọi phần tử `seatIds` là `GheChuyenXe.gheChuyenXeId` của đúng chuyến.
- Giải phóng hold qua `DELETE /api/v1/seat-holds`, gửi bearer capability trong header `X-Hold-Token`; không nhận token trên URL.
- Không tạo API xác minh hold độc lập. `POST /api/v1/bookings` là điểm xác minh và consume hold: backend xác minh record active, owner, trip, đúng tập seat IDs và expiry trong cùng transaction ghi booking.
- Token chữ ký hợp lệ **không chứng minh hold còn active**. Mọi release/consume phải tìm được record `GiuCho` trong database và xác minh trạng thái `DANG_GIU`, `hetHanLuc > now`, ownership và các `GheChuyenXe` đang liên kết chính xác với record đó.
- TTL do backend ấn định là 10 phút. Không có gia hạn ngầm. Hold hết hạn không thể được khôi phục hoặc consume.
- Database là nguồn sự thật duy nhất. Không dùng in-memory map, token claims, thiếu delegate/bảng hoặc trạng thái `DANG_GIU` không có `GiuCho` làm fallback production.

## 2. Contract HTTP

Prefix `/api/v1` là global prefix. Thành công dùng envelope `{ "data": ... }`; lỗi dùng `{ "statusCode", "error", "message" }` và `details` khi là validation error, theo `docs/nhiem-vu/rule-api.md` và API response interceptor hiện tại.

### 2.1 Tạo hold

| Thuộc tính | Contract |
|---|---|
| Method/path | `POST /api/v1/seat-holds` |
| Authentication | Optional bearer. Không có `Authorization` là guest hold. Bearer hợp lệ phải resolve thành Customer profile; tài khoản Admin/nhân viên/Super Admin hoặc tài khoản không có profile Customer bị từ chối `403`. Bearer sai/hết hạn trả `401`, không hạ cấp thành guest. |
| Headers | `Idempotency-Key: <UUID v4 ngẫu nhiên>` bắt buộc cho một lần tạo logic; `Authorization: Bearer <accessToken>` tùy trường hợp. |
| Request body | `{"tripId": 123, "seatIds": [1701, 1702]}`. `tripId` và mỗi `seatId` là số nguyên dương; mảng không rỗng, không trùng ID và bị giới hạn theo số ghế tối đa của một booking. Sau validation, backend sort IDs tăng dần để ký token, tính fingerprint idempotency và trả response ổn định. Không nhận `seatNumbers` hay `gheId`. |
| Tạo mới | `201 Created`, `{ "data": { "holdToken": "<opaque-signed-token>", "tripId": 123, "seatIds": [1701, 1702], "status": "ACTIVE", "expiresAt": "2026-10-13T10:10:00.000Z" } }`. `expiresAt` là timestamp UTC do backend tính. |
| Retry cùng key | Cùng key + cùng principal/guest scope + cùng payload chuẩn hóa (seat-ID set) khi hold còn active trả lại cùng token và expiry (`200 OK`). Không tạo thêm record hoặc token. Key giống nhưng payload/owner khác trả `409 IDEMPOTENCY_KEY_REUSED`. Key gắn hold đã hết hạn trả `410 HOLD_EXPIRED`; hold đã giải phóng/consume trả `409 HOLD_INACTIVE`; muốn giữ lại phải gửi key mới. |

DTO phải từ chối ID sai kiểu, <= 0, duplicate, mảng rỗng và vượt giới hạn; không âm thầm lọc phần tử sai hoặc giữ một subset. `GET /api/v1/trips/:tripId/seats` hiện trả `tripSeatId`; đó là ID client dùng làm `seatIds`.

### 2.2 Giải phóng hold

| Thuộc tính | Contract |
|---|---|
| Method/path | `DELETE /api/v1/seat-holds` |
| Authentication | Guest hold được giải phóng bằng capability token khi không gửi bearer. Nếu có bearer thì phải là Customer hợp lệ; hold gắn Customer chỉ được giải phóng khi principal resolve về đúng `khachHangId` đã lưu. Không có token không đồng nghĩa được giải phóng hold của người khác. |
| Headers | `X-Hold-Token: <opaque-signed-token>` bắt buộc. Nếu hold thuộc Customer, gửi thêm `Authorization: Bearer <accessToken>` của Customer đó. |
| Request body | Không có. Không nhận `holdToken` trong query/path. Header token không được ghi log. |
| Active hold | `200 OK`, `{ "data": { "tripId": 123, "seatIds": [1701, 1702], "status": "RELEASED" } }`. Chuyển trạng thái hold và mở ghế trong cùng transaction, chỉ đụng đến ghế đang `DANG_GIU` và có `giuChoId` đúng bằng hold hiện tại. |
| Retry sau release | `200 OK` với trạng thái hiện tại `RELEASED`; không thay đổi thêm dữ liệu. |
| Hold expired | Có thể dọn phần liên kết còn sót bằng CAS trong transaction rồi trả `200 OK` với `status: "EXPIRED"`. Expired không được coi là active. |
| Hold consumed | `409 HOLD_ALREADY_CONSUMED`; tuyệt đối không mở ghế đã đặt. |

### 2.3 Xác minh và consume

Không có `GET /seat-holds/:token`, `POST /seat-holds/verify` hay API verify riêng. Một lần đọc riêng rồi mới booking sẽ tạo khoảng TOCTOU. Request tạo booking hiện hữu phải nhận `tripId`, `seatIds` canonical và `holdToken`; phần tích hợp cụ thể thuộc A1/A2 và chính sách booking/guest còn mở.

Trong transaction tạo booking, backend phải:

1. Xác minh cấu trúc/chữ ký/expiry của token; tính SHA-256 token và tìm đúng record `GiuCho.tokenHash`.
2. Bắt buộc record tồn tại, `trangThai = DANG_GIU`, `hetHanLuc > now`, `chuyenXeId = tripId` và owner khớp principal/guest scope.
3. Đọc các `GheChuyenXe` gắn `giuChoId`, xác minh cùng chuyến, cùng số lượng và tập `gheChuyenXeId` chính xác bằng request; từng ghế vẫn `DANG_GIU`.
4. CAS record hold `DANG_GIU → DA_DAT` với điều kiện expiry vẫn còn hiệu lực. Cùng transaction chuyển đúng các ghế giữ bởi `giuChoId` này thành `DA_DAT`, bỏ liên kết hold và tạo các record booking/ticket liên quan.
5. Nếu bất kỳ điều kiện hoặc row count nào không khớp, rollback toàn bộ. Không fallback sang cập nhật ghế `TRONG` hoặc `DANG_GIU` không có hold record.

### HTTP status và error code

| Status | Error code / trường hợp |
|---|---|
| `200 OK` | Release thành công, retry hold đã `RELEASED`, cleanup/retry hold `EXPIRED`, hoặc retry create idempotent còn active. Release expired chỉ dọn linked rows có record hợp lệ; không khôi phục hold. |
| `201 Created` | Tạo hold mới. |
| `400 Bad Request` | `VALIDATION_ERROR` cho thiếu `holdToken` bắt buộc khi booking, thiếu/sai `Idempotency-Key`, sai DTO, mảng rỗng/duplicate/ID không dương/không nguyên/vượt limit; `INVALID_SEATS` nếu business shape bị kiểm tra ở service. Không lọc bỏ một phần IDs. |
| `401 Unauthorized` | `ACCESS_TOKEN_INVALID` khi bearer có mặt nhưng sai/hết hạn; `HOLD_TOKEN_INVALID` khi capability token không đúng cấu trúc/chữ ký. |
| `403 Forbidden` | `CUSTOMER_ONLY`/`CUSTOMER_PROFILE_REQUIRED` cho principal không thuộc Customer flow; `HOLD_OWNERSHIP_MISMATCH` khi principal không khớp hold đã bind. |
| `404 Not Found` | `TRIP_NOT_FOUND`, `TRIP_SEAT_NOT_FOUND` hoặc `HOLD_NOT_FOUND`. Signed token không có DB record luôn trả not-found và không được phép làm thay đổi dữ liệu. |
| `409 Conflict` | `TRIP_NOT_AVAILABLE`, `TRIP_DEPARTED`, `SEAT_UNAVAILABLE`, `HOLD_INACTIVE`, `HOLD_ALREADY_CONSUMED`, `HOLD_TRIP_MISMATCH`, `HOLD_SEATS_MISMATCH`, `IDEMPOTENCY_KEY_REUSED`. Race condition trả conflict ổn định, không trả success envelope. |
| `410 Gone` | `HOLD_EXPIRED` khi booking/consume dùng hold đã hết hạn hoặc create retry trỏ tới cùng key đã hết hạn. DELETE có thể trả `200` trạng thái `EXPIRED` để retry release idempotent. |
| `429 Too Many Requests` | `TOO_MANY_REQUESTS` nếu endpoint rate limit bị vượt. |
| `503 Service Unavailable` | `SERVICE_UNAVAILABLE` khi DB/dependency cần để xác minh hold không dùng được; tuyệt đối không fallback sang token/map. |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` cho lỗi không dự kiến; không trả stack trace, token hoặc DB internals. |

Lỗi trả dạng `{ "statusCode": <HTTP>, "error": "<UPPER_SNAKE_CASE>", "message": "...", "details"?: [...] }`, không dùng `{data:{success:false}}`.

## 3. Owner, guest và token

### Owner và principal

- Hold authenticated lưu `khachHangId` resolve từ `principal.taiKhoanId`; không lấy `customerId`, `khachHangId` hay phone từ body làm bằng chứng ownership.
- Hold guest lưu `khachHangId = null`; mã token opaque là capability cho guest. Không tự liên kết guest hold với account chỉ vì số điện thoại trùng.
- Với hold authenticated, release/booking cần principal Customer cùng `khachHangId`. Thiếu principal, principal khác hoặc token bị chuyển cho người khác trả `403 HOLD_OWNERSHIP_MISMATCH`.
- Guest hold không được tự đổi thành authenticated hold. Nếu khách đăng nhập giữa flow, Web giải phóng hold guest rồi tạo hold mới theo principal Customer.
- Guest booking/claim vẫn là quyết định nghiệp vụ riêng chưa được chốt trong A0. Nếu guest booking chưa được chấp thuận, `POST /bookings` không được consume guest hold hoặc gắn booking vào Customer chỉ bằng phone.

### Token, storage và expiry

- API trả opaque signed bearer token; cấu trúc/claim bên trong không phải public API. Token phải gắn version/audience, trip, tập seat IDs đã sort/deduplicate, owner scope, issued-at, expiry và nonce ngẫu nhiên có entropy cao.
- Dùng HMAC-SHA-256 với `SEAT_HOLD_SECRET` riêng, đủ entropy và được chia sẻ an toàn giữa các instance. So sánh chữ ký constant-time; parser phải validate đầy đủ kiểu/miền của mọi claim. Không dùng `JWT_ACCESS_SECRET` làm fallback; không có secret thì backend fail startup/health check thay vì dùng secret mặc định.
- Chỉ lưu `SHA-256(holdToken)` unique trong DB, không lưu token thô. Mỗi request release/consume luôn đối chiếu hash với record database đang active.
- Web/Mobile gửi token qua TLS: `X-Hold-Token` cho DELETE và field `holdToken` trong POST booking. Không đặt token ở URL, query, analytics, logs, error message hoặc telemetry. Client giữ token trong state/session-scoped storage cần thiết cho flow, xóa sau release/expiry/consume; không dùng `localStorage` dài hạn. `Idempotency-Key` guest phải được sinh ngẫu nhiên bằng CSPRNG, lưu cùng attempt để retry và bảo vệ như capability có thể khôi phục hold; chỉ lưu hash ở backend, không log.
- Token guest bị đánh cắp có quyền capability tương đương đến hết TTL; đây là giới hạn của guest bearer token. Giảm nguy cơ bằng TTL 10 phút, không log/URL, storage ngắn hạn và rate limit. Nếu yêu cầu chống sử dụng token guest bị đánh cắp, cần chốt thêm guest-session proof trước A1; không tuyên bố chữ ký tự nó giải quyết việc này.
- Hết hạn được quyết định bằng thời gian backend/DB, không bằng đồng hồ client. Token hết hạn hoặc record hết hạn đều không active, kể cả khi phần `exp` trên token vẫn chưa hết do lệch dữ liệu.

## 4. Database, CAS, concurrency và cleanup invariants

1. Một hold active phải có đúng một `GiuCho` active trong DB; `tokenHash` unique; `GiuCho.chuyenXeId`, `khachHangId`, expiry và state phải đồng nhất với hold.
2. Mọi seat của hold phải có cùng `giuChoId`, đúng `chuyenXeId`, `trangThai = DANG_GIU`; số lượng và IDs phải trùng khớp payload đã ký. Không có record hoặc thiếu một seat đều làm hold invalid.
3. `POST` tạo `GiuCho` và conditional update các ghế `TRONG → DANG_GIU` kèm `giuChoId` trong một transaction. Kiểm tra update count bằng số ID duy nhất; lệch một ghế phải rollback cả hold và tất cả ghế.
4. Hai request giữ cùng seat bằng key khác nhau: chỉ một transaction thành công; transaction còn lại trả `409 SEAT_UNAVAILABLE`. Multi-seat request là all-or-nothing.
5. Release và booking consume cạnh tranh trên cùng hold phải CAS cùng state record `DANG_GIU`; chỉ một bên thắng. Nếu release thắng thì booking rollback và ghế về `TRONG`; nếu booking thắng thì hold `DA_DAT`, ghế `DA_DAT` và release không được mở ghế.
6. Cleanup active hold hết hạn chỉ được CAS record còn `DANG_GIU` và đã hết hạn sang `HET_HAN`, sau đó clear seat rows còn trỏ đúng `giuChoId` trong cùng transaction. Nhiều instance chạy cleanup phải an toàn khi chạy lặp/đồng thời. Không cập nhật status chỉ theo ID sau khi đã query trước đó.
7. Cleanup không được đổi `DANG_GIU → TRONG` cho row có `giuChoId = null` hoặc không có record `GiuCho`. Orphan legacy cần quy trình reconciliation có kiểm soát; không được tự coi ghế là hết hạn dựa riêng `updatedAt`.
8. In-memory `Map`/`setTimeout` không tham gia quyết định ownership, active state hay quyền booking. Restart hoặc request sang instance khác không đổi kết quả khi DB và shared signing secret giống nhau.
9. DB unavailable, bảng/delegate không dùng được, record thiếu hoặc trạng thái không khớp phải fail closed. Không trả success giả hoặc dùng token claims để cập nhật booking/seat.
10. Prisma transaction bảo đảm all-or-nothing; dùng conditional writes/CAS và kiểm tra row count, không dựa riêng vào pre-read. Nếu retry deadlock/write conflict, chỉ retry lỗi transient đã xác định, có giới hạn, và giữ nguyên idempotency key. Đối chiếu hành vi của adapter MariaDB/MySQL thực tế trong A1; tài liệu Prisma về [transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) không thay thế test concurrency trên DB/adapter dự án.

## 5. TTL hold và booking/payment timeout

`expiresAt = thời điểm backend tạo hold + 10 phút`; hold chỉ bảo vệ ghế trước khi tạo booking. Public status `ACTIVE` ánh xạ DB `DANG_GIU`, `RELEASED` ánh xạ `DA_GIAI_PHONG`, `EXPIRED` ánh xạ `HET_HAN`, và consume ánh xạ `DA_DAT`. Khi `POST /bookings` consume thành công, state hold chuyển `DA_DAT`, seat chuyển `DA_DAT` và thời hạn giữ ghế kết thúc. Không kéo dài hold để bao phủ payment timeout và không để expiry worker giải phóng seat của booking đã tạo.

Booking/payment timeout phải là lifecycle riêng của `DonGiaoDich`/`PhieuDatVe`. Khi payment/order hết hạn, workflow tương ứng phải CAS state order/booking và ghế trong transaction riêng theo policy đã chốt; không dùng hold TTL làm timeout payment. Snapshot schema hiện tại không có `hetHanLuc` trong `DonGiaoDich` hoặc `PhieuDatVe`, nên A0 không đặt giá trị payment timeout và không khẳng định workflow timeout đã có. Đây là quyết định còn mở trước khi test end-to-end payment.

## 6. Bảng endpoint cũ và mới

| Hiện trạng | Quyết định canonical / compatibility |
|---|---|
| `POST /api/v1/seat-holds` trên `origin/develop`, body `{tripId, seatIds}` | Giữ làm endpoint canonical; bổ sung idempotency và validation chặt; IDs chỉ là `gheChuyenXeId`. |
| `DELETE /api/v1/seat-holds` trên `origin/develop`, hiện nhận `X-Hold-Token` hoặc body `holdToken` | Giữ path; canonical chỉ nhận `X-Hold-Token`, optional principal để enforce owner Customer. Nếu cần transitional body support cho client đã phát hành thì đặt ngày deprecation và bỏ sau migration; body không được là contract mới. |
| `DELETE /api/v1/seat-holds/:holdToken` trên `origin/develop` | Deprecated vì capability nằm trong URL. Giữ tạm chỉ để tương thích client đã phát hành, route phải delegate cùng DB verification/ownership/CAS và logger phải redact; xóa sau khi inventory xác nhận mọi Web/Mobile client đã chuyển header. |
| `POST /api/v1/trips/:tripId/seat-holds` trên PR #36, dùng `seatNumbers`, không tạo `GiuCho`/token | Xóa trước rollout. Đây là endpoint PR-only, duplicate và không có ownership/expiry invariant; Web wrapper hiện không có call site. Không giữ như alias tạo hold. |
| `DELETE /api/v1/trips/:tripId/seat-holds` trên PR #36, dùng `seatNumbers` và không token | Xóa trước rollout; không có cơ sở ownership để giải phóng seat. |
| Verify endpoint riêng | Không thêm. Xác minh active hold nằm trong transaction `POST /bookings` để tránh TOCTOU. |

## 7. Đối chiếu source và findings cần sửa ở A1

`SeatHoldsController`, `SeatHoldsService` và DTO hold ở PR HEAD có cùng blob SHA với `origin/develop`; PR thêm nested routes trong `TripsController/TripsService` và Web wrappers trong `apps/web/src/features/trips/services/trips.api.ts`. Vì vậy implementation develop có token/DB/CAS tốt hơn nested PR flow ở một số điểm, nhưng chưa đáp ứng contract fail-closed.

### Findings cụ thể

- `apps/api/src/seat-holds/seat-holds.service.ts:51-53`: `holdSecret` fallback sang literal tĩnh nếu `JWT_ACCESS_SECRET` thiếu. Môi trường/service được khởi tạo mà không có access secret sẽ dùng key forgeable đã biết; việc dùng chung key còn gắn vòng đời hold-token với key auth. Cần dedicated secret bắt buộc, không có fallback.
- `:168-187`: parser so chữ ký bằng `!==` và cast payload JSON không kiểm tra schema/miền claim. Dùng constant-time compare và validate payload trước khi dùng.
- `:522-539`: `verifyHold()` chấp nhận hold từ in-memory map hoặc dựng lại từ signed token; không đọc DB nên không biết record đã release/consume/không tồn tại chưa.
- `:599-605, 661-699`: `consumeHoldInTx()` đọc DB nhưng khi không tìm thấy `dbHold` lại gọi `verifyHold()` và trả `giuChoId: 0`. Booking sau đó có nhánh `apps/api/src/bookings/bookings.service.ts:731-749` cập nhật ghế `TRONG` hoặc `DANG_GIU` mà không cần `GiuCho`. Đây là fail-open production cần loại bỏ; thiếu record phải rollback với `HOLD_NOT_FOUND`/`HOLD_INACTIVE`.
- `seat-holds.service.ts:566-575, 629-637`: ownership chỉ bị từ chối khi cả `hold.customerId` và `expectedCustomerId` truthy. Hold của Customer có thể qua khi caller guest/không có Customer ID; guest hold cũng có thể bị consume bởi authenticated account. So sánh owner scope chính xác, bao gồm `null`.
- `:137-149`: cleanup fallback tự mở mọi ghế `DANG_GIU` không có `giuChoId` nếu `updatedAt` cũ hơn 10 phút. Vi phạm invariant DB-record; bỏ nhánh này khỏi production.
- `:483-500`: release fallback dùng claims/map khi không tìm thấy DB record và có thể mở seat `DANG_GIU`/`giuChoId = null`. Không fallback; token hợp lệ nhưng không có record phải không thay đổi DB.
- `:125-129`: cleanup đổi `GiuCho` sang `HET_HAN` theo ID list đã query trước, không CAS `trangThai = DANG_GIU` và expiry trong update. Khi cleanup đua với consume có thể ghi đè trạng thái `DA_DAT`; conditional update count phải là gate trước khi release seats.
- `:243-267`: create chấp nhận fallback `gheId`; canonical `seatIds` phải chỉ là `gheChuyenXeId`, nếu không ID hai namespace trùng có thể chọn nhầm seat. `CreateSeatHoldDto` và service cũng chưa chặn duplicate/ID không hợp lệ chặt, và service lọc bỏ ID sai thay vì từ chối cả request.
- `createSeatHold()` hiện có CAS `TRONG → DANG_GIU`, gắn `giuChoId` và kiểm tra update count trong transaction (`:302-351`); giữ invariant này trong A1, đồng thời bảo đảm nhánh thiếu DB không làm CAS token-only.
- `consumeHoldInTx()` kiểm tra expiry trước CAS nhưng CAS status `DANG_GIU` chưa kèm điều kiện `hetHanLuc > now` (`:615-667`). Include expiry predicate ngay trong conditional write để hết hạn giữa check và CAS vẫn bị từ chối.
- Release controller không truyền principal vào service (`seat-holds.controller.ts:35-53`), nên chưa thể enforce authenticated owner ở release. Header token alone is capability; authenticated holds cần principal tương ứng.

### Caller và phạm vi client

- Customer Web `getTripSeats()` đọc `tripSeatId` và `seatNumber` ở `apps/web/src/features/trips/services/trips.api.ts:104-109`; component hiện giữ lựa chọn dưới dạng `seatNumber` và `one-way-booking.tsx:847-858`/`round-trip-booking.tsx:1074-1084` gửi `seatNumbers` khi tạo booking.
- `tripsApi.holdSeats()`/`releaseSeats()` gọi nested route với `seatNumbers` tại `trips.api.ts:127-147`; text search không thấy component gọi hai wrapper này. A2 phải nối UI qua `tripSeatId`, giữ token theo vòng đời checkout, release/expiry handling và gửi `holdToken` cùng `seatIds` vào booking.
- API Customer seat map là public read snapshot; Admin dùng `GET /trips/:id/seat-inventory` theo quyền tenant, không thấy Admin gọi create/release customer hold. Không thay inventory endpoint.
- Repository không có `apps/mobile`; chưa xác định được caller mobile ngoài repo. Trước khi xóa route legacy từ `origin/develop`, cần inventory app đã phát hành. Không có caller trong repo không chứng minh không có client ngoài.

### GitNexus và tài liệu đã đối chiếu

GitNexus registry trỏ về repo gốc ở commit `da6488d` (cũ hơn `origin/develop` 18 commit), không có `.codegraph/` trong worktree; truy vấn symbols của seat hold không resolve đúng cho worktree này. Vì graph không đủ tin cậy, caller và source findings được xác nhận trực tiếp bằng hai snapshot Git và `rg`; không dùng graph làm bằng chứng không có caller. Tài liệu đối chiếu: `AGENTS.md`, `docs/nhiem-vu/rule-api.md`, tài liệu audit semantic Phase 0 được yêu cầu đọc, `docs/pr36-reconciliation/ENDPOINT_NORMALIZATION.md`, Prisma schema và code hiện tại. Context7 đã đối chiếu hướng dẫn Prisma transaction; không chạy migration hay DB.

## 8. Acceptance criteria cho A1/A2

### A1 — API/service

- Fresh guest hold trả `201`, đúng envelope, unique sorted `tripSeatId`s, `expiresAt` đúng 10 phút; DB có một `GiuCho DANG_GIU` và mọi seat row trỏ đến đúng `giuChoId`.
- Authenticated Customer hold lưu đúng `khachHangId`; Admin/employee, account không có Customer profile và bearer invalid bị xử lý theo contract.
- Duplicate IDs, ID sai/<=0, `gheId`, `seatNumbers`, seat thuộc chuyến khác, chuyến không bookable và request vượt giới hạn đều bị từ chối; không partial hold.
- Cùng `Idempotency-Key` + cùng payload/principal khi active trả cùng token; cùng key khác payload/owner trả conflict; timeout retry không sinh token/record mới.
- Thiếu/sai/chỉnh sửa chữ ký, signature key sai, token hết hạn, DB record không tồn tại, record terminal, owner sai, trip sai, seat set thiếu/thừa/sai hoặc seat linkage/state sai đều không thể verify/consume/release nhầm.
- Authenticated token bị dùng bởi guest/customer khác không release/consume được. Guest capability behavior và giới hạn token theft có test riêng.
- Release active rồi retry là idempotent; release consumed không đổi `DA_DAT`; release unknown/invalid token không sửa bất kỳ seat nào.
- Hai request giữ cùng một seat và request multi-seat có một seat tranh chấp tạo đúng một outcome, rollback hoàn toàn phía thua.
- Race release-vs-booking consume có đúng một terminal state nhất quán; race cleanup-vs-consume không ghi đè `DA_DAT`; cleanup nhiều instance chạy lặp không mở ghế orphan hoặc ghế booked.
- Restart app, request được route tới instance khác và DB unavailable không kích hoạt in-memory/token-only fallback.
- Test integration concurrency chạy trên MySQL/MariaDB adapter thực tế; unit mock không thay thế test transaction/CAS. Test hiện có tại `apps/api/test/integration/seat-holds/seat-holds-concurrency.spec.ts` là baseline, cần bổ sung các case fail-closed/cleanup ở trên.

### A2 — Customer Web/API callers

- Seat map selection giữ `tripSeatId` làm ID; label `seatNumber` chỉ dùng hiển thị. Request hold và booking gửi cùng tập `seatIds`.
- Create hold gửi một `Idempotency-Key` cho logical attempt, retry mạng dùng lại key; token chỉ ở state/session-scoped storage và không xuất hiện trong URL/log.
- Không gửi booking trước khi hold tạo thành công; booking gửi hold token và nhận lỗi code ổn định; seat conflict refresh sơ đồ và yêu cầu chọn lại.
- Khi user bỏ chọn/hủy/đổi chuyến, release token hiện tại; UI xử lý `RELEASED`, `EXPIRED`, `HOLD_ALREADY_CONSUMED`, timeout và 401/403 mà không hiển thị hold giả.
- Khi hold expired, không cho UI tiếp tục booking bằng cache cũ; tạo hold mới cần lựa chọn/attempt mới và idempotency key mới.
- Mỗi booking leg được hỗ trợ phải có hold riêng. Multi-leg booking contract hiện chưa có; A2 không được giả định một outbound hold bảo vệ leg còn lại.
- Unit/component tests thực thi interactions và fetch/API requests thật của service layer: map seat number→tripSeatId, create/retry, release, error, expiry, booking body và cleanup/unmount. Admin seat inventory không bị ảnh hưởng.

## 9. Postman smoke checklist

Chuẩn bị environment local: `baseUrl=http://localhost:<api-port>/api/v1`, `tripId`, `tripSeatId`, một Customer bearer token nếu test authenticated. Không lưu token hold thật vào collection hoặc commit collection có credential.

1. `POST {{baseUrl}}/seat-holds`, `Idempotency-Key: <uuid>`, body `{ "tripId": {{tripId}}, "seatIds": [{{tripSeatId}}] }`; kiểm tra `201`, `data.holdToken`, `data.seatIds`, `status=ACTIVE`, `expiresAt` UTC và seat map chuyển `DANG_GIU`.
2. Gửi lại đúng request + cùng key; kiểm tra trả lại cùng token/expiry và không phát sinh hold thứ hai.
3. Dùng key khác để giữ cùng seat; kiểm tra `409 SEAT_UNAVAILABLE`, không có hold/seat update một phần.
4. Gọi `DELETE {{baseUrl}}/seat-holds` với `X-Hold-Token`; authenticated hold phải kèm bearer đúng owner. Kiểm tra `200 RELEASED`, seat `TRONG`; retry cùng token trả cùng terminal state.
5. Tạo hold mới rồi gọi booking với đúng `tripId`, `seatIds`, `holdToken`; chỉ xác nhận consume khi API booking thật thành công. Kiểm tra hold `DA_DAT`/seat `DA_DAT`; gọi DELETE sau consume phải `409 HOLD_ALREADY_CONSUMED`, seat vẫn booked.
6. Lặp thử token bị sửa, token không có DB record, Customer khác, guest-vs-auth mismatch, trip khác, seat ID thiếu/thừa và seat không thuộc chuyến; kiểm tra mã lỗi ổn định và DB/seat không đổi.
7. Với test environment riêng, chờ quá 10 phút rồi thử consume; phải nhận `410 HOLD_EXPIRED`. Sau cleanup, ghế chỉ được mở nếu có record hold hết hạn và `giuChoId` khớp.
8. Sau khi đã migrate client ngoài repo, kiểm tra nested `POST/DELETE /trips/:tripId/seat-holds` không còn được phục vụ; token path alias chỉ còn trong thời gian deprecation đã công bố.

## 10. Quyết định còn mở

1. **Guest booking:** chính sách guest ownership cần quyết định riêng. Seat hold guest có thể tồn tại như capability ngắn hạn; quyền consume vào guest booking và cách claim booking chưa được tự quyết trong A0.
2. **Idempotency persistence:** schema `GiuCho` hiện có `tokenHash` unique, trip, nullable Customer, expiry, status và liên kết seat nhưng không có idempotency key. A1 cần migration thêm hash/key mapping unique, ràng buộc owner scope + payload (hoặc storage bền vững tương đương) trước khi coi POST retry là idempotent.
3. **Secret config/rotation:** A1 cần thêm `SEAT_HOLD_SECRET` vào config contract/template riêng, quyết định version/key rotation và bảo đảm mọi API instance dùng cùng key. A0 không sửa `.env`.
4. **Giới hạn số ghế mỗi hold:** chọn theo giới hạn số vé/booking nghiệp vụ hiện hành; DTO phải áp một giới hạn hữu hạn trước rollout.
5. **Client compatibility:** kiểm kê Customer Mobile/client đã phát hành trước khi bỏ `DELETE /seat-holds/:holdToken`; repo hiện không chứa app mobile.
6. **Payment timeout:** schema hiện không biểu diễn expiry cho `DonGiaoDich`/`PhieuDatVe`; owner payment/booking cần chốt timeout, cancellation và giải phóng seat riêng trước khi A2 test toàn flow.
7. **Orphan legacy seats:** quy trình reconciliation có kiểm soát cho `DANG_GIU` thiếu `GiuCho` cần được quyết định vận hành. Cleanup runtime không được tự mở các row này.

---

**Phạm vi A0:** chỉ chốt contract và ghi nhận source findings. Các thay đổi code, test, config, schema/migration và review conversations để nguyên cho các task được giao riêng.
