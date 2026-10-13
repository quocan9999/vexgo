# TASK A0.1 — Hoàn thiện đặc tả API giữ ghế

Ngày cập nhật: 13-10-2026

- Worktree: `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-pr36-integration`
- Branch: `fix/pr36-integration`
- PR HEAD: `6b52356b748f3db3f42215614d8ff3db97a3ddc7`
- `origin/develop`: `21e41783741c1db88040d29ac9fa590e15c1caf1`
- Merge-base: `21e41783741c1db88040d29ac9fa590e15c1caf1`

> Bản A0.1 bổ sung đặc tả idempotency/token recovery và chống lạm dụng guest theo review. Chỉ cập nhật tài liệu; không thay đổi implementation, DTO, schema, migration, test hay database. Contract dưới đây là đích triển khai A1/A2, không mô tả rằng code hiện tại đã đáp ứng đầy đủ.

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
| Headers | `Idempotency-Key: <UUID v4 ngẫu nhiên>` bắt buộc cho một lần tạo logic; `Authorization: Bearer <accessToken>` tùy trường hợp. Guest phải gửi cookie session ẩn danh do backend cấp; không nhận `guestId`/session ID tự khai trong header hoặc body. |
| Request body | `{"tripId": 123, "seatIds": [1701, 1702]}`. `tripId` và mỗi `seatId` là số nguyên dương; mảng không rỗng, không trùng ID và giới hạn đề xuất là 6 ghế/hold (theo nội dung Customer Web hiện có; API hiện chưa enforce). Backend chuẩn hóa IDs tăng dần để ký token và tính fingerprint idempotency. Không nhận `seatNumbers` hay `gheId`. |
| Tạo mới | `201 Created`, `{ "data": { "holdToken": "<opaque-signed-token>", "tripId": 123, "seatIds": [1701, 1702], "status": "ACTIVE", "expiresAt": "2026-10-13T10:10:00.000Z" } }`. `expiresAt` là timestamp UTC do backend tính. |
| Retry cùng key | Cùng key + cùng principal/session scope + cùng payload chuẩn hóa khi hold còn active trả chính xác cùng token và expiry (`200 OK`), kể cả sau restart. Key giống nhưng payload/owner/session khác trả `409 IDEMPOTENCY_KEY_REUSED`. Hold đã hết hạn trả `410 HOLD_EXPIRED`; đã giải phóng trả `409 HOLD_INACTIVE`; đã consume trả `409 HOLD_ALREADY_CONSUMED`. Không dùng lại key terminal để tạo hold mới. |

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
| `403 Forbidden` | `CUSTOMER_ONLY`/`CUSTOMER_PROFILE_REQUIRED` cho principal không thuộc Customer flow; `HOLD_OWNERSHIP_MISMATCH` khi principal không khớp hold đã bind; `GUEST_SESSION_REQUIRED` khi guest cookie thiếu, sai chữ ký hoặc hết hạn. |
| `404 Not Found` | `TRIP_NOT_FOUND`, `TRIP_SEAT_NOT_FOUND` hoặc `HOLD_NOT_FOUND`. Signed token không có DB record luôn trả not-found và không được phép làm thay đổi dữ liệu. |
| `409 Conflict` | `TRIP_NOT_AVAILABLE`, `TRIP_DEPARTED`, `SEAT_UNAVAILABLE`, `ACTIVE_HOLD_LIMIT_REACHED`, `HOLD_INACTIVE`, `HOLD_ALREADY_CONSUMED`, `HOLD_TRIP_MISMATCH`, `HOLD_SEATS_MISMATCH`, `IDEMPOTENCY_KEY_REUSED`. Đây là xung đột trạng thái/quota đồng thời, không phải throttle theo thời gian. |
| `410 Gone` | `HOLD_EXPIRED` khi booking/consume dùng hold đã hết hạn hoặc create retry trỏ tới cùng key đã hết hạn. DELETE có thể trả `200` trạng thái `EXPIRED` để retry release idempotent. |
| `429 Too Many Requests` | `TOO_MANY_REQUESTS` khi vượt rate limit theo thời gian; phải có `Retry-After`. Không dùng 429 cho hold đang active hoặc seat conflict. |
| `503 Service Unavailable` | `SERVICE_UNAVAILABLE` khi DB/dependency cần để xác minh hold không dùng được; `IDEMPOTENCY_REPLAY_UNAVAILABLE` khi metadata/key theo `kid` cần để tái tạo token không dùng được. Tuyệt đối không fallback sang token/map hoặc ký token thay thế. |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` cho lỗi không dự kiến; không trả stack trace, token hoặc DB internals. |

Lỗi trả dạng `{ "statusCode": <HTTP>, "error": "<UPPER_SNAKE_CASE>", "message": "...", "details"?: [...] }`, không dùng `{data:{success:false}}`.

## 3. Owner, guest và token

### Owner và principal

- Hold authenticated lưu `khachHangId` resolve từ `principal.taiKhoanId`; không lấy `customerId`, `khachHangId` hay phone từ body làm bằng chứng ownership.
- Hold guest lưu `khachHangId = null` và phải bind thêm `guestSessionHash` từ cookie ẩn danh do backend phát hành. Cookie là định danh phiên cho quota/abuse control, không phải xác minh danh tính con người; không tự liên kết guest hold với account chỉ vì số điện thoại trùng.
- Cookie guest phải chứa entropy cao, được backend ký hoặc đối chiếu với session record; đặt `HttpOnly`, `SameSite=Lax` (hoặc chặt hơn nếu flow cho phép), `Secure` ở production, host-only và gửi qua TLS. Session ID phải ổn định ít nhất trong TTL hold và cửa sổ retry được duyệt; cookie không được rotate trước khoảng này. Cookie/session phải còn hiệu lực ít nhất hết TTL hold và cửa sổ retry được duyệt. Backend lưu hash/HMAC của session ID, không lưu cookie thô. Nếu ký cookie, dùng key có mục đích riêng hoặc key derivation domain-separated, không tái dùng trực tiếp JWT/hold secret. Không tin `X-Guest-ID`, IP hay một header tự khai là principal.
- Guest hold chỉ được tạo sau khi trình duyệt có session cookie hợp lệ. Source hiện chưa có cơ chế guest-session này; chủ dự án cần chốt dùng bootstrap/middleware hiện có hay bổ sung API cấp session riêng trước A1.4. Nếu chưa có proof server-issued, không coi request anonymous hiện tại là đã có session đáng tin cậy.
- Với hold authenticated, release/booking cần principal Customer cùng `khachHangId`. Thiếu principal, principal khác hoặc token bị chuyển cho người khác trả `403 HOLD_OWNERSHIP_MISMATCH`.
- Guest hold không được tự đổi thành authenticated hold. Nếu khách đăng nhập giữa flow, Web giải phóng hold guest rồi tạo hold mới theo principal Customer.
- Guest booking/claim vẫn là quyết định nghiệp vụ riêng chưa được chốt trong A0. Nếu guest booking chưa được chấp thuận, `POST /bookings` không được consume guest hold hoặc gắn booking vào Customer chỉ bằng phone.

### Token, storage và expiry

- API trả opaque signed bearer token; cấu trúc/claim bên trong không phải public API. Token phải gắn version, key ID (`kid`), audience, trip, tập seat IDs đã sort/deduplicate, owner scope, issued-at, expiry và nonce ngẫu nhiên có entropy cao. Serializer/field order phải canonical và versioned để cùng claims + cùng key tạo ra đúng chuỗi token ban đầu.
- Dùng HMAC-SHA-256 với key riêng cho seat hold, đủ entropy và được chia sẻ an toàn giữa các instance. Key ID chọn đúng key trong keyring; so sánh chữ ký constant-time và validate schema/miền từng claim. Không dùng `JWT_ACCESS_SECRET` làm fallback; thiếu key cần thiết thì fail closed, không dùng secret mặc định hoặc tạo hold khác thay cho retry.
- `GiuCho.tokenHash` hiện lưu SHA-256 token unique; không lưu token thô. Chỉ hash không thể khôi phục token mà client chưa nhận được. Để thực hiện retry sau response loss/restart, lưu thêm hash Idempotency-Key unique, fingerprint request+owner, guest session hash (nếu guest), nonce, token version và `kid`; dùng `GiuCho.createdAt` chính xác làm `iat`, `hetHanLuc` làm `exp`, cùng `chuyenXeId`, `khachHangId`/guest scope và danh sách `GheChuyenXe` gắn với hold để dựng lại cùng claims. Sau khi ký lại phải so `SHA-256(token)` với `GiuCho.tokenHash`; mismatch hoặc thiếu key/metadata phải fail closed và báo lỗi vận hành, không trả token khác.
- Retry chỉ trả token khi record DB còn `DANG_GIU` và chưa hết hạn. Không thể khôi phục nguyên token bằng cách ký lại claims hiện tại: source đang sinh `nonce=randomUUID()` nhưng không lưu nonce, `kid` hay Idempotency-Key trong DB. Token client đã có vẫn parse được sau restart; điều đó không giải quyết trường hợp response tạo hold bị mất và client chỉ còn key.
- Web/Mobile gửi token qua TLS: `X-Hold-Token` cho DELETE và field `holdToken` trong POST booking. Không đặt token ở URL, query, analytics, logs, error message hoặc telemetry. Client giữ token trong state/session-scoped storage cần thiết cho flow, xóa sau release/expiry/consume; không dùng `localStorage` dài hạn. `Idempotency-Key` guest phải được sinh ngẫu nhiên bằng CSPRNG, lưu cùng attempt để retry và bảo vệ như capability có thể khôi phục hold; chỉ lưu hash ở backend, không log.
- Token guest bị đánh cắp có quyền capability tương đương đến hết TTL; đây là giới hạn của guest bearer token. Giảm nguy cơ bằng TTL 10 phút, không log/URL, storage ngắn hạn và ràng buộc hold với guest session. Session cookie cũng có thể bị đánh cắp/xóa; nó là khóa quota chứ không phải danh tính đã xác minh. Nếu cần chống abuse bởi người dùng đổi cookie/IP liên tục, chủ dự án phải duyệt bước xác minh bổ sung (ví dụ OTP/anti-bot challenge); A0.1 không triển khai CAPTCHA hay flow xác minh mới.
- Hết hạn được quyết định bằng thời gian backend/DB, không bằng đồng hồ client. Token hết hạn hoặc record hết hạn đều không active, kể cả khi phần `exp` trên token vẫn chưa hết do lệch dữ liệu.

### Idempotency bền vững và phương án khôi phục token

**Khuyến nghị: ký lại token một cách xác định từ metadata hold lưu bền vững; không lưu token rõ và không chỉ lưu hash.** Đây phù hợp hơn với VexGo hiện có `GiuCho`/MySQL và Node `crypto`, không cần thêm dịch vụ mã hóa hay dependency. Đây là đề xuất schema/API cho task sau, không phải schema đã có.

1. `Idempotency-Key` là UUID ngẫu nhiên do client tạo bằng CSPRNG. Backend chỉ lưu `SHA-256(Idempotency-Key)`; trường hash có unique constraint toàn cục để một key không thể gắn với hai owner/payload. Không dùng key như thông tin đăng nhập; replay vẫn phải khớp owner scope và fingerprint.
2. Fingerprint được tính từ phiên bản operation, `tripId`, danh sách `seatIds` đã sort, và owner scope chuẩn hóa (`customer:<khachHangId>` hoặc `guest:<guestSessionHash>`). Không đưa token thô, cookie hay PII vào fingerprint.
3. Trong cùng transaction, lưu metadata idempotency/token, tạo `GiuCho`, và CAS toàn bộ seat `TRONG → DANG_GIU`. Tối thiểu lưu `idempotencyKeyHash` (unique), `requestFingerprint`, `guestSessionHash` khi guest, `nonce`, `tokenVersion`, `signingKeyId`, `createdAt/iat`, `hetHanLuc/exp`, owner/trip hiện có và liên kết ghế. `tokenHash` hiện tại tiếp tục unique. Lỗi seat conflict rollback cả key mapping/metadata; không để idempotency record mồ côi.
4. Trước tạo mới, tìm `idempotencyKeyHash`. Nếu tồn tại, so owner scope và fingerprint; lệch trả `409 IDEMPOTENCY_KEY_REUSED`. Nếu cùng request và `DANG_GIU` chưa hết hạn, dựng token bằng serializer canonical + đúng key ID, kiểm tra hash khớp DB rồi trả token/expiry cũ (`200`). Không đổi nonce, expiry hoặc state.
5. Nếu hai request cùng key chạy đồng thời, unique constraint là trọng tài cuối. Request thua rollback transaction, đọc record thắng sau transaction và đi qua cùng kiểm tra owner/fingerprint/state; response chỉ có thể chứa một token. Retry lỗi unique/deadlock có giới hạn, không tạo request key mới.
6. Record cùng key ở `HET_HAN` trả `410 HOLD_EXPIRED`; `DA_GIAI_PHONG` trả `409 HOLD_INACTIVE`; `DA_DAT` trả `409 HOLD_ALREADY_CONSUMED`. Không tái cấp ghế hoặc tạo token mới dưới key cũ. Request mới sau khi khách chủ động release/hold terminal phải dùng key mới.
7. Giữ key hash/tombstone lâu bằng thời gian idempotency được hỗ trợ. Khuyến nghị ban đầu là giữ cùng lịch sử `GiuCho` và không xóa key fingerprint; nếu về sau purge hold history, phải giữ tombstone unique tương đương hoặc chốt thời hạn retry/key format có timestamp trước khi xóa. Xóa idempotency row rồi nhận lại cùng UUID không được âm thầm tạo lần giữ mới.

**Secret rotation:** token có `kid`; mọi API instance chia sẻ keyring đồng nhất và cùng active `kid`. Khi rotate, triển khai key mới cùng key cũ ở chế độ verify trước, chuyển active `kid` sau, rồi chỉ retire key cũ khi không còn hold/key replay nào cần tái tạo hoặc xác minh token của key đó. Vì token active tối đa 10 phút, đó là mức tối thiểu cộng clock skew/deploy overlap; nếu cho phép retry/release terminal vô thời hạn thì key cũ phải được giữ để verify hoặc cần chốt thời hạn terminal-token acceptance. Thiếu key theo `kid` phải fail closed; không đổi key rồi ký token mới cho cùng Idempotency-Key.

**Phương án khác:**

- Chỉ lưu SHA-256 token: loại vì không khôi phục được bearer token sau response loss; đây là trạng thái hiện tại.
- Lưu token rõ: loại vì dump DB/log/backup sẽ trực tiếp lộ capability có thể release/consume hold.
- Lưu token đã mã hóa AEAD (ví dụ AES-256-GCM), kèm nonce/tag/key ID và AAD gắn với `giuChoId`/key hash: khả thi nếu không thể tái tạo claims, nhưng cần encryption key tách biệt với signing key, keyring/rotation/backup/restore và xử lý ciphertext hỏng. Không khuyến nghị làm phương án đầu vì không cần thiết nếu claims được lưu ổn định.
- Tái tạo từ các trường hiện có mà không lưu nonce/key ID: loại vì nonce ngẫu nhiên không thể suy ra từ `tokenHash`; ký lại sẽ tạo token khác và hash không khớp.

### Giới hạn và chống lạm dụng guest

Guest cookie là pseudonymous session, không phải xác thực danh tính. Đề xuất giới hạn ban đầu, cần chủ dự án phê duyệt và cho phép cấu hình phía backend (không hard-code UI):

| Phạm vi | Giới hạn đề xuất ban đầu | Ý nghĩa |
|---|---:|---|
| Guest session | Tối đa 1 hold group active và 6 ghế active cùng lúc | Các tab cùng browser/session dùng chung quota; request thứ hai với key khác không giữ thêm ghế. |
| Customer account | Tối đa 2 hold group active và 12 ghế tổng | Cho phép hai checkout/tab đồng thời nhưng chặn giữ hàng loạt bằng nhiều key. |
| Một hold | Tối đa 6 ghế | Khớp giới hạn đang hiển thị trong Customer Web; API và booking phải kiểm tra server-side. |
| Guest session rate | Tối đa 5 lần tạo hold mới/10 phút | Đếm request key mới sau validation; rate window phải dùng chung giữa instance. |
| Customer rate | Tối đa 10 lần tạo hold mới/10 phút | Theo `khachHangId` đã resolve từ principal. |
| Client IP rate | Tối đa 30 lần tạo hold mới/10 phút | Chỉ là lớp bổ sung, có ngưỡng cao để giảm ảnh hưởng NAT; lấy IP từ socket/proxy được cấu hình tin cậy. |

- Một replay Idempotency-Key cùng payload/owner không tiêu quota hold mới hoặc tăng active count, nhưng vẫn chịu request-level throttle nhẹ để chống flood replay/key guessing. Tính attempt mới cho mọi key mới hợp lệ, kể cả request cuối cùng gặp `SEAT_UNAVAILABLE`; nếu chỉ đếm thành công, spam ghế đã có thể dùng để dò tài nguyên.
- Giới hạn active phải được serialize/kiểm tra atomically trên DB theo owner scope trong cùng transaction với tạo/release/expire/consume. Hai request key khác nhau cùng session/account đến hai API instance đồng thời không được cùng vượt quota. Quota chỉ được hoàn lại sau khi terminal state được commit.
- Rate limiter theo session/account/IP phải dùng shared storage trong production nhiều instance. Repo đã cài `@nestjs/throttler` nhưng không thấy guard/decorator trên SeatHolds; default storage của package là in-memory, nên chỉ dùng mặc định không chia sẻ counter qua restart/instance. Ưu tiên reuse gateway/storage dùng chung nếu hạ tầng đã có; nếu chưa, cần thiết kế counter bền vững/shared trên MySQL và migration riêng trước rollout. Không thêm Redis/dependency trong A0.1.
- IP chỉ dùng như một tín hiệu rate-limit bổ sung; chỉ tin `request.ip` sau cấu hình trusted proxy cụ thể, không lấy nguyên `X-Forwarded-For` do client gửi. Rate store nên lưu HMAC/hash IP kèm TTL thay vì IP thô. Nhiều khách chung NAT không bị tính chung active-hold quota; chỉ cùng chịu IP request threshold, nên threshold phải đủ cao và có metric để hiệu chỉnh.
- Đổi IP không làm mất quota session cookie; đổi/xóa cookie hoặc nhiều browser có thể tạo session mới, vì cookie không chứng minh người thật. Nếu abuse phân tán vẫn vượt ngưỡng, cần chủ dự án duyệt yêu cầu login/verified phone hoặc risk-based anti-bot challenge. A0.1 chỉ ghi nhận quyết định này, không triển khai CAPTCHA/OTP.
- Nhiều tab cùng session: tab đầu tạo hold; tab khác cùng key/payload nhận lại cùng token, khác key khi đã chạm active cap nhận `409 ACTIVE_HOLD_LIMIT_REACHED` và UI hướng người dùng tiếp tục tab cũ hoặc release hold. Refresh giữ cookie và `Idempotency-Key`/token trong session storage để retry đúng attempt; không tạo key mới tự động khi request timeout.
- `409` dành cho trạng thái/domain quota không thể thỏa bằng chờ (`SEAT_UNAVAILABLE`, `ACTIVE_HOLD_LIMIT_REACHED`, key reuse khác payload/owner); `429` dành cho bucket thời gian bị vượt và phải kèm `Retry-After`. Hai loại lỗi không thay thế nhau.

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
11. `idempotencyKeyHash` có unique constraint; record lưu request fingerprint, owner/session scope và metadata đủ để tái tạo token. Hash key, `GiuCho`, quota owner và cập nhật seat được commit/rollback cùng nhau. Nếu unique race xảy ra, request thua phải đọc lại winner sau rollback và xác minh owner, payload, state.
12. Mỗi owner scope có quota row/lock key duy nhất để serialize kiểm tra active hold trên MySQL; create/release/expire/consume cập nhật quota cùng transaction và không vượt giới hạn khi nhiều API instance xử lý đồng thời. Rate windows cũng dùng shared storage, không dựa vào process-local memory.

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
- `:22-30, 314-331`: token có nonce `randomUUID()` và `exp`, nhưng `createSeatHold()` không nhận `Idempotency-Key`; chỉ hash token vào `GiuCho`. `prisma/schema.prisma:175-189` hiện có `tokenHash` unique, `chuyenXeId`, nullable `khachHangId`, `hetHanLuc`, state/timestamps và quan hệ seat; không lưu nonce, key ID, request fingerprint, key hash hoặc guest session. Backend parse được token client đã nhận và gửi lại, nhưng không tra/tái tạo token từ key sau response loss/restart.
- `apps/api/package.json` đã có `@nestjs/throttler`; source hiện gắn throttle ở auth/contacts/tickets nhưng không thấy guard/decorator trên SeatHolds. Default storage của NestJS Throttler là in-memory nên không đủ quota chia sẻ giữa nhiều instance; cần shared storage nếu bật nhiều API instance ([tài liệu storage chính thức](https://github.com/nestjs/throttler/blob/master/_autodocs/api-reference/throttler-storage.md)).
- `createSeatHold()` hiện có CAS `TRONG → DANG_GIU`, gắn `giuChoId` và kiểm tra update count trong transaction (`:302-351`); giữ invariant này trong A1, đồng thời bảo đảm nhánh thiếu DB không làm CAS token-only.
- `consumeHoldInTx()` kiểm tra expiry trước CAS nhưng CAS status `DANG_GIU` chưa kèm điều kiện `hetHanLuc > now` (`:615-667`). Include expiry predicate ngay trong conditional write để hết hạn giữa check và CAS vẫn bị từ chối.
- Release controller không truyền principal vào service (`seat-holds.controller.ts:35-53`), nên chưa thể enforce authenticated owner ở release. Header token alone is capability; authenticated holds cần principal tương ứng.

### Caller và phạm vi client

- Customer Web `getTripSeats()` đọc `tripSeatId` và `seatNumber` ở `apps/web/src/features/trips/services/trips.api.ts:104-109`; component hiện giữ lựa chọn dưới dạng `seatNumber` và `one-way-booking.tsx:847-858`/`round-trip-booking.tsx:1074-1084` gửi `seatNumbers` khi tạo booking.
- `tripsApi.holdSeats()`/`releaseSeats()` gọi nested route với `seatNumbers` tại `trips.api.ts:127-147`; text search không thấy component gọi hai wrapper này. A2 phải nối UI qua `tripSeatId`, giữ token theo vòng đời checkout, release/expiry handling và gửi `holdToken` cùng `seatIds` vào booking.
- API Customer seat map là public read snapshot; Admin dùng `GET /trips/:id/seat-inventory` theo quyền tenant, không thấy Admin gọi create/release customer hold. Không thay inventory endpoint.
- Repository không có `apps/mobile`; chưa xác định được caller mobile ngoài repo. Trước khi xóa route legacy từ `origin/develop`, cần inventory app đã phát hành. Không có caller trong repo không chứng minh không có client ngoài.

### GitNexus và tài liệu đã đối chiếu

GitNexus registry trỏ về repo gốc ở commit `da6488d` (cũ hơn `origin/develop` 18 commit), không có `.codegraph/` trong worktree; truy vấn symbols của seat hold không resolve đúng cho worktree này. Vì graph không đủ tin cậy, caller và source findings được xác nhận trực tiếp bằng hai snapshot Git và `rg`; không dùng graph làm bằng chứng không có caller. Tài liệu đối chiếu: `AGENTS.md`, `docs/nhiem-vu/rule-api.md`, tài liệu audit semantic Phase 0 được yêu cầu đọc, `docs/pr36-reconciliation/ENDPOINT_NORMALIZATION.md`, Prisma schema và code hiện tại. Context7 đã đối chiếu Prisma transaction và default storage của NestJS Throttler; không chạy migration hay DB.

## 8. Acceptance criteria cho A1/A2

### A1 — API/service

- Fresh guest hold trả `201`, đúng envelope, unique sorted `tripSeatId`s, `expiresAt` đúng 10 phút; DB có một `GiuCho DANG_GIU` và mọi seat row trỏ đến đúng `giuChoId`.
- Authenticated Customer hold lưu đúng `khachHangId`; Admin/employee, account không có Customer profile và bearer invalid bị xử lý theo contract.
- Duplicate IDs, ID sai/<=0, `gheId`, `seatNumbers`, seat thuộc chuyến khác, chuyến không bookable và request vượt 6 ghế đều bị từ chối; không partial hold.
- Cùng `Idempotency-Key` + cùng payload/owner khi active trả byte-for-byte cùng token/expiry sau restart hoặc khi request sang instance khác; token ký lại có SHA-256 bằng `GiuCho.tokenHash`, không có hold/seat thứ hai.
- Nhiều request đồng thời cùng key/payload chỉ tạo một `GiuCho` và một nhóm seat; tất cả request thua unique race đọc lại winner rồi trả cùng token. Cùng key khác payload, Customer hoặc guest session trả `409 IDEMPOTENCY_KEY_REUSED` và không lộ token của owner khác.
- Cùng key trỏ hold `EXPIRED` trả `410`; `RELEASED` trả `409 HOLD_INACTIVE`; `CONSUMED` trả `409 HOLD_ALREADY_CONSUMED`; không trạng thái terminal nào tự tạo hold mới. Seat conflict làm rollback cả hold/idempotency metadata/quota reservation.
- Key rotation giữ khả năng verify/rebuild token cho `kid` cũ trong thời hạn được duyệt; thiếu key/nonce/metadata hoặc hash rebuild không khớp phải fail closed, không tạo token/hold thay thế.
- Guest hold không có cookie server-issued hợp lệ bị từ chối trước khi ghi DB; cookie/header giả hoặc `X-Guest-ID` tự chọn không tạo owner scope. Cookie raw không lưu DB/log.
- Hai key khác nhau cùng guest session đồng thời không vượt một active hold; nhiều account Customer không vượt quota riêng khi dùng chung IP. Đạt giới hạn active trả `409 ACTIVE_HOLD_LIMIT_REACHED`, không đổi số ghế/hold.
- Vượt bucket request theo session/account/IP trả `429 TOO_MANY_REQUESTS` kèm `Retry-After`; retry cùng key không tăng hold quota nhưng request-level flood vẫn bị giới hạn. Thay IP không reset session quota; giả mạo `X-Forwarded-For` không được đổi tracker khi request không đến từ trusted proxy; shared storage giữ cùng kết quả qua restart/multi-instance.
- Test theo ngưỡng xác nhận 6 ghế/hold, guest 1 active group/6 ghế, Customer 2 groups/12 ghế, session 5/account 10/IP 30 attempt mới mỗi 10 phút; các giá trị phải cấu hình được và được owner duyệt trước khi đóng test.
- Thiếu/sai/chỉnh sửa chữ ký, signature key sai, token hết hạn, DB record không tồn tại, record terminal, owner sai, trip sai, seat set thiếu/thừa/sai hoặc seat linkage/state sai đều không thể verify/consume/release nhầm.
- Authenticated token bị dùng bởi guest/customer khác không release/consume được. Guest capability behavior và giới hạn token theft có test riêng.
- Release active rồi retry là idempotent; release consumed không đổi `DA_DAT`; release unknown/invalid token không sửa bất kỳ seat nào.
- Hai request giữ cùng một seat và request multi-seat có một seat tranh chấp tạo đúng một outcome, rollback hoàn toàn phía thua.
- Race release-vs-booking consume có đúng một terminal state nhất quán; race cleanup-vs-consume không ghi đè `DA_DAT`; cleanup nhiều instance chạy lặp không mở ghế orphan hoặc ghế booked.
- Restart app, request được route tới instance khác và DB unavailable không kích hoạt in-memory/token-only fallback.
- Test integration concurrency chạy trên MySQL/MariaDB adapter thực tế; unit mock không thay thế test transaction/CAS. Test hiện có tại `apps/api/test/integration/seat-holds/seat-holds-concurrency.spec.ts` là baseline, cần bổ sung các case fail-closed/cleanup ở trên.

### A2 — Customer Web/API callers

- Seat map selection giữ `tripSeatId` làm ID; label `seatNumber` chỉ dùng hiển thị. Request hold và booking gửi cùng tập `seatIds`.
- Guest create gửi cookie session server-issued; một `Idempotency-Key` cho logical attempt được giữ cùng attempt trong session storage, retry mạng/refresh dùng lại key và cookie. Token chỉ ở state/session-scoped storage và không xuất hiện trong URL/log.
- Nhiều tab guest không tự sinh hold mới khi đã có active hold trong cùng session; UI xử lý `409 ACTIVE_HOLD_LIMIT_REACHED` bằng hướng dẫn quay lại tab/attempt hiện tại hoặc giải phóng hold. `429` hiển thị thời gian có thể thử lại theo `Retry-After`.
- Không gửi booking trước khi hold tạo thành công; booking gửi hold token và nhận lỗi code ổn định; seat conflict refresh sơ đồ và yêu cầu chọn lại.
- Khi user bỏ chọn/hủy/đổi chuyến, release token hiện tại; UI xử lý `RELEASED`, `EXPIRED`, `HOLD_ALREADY_CONSUMED`, timeout và 401/403 mà không hiển thị hold giả.
- Khi hold expired, không cho UI tiếp tục booking bằng cache cũ; tạo hold mới cần lựa chọn/attempt mới và idempotency key mới.
- Mỗi booking leg được hỗ trợ phải có hold riêng. Multi-leg booking contract hiện chưa có; A2 không được giả định một outbound hold bảo vệ leg còn lại.
- Unit/component tests thực thi interactions và fetch/API requests thật của service layer: map seat number→tripSeatId, create/retry, release, error, expiry, booking body và cleanup/unmount. Admin seat inventory không bị ảnh hưởng.

## 9. Postman smoke checklist

Chuẩn bị environment local: `baseUrl=http://localhost:<api-port>/api/v1`, `tripId`, `tripSeatId`, một Customer bearer token nếu test authenticated. Không lưu token hold thật vào collection hoặc commit collection có credential.

1. Bootstrap guest session, kiểm tra cookie do server phát hành có flags phù hợp; gửi `POST {{baseUrl}}/seat-holds` với cookie + `Idempotency-Key` + body hợp lệ; xác nhận `201`, token/seat/expiry và đúng một row hold.
2. Gửi lại cùng request/key/session trước restart; sau đó restart API hoặc route request qua instance khác và gửi lại; kiểm tra token byte-for-byte/expiry giống ban đầu, hash khớp `tokenHash`, không thêm hold/ghế.
3. Gửi đồng thời nhiều request cùng key/payload; xác nhận chỉ một hold và các response replay đều là cùng token. Dùng cùng key với payload, Customer hoặc guest cookie khác phải `409 IDEMPOTENCY_KEY_REUSED`.
4. Lặp cùng key sau từng state: ACTIVE trả token cũ; EXPIRED trả `410`; RELEASED trả `409 HOLD_INACTIVE`; CONSUMED trả `409 HOLD_ALREADY_CONSUMED`; xác nhận không tạo row/seat mới. Thử request lỗi `SEAT_UNAVAILABLE` rồi cùng key sau khi ghế được mở; không còn metadata mồ côi từ transaction rollback.
5. Dùng `kid` cũ khi key còn trong keyring để replay/release hold; thử bỏ key khỏi keyring trong môi trường test và xác nhận API fail closed, không ký token mới.
6. Dùng nhiều key khác nhau từ cùng guest cookie đồng thời; chỉ một hold active thành công, request khác nhận `409 ACTIVE_HOLD_LIMIT_REACHED`. Guest không cookie, cookie sửa/giả và header `X-Guest-ID` tự khai không tạo hold.
7. Tạo 6 ghế guest trong một hold (giới hạn đề xuất), thử 7 ghế; tạo lần giữ mới sau khi chạm limit và kiểm tra `409`. Lặp 5 attempt mới/10 phút cùng session để kiểm tra attempt vượt ngưỡng trả `429` + `Retry-After`; replay key active không chiếm quota hold mới.
8. Dùng nhiều session hợp lệ cùng IP dưới ngưỡng để mô phỏng NAT: mỗi session vẫn có active quota riêng; vượt IP request bucket phải `429`. Đổi IP với cùng cookie không reset quota session; giả `X-Forwarded-For` không trusted không reset IP bucket; chạy hai instance/restart để xác nhận shared counters và quota không bị tách.
9. Kiểm tra Customer quota riêng và giới hạn 6 ghế/hold, 2 group/12 ghế tổng; Customer thứ hai dùng cùng IP không bị tính vào active quota người thứ nhất.
10. Gọi `DELETE {{baseUrl}}/seat-holds` với `X-Hold-Token`; authenticated hold phải kèm bearer đúng owner. Kiểm tra `200 RELEASED`, seat `TRONG`; retry cùng token trả cùng terminal state.
11. Tạo hold mới rồi gọi booking với đúng `tripId`, `seatIds`, `holdToken`; chỉ xác nhận consume khi API booking thật thành công. Kiểm tra hold `DA_DAT`/seat `DA_DAT`; gọi DELETE sau consume phải `409 HOLD_ALREADY_CONSUMED`, seat vẫn booked.
12. Lặp thử token bị sửa, token không có DB record, Customer khác, guest-vs-auth mismatch, trip khác, seat ID thiếu/thừa và seat không thuộc chuyến; kiểm tra mã lỗi ổn định và DB/seat không đổi.
13. Với test environment riêng, chờ quá 10 phút rồi thử consume; phải nhận `410 HOLD_EXPIRED`. Sau cleanup, ghế chỉ được mở nếu có record hold hết hạn và `giuChoId` khớp.
14. Sau khi đã migrate client ngoài repo, kiểm tra nested `POST/DELETE /trips/:tripId/seat-holds` không còn được phục vụ; token path alias chỉ còn trong thời gian deprecation đã công bố.

## 10. Database/API impact dự kiến

### Database và migration

- `GiuCho` đã có `tokenHash CHAR(64) UNIQUE`, trip/customer, expiry/status/timestamps và quan hệ `GheChuyenXe`; migration tương lai cần bổ sung `idempotencyKeyHash CHAR(64) UNIQUE NULL`, `requestFingerprint`, `guestSessionHash NULL`, `nonce`, `tokenVersion` và `signingKeyId`. `NULL` chỉ dành cho hold legacy; code mới phải ghi đủ metadata.
- Có thể dùng `createdAt` hiện tại (`DateTime(3)`) làm `iat` nếu create transaction gán chính xác timestamp đã dùng khi ký. `hetHanLuc` là `exp`; seat IDs dựng từ rows có `giuChoId` rồi sort trước khi serialize. `tokenHash` hiện tại tiếp tục là kiểm tra toàn vẹn token tái tạo.
- Thêm index phục vụ quota/count active hold theo owner scope, trạng thái và expiry. Để serialize quota giữa nhiều instance, đề xuất row có unique `ownerScopeHash` và cập nhật/lock trong transaction; rate counter shared có unique key theo loại subject, hash subject và window. Có thể thay bằng shared gateway storage đã tồn tại nếu chủ dự án xác nhận hạ tầng đó.
- Migration không thể khôi phục nonce/key mapping cho hold legacy từ `tokenHash`. Giữ metadata mới nullable cho row cũ; chờ các hold legacy hết TTL hoặc có rollout/drain rõ ràng trước khi yêu cầu idempotency mới. Không backfill nonce giả.
- Giữ hash idempotency/tombstone trong thời gian retry được hỗ trợ; khuyến nghị gắn với lịch sử `GiuCho` và không purge riêng key. Nếu policy xóa lịch sử, cần tombstone store hoặc contract có thời hạn trước khi xóa.

### API và client

- Body canonical `{tripId,seatIds}` và response active hold không đổi. Guest request thêm cookie session server-issued; không thêm guest identity vào body/header. Nếu cookie chưa tồn tại, client cần bootstrap session trước; hiện chưa thấy bootstrap endpoint/middleware trong source nên đường cấp cookie là quyết định API còn mở.
- Same-key replay trả cùng token/expiry; terminal replay phân biệt `410 HOLD_EXPIRED`, `409 HOLD_INACTIVE`, `409 HOLD_ALREADY_CONSUMED`. Thêm `409 ACTIVE_HOLD_LIMIT_REACHED`; rate-limit trả `429 TOO_MANY_REQUESTS` và `Retry-After` giây. CORS phải cho phép credentials cho Customer Web khi API khác origin.
- Không thay flow booking/payment, webhook hoặc settlement trong A0.1. A2 cần giữ Idempotency-Key/session cookie qua retry/refresh; UI phải phân biệt 409 (đang có hold/xung đột) với 429 (chờ hết bucket).

## 11. Quyết định còn mở cần chủ dự án phê duyệt

1. **Guest booking:** chính sách guest ownership cần quyết định riêng. Seat hold guest có thể tồn tại như capability ngắn hạn; quyền consume vào guest booking và cách claim booking chưa được tự quyết trong A0.
2. **Idempotency migration/retention:** duyệt additive fields/index trên `GiuCho`, unique toàn cục trên `idempotencyKeyHash`, lưu request fingerprint/token metadata và giữ key hash cùng lịch sử hold. Xác nhận nếu tương lai được purge lịch sử thì retention/tombstone thay thế ra sao.
3. **Secret rotation:** duyệt keyring theo `kid`, tên/cách nạp config secret và thời gian giữ old signing keys, gồm thời hạn chấp nhận retry `DELETE` terminal. Các instance phải dùng cùng keyring/active key ID. A0.1 không sửa `.env`.
4. **Guest session bootstrap:** source chưa có session cookie/route. Duyệt dùng middleware/bootstrap hiện có hay endpoint cấp anonymous session; chốt cookie domain/SameSite/CORS credentials. Nếu chưa có server-issued session proof, tạm không mở guest create hold.
5. **Quota và thresholds:** duyệt giá trị đầu đề xuất (guest 1 group/6 ghế, Customer 2 groups/12 ghế, tối đa 6 ghế/hold; guest 5, account 10, IP 30 attempt tạo mới/10 phút), cách cấu hình/hiệu chỉnh và shared rate storage. Customer Web có copy “tối đa 6 ghế”, nhưng API hiện không áp giới hạn.
6. **Abuse vượt session/IP:** cookie có thể bị xóa/đổi và IP có thể đổi; quyết định có cần yêu cầu login, verified phone hay risk-based challenge sau tín hiệu abuse. Không coi IP/session cookie là verified identity; A0.1 không triển khai CAPTCHA/OTP.
7. **Client compatibility:** kiểm kê Customer Mobile/client đã phát hành trước khi bỏ `DELETE /seat-holds/:holdToken`; repo hiện không chứa app mobile.
8. **Payment timeout:** schema hiện không biểu diễn expiry cho `DonGiaoDich`/`PhieuDatVe`; owner payment/booking cần chốt timeout, cancellation và giải phóng seat riêng trước khi A2 test toàn flow.
9. **Orphan legacy seats:** quy trình reconciliation có kiểm soát cho `DANG_GIU` thiếu `GiuCho` cần được quyết định vận hành. Cleanup runtime không được tự mở các row này.

---

**Phạm vi A0.1:** chỉ bổ sung đặc tả idempotency/token recovery, guest anti-abuse, impact, acceptance criteria và test cases. Không thay đổi application code, tests, config, schema/migration, database hay review conversations; A1.1 chưa được thực hiện.
