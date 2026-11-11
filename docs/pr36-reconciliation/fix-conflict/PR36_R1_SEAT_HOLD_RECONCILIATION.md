# PR #36 — R1: Hợp nhất hai cơ chế giữ/nhả ghế sau merge

**Trạng thái:** Spec triển khai độc lập cho một task nhỏ.
**Repo:** `quocan9999/vexgo` — PR #36 `feature/booking-with-cargo-and-seat-holds` → `develop`.
**Worktree thực hiện:** `vexgo-pr36-integration`, branch `fix/pr36-integration` (kiểm tra lại thực tế trước khi làm).
**Mốc source tham chiếu khi viết spec:** PR HEAD `283b86364eb9b79f499bd63982607d5e37756ca0`, `origin/develop` `21e41783741c1db88040d29ac9fa590e15c1caf1`. Nếu HEAD thay đổi, đối chiếu lại source mới; không coi các SHA trên là lệnh reset/checkout.
**Đầu ra cuối:** Code + tests cần thiết, duy nhất một handoff `docs/fix-conflict/FINAL_HANDOFF.md`, và **một commit local** gồm toàn bộ thay đổi của R1 (bao gồm spec này nếu chưa tracked). **Không push.**

## 1. Mục đích và ranh giới

PR #36 được merge `develop` vào nhánh tính năng, nhưng một số nghiệp vụ vẫn tồn tại **hai implementation không tương đương** dù Git không còn textual conflict. R1 chỉ giải quyết đúng **giữ ghế/nhả ghế**, để hệ thống không còn API thứ hai có thể tự thay đổi trạng thái ghế mà không tạo/quản lý lượt giữ hợp lệ.

Đây là **semantic-conflict reconciliation**, không phải dự án hardening toàn bộ seat hold, không sửa mọi finding cũ của PR #36. Chỉ cần giữ chức năng hiện có và loại bỏ đường xử lý trùng, không thiết kế thêm cơ chế mới.

**Nguyên tắc lựa chọn:** Tuyệt đối **không** mặc định `origin/develop` là source of truth. Đánh giá cả hai codepath theo business rules, DB invariants, atomicity, ownership, TTL, concurrency, client compatibility, tests và giá trị tính năng; chọn nền tốt hơn, chỉ tích hợp phần hữu ích của bên kia khi có bằng chứng cần thiết. Không giữ hai cách mutation độc lập.

## 2. Hiện trạng cần xác minh tại source mới nhất

| Luồng | Nơi triển khai | Đặc điểm đã quan sát ở PR HEAD tham chiếu | Đánh giá ban đầu |
|---|---|---|---|
| Canonical resource | `apps/api/src/seat-holds/seat-holds.controller.ts` (`POST /seat-holds`, `DELETE /seat-holds`) + `seat-holds.service.ts` | `POST` nhận `tripId`, `seatIds`; tạo token và thời hạn ~10 phút, có `GiuCho` + `giuChoId` trên ghế, cập nhật có điều kiện trong transaction. `DELETE` sử dụng hold token. | **Ưu tiên làm nền nếu đối chiếu mới nhất xác nhận**, vì có định danh lượt giữ và gắn đúng ghế. Chưa tuyên bố an toàn tuyệt đối. |
| Duplicate từ PR | `apps/api/src/trips/trips.controller.ts` (`POST/DELETE /trips/:id/seat-holds`) + `TripsService.holdSeats/releaseSeats` | Nhận `seatNumbers`; create chuyển `TRONG → DANG_GIU` nhưng không tạo `GiuCho`/token sở hữu; release theo số ghế, có thể mở ghế do người khác giữ; `updateMany` create chưa gate kết quả bằng row count. | Không tương đương canonical, cần loại bỏ sau khi kiểm kê caller. |
| Web wrapper của duplicate | `apps/web/src/features/trips/services/trips.api.ts`: `tripsApi.holdSeats/releaseSeats` | Gọi nested routes với `seatNumbers`; lần audit trước không thấy component gọi. | Xác minh bằng search mới; xóa wrapper chết hoặc đổi caller thực sự dùng sang API canonical trong task phù hợp, không để UI gọi 404. |
| Sơ đồ ghế | `GET /trips/:id/seats`, `TripsService.getCustomerSeats` | Trả `tripSeatId`, `seatNumber`, `status`, `position` (và giá khi có). | **Giữ nguyên**, vì không phải duplicate hold mutation. |
| Inventory Admin | `TripsService.getSeats` và routes quản trị ghế/chuyến liên quan | Read/projection theo tenant/permission. | **Giữ nguyên**, không xóa hoặc đổi ngữ nghĩa. |

**Lưu ý:** `SeatHoldsService` hiện vẫn có các finding riêng: fallback từ `gheChuyenXeId` sang `gheId`, token/map fallback, owner/cleanup/secret; tài liệu A0/A0.1 có đề xuất idempotency, cookie, quota. Những vấn đề này **ngoài phạm vi R1** trừ khi Agent chứng minh một thay đổi tối thiểu là bắt buộc để không tạo regression trực tiếp từ việc bỏ duplicate. Ghi vào handoff, không tự mở rộng task.

## 3. Phạm vi code và yêu cầu hành vi

### 3.1 Trước khi thay đổi

1. Xác nhận `git status`, branch, worktree; bảo toàn thay đổi chưa commit nếu có. Không làm ở repo gốc; **không merge/rebase/checkout/reset** thêm `develop`.
2. Đọc `AGENTS.md`, quy ước API liên quan; chỉ đọc phần cần thiết của `docs/pr36-reconciliation/{PHASE_00_AUDIT,ENDPOINT_NORMALIZATION,TASK_A0_SEAT_HOLD_CONTRACT}.md` để có context, **không biến toàn bộ đề xuất A0 thành scope R1**.
3. So sánh source tại worktree với `origin/develop` và lịch sử PR, ghi ngắn gọn tiêu chí chọn trong handoff. Không copy đè cả module `Trips` hoặc `SeatHolds` từ nhánh khác.
4. Kiểm kê mọi callsite của `TripsService.holdSeats`, `releaseSeats`, nested `/:id/seat-holds`, `tripsApi.holdSeats/releaseSeats` trong `apps/api`, `apps/web`, `apps/admin`, tests, tài liệu runtime. Đối chiếu route public có khả năng được client ngoài repo dùng; nếu không có bằng chứng, nêu rõ chưa xác minh thay vì đoán.
5. Kiểm tra test hiện có tại `apps/api/test/integration/seat-holds/`, `apps/api/test/integration/trips/` và test Web service liên quan. Không xóa test chỉ vì test đang thất bại với endpoint không an toàn.

### 3.2 Triển khai giới hạn

Nếu đối chiếu source xác nhận kết luận trên:

1. **Giữ** `POST /api/v1/seat-holds` và `DELETE /api/v1/seat-holds` của `SeatHoldsController` là hai mutation endpoint dùng trong ứng dụng; vẫn sử dụng service tạo/nhả hold có liên kết DB hiện tại. **Không thay đổi contract của canonical endpoint chỉ để đáp ứng A0/A0.1 mới.**
2. Xóa route `POST /api/v1/trips/:id/seat-holds` và `DELETE /api/v1/trips/:id/seat-holds` khỏi `TripsController`. Không giữ alias gọi thẳng `TripsService`; không thay bằng endpoint mới.
3. Xóa `TripsService.holdSeats` và `TripsService.releaseSeats` khi không còn caller, dọn imports/DTO phụ thuộc chỉ phục vụ hai route. **Giữ nguyên** `getCustomerSeats`, `getSeats`, Admin inventory, Trip CRUD, cargo-capacity, seat status projection và tất cả domain methods khác.
4. Xóa hai wrapper Web `tripsApi.holdSeats/releaseSeats` nếu xác minh không có caller. Nếu có caller thật, kiểm tra xem migration nhỏ về canonical có thể làm ngay mà không phải implement toàn bộ booking/guest checkout hay không. Nếu không thể, **dừng với blocker và đề xuất task tách biệt**; không làm Web booking lớn ở R1.
5. Nếu một chi tiết tốt của code Sony thực sự cần giữ, chỉ tích hợp khi có test chứng minh lợi ích và không tạo mutation cạnh tranh. Không thêm idempotency, cookie session, quota hoặc API verify mới.
6. Tránh đổi response của `GET /trips/:id/seats` hoặc DTO create booking. Không sửa business logic Booking/Payment/Shipments trong R1.

### 3.3 Tương thích & dữ liệu tồn tại

- Những ghế do nested API cũ tạo có thể đang `DANG_GIU` với `giuChoId = null`: **không tự cập nhật DB, không tự mở ghế, không chạy cleanup ad hoc**. Ghi rủi ro và cách kiểm tra read-only trong handoff; mọi reconciliation dữ liệu sẽ có task/duyệt riêng.
- Không đổi thời hạn hiệu lực hay tự invalid các token hold đang active từ API canonical.
- `DELETE /seat-holds/:holdToken` hoặc body release hỗ trợ từ code cũ (nếu vẫn tồn tại) không thuộc duplicate Sony cần bỏ trong R1; chỉ ghi finding compatibility, không tự xóa alias này.
- API giữ ghế backend sau R1 có thể chưa được Customer Web tích hợp vào booking; đó là scope task kế tiếp, **không tuyên bố checkout end-to-end đã hoạt động**.
- Nếu phát hiện caller mobile/ngoài repo chưa kiểm kê được, ghi rõ nguy cơ breaking change và điểm cần chủ dự án kiểm tra trước rollout công khai. Không dựng API giả để che lỗi.

## 4. Acceptance criteria (R1)

- **AC01 — Single mutation path:** Trong source còn duy nhất canonical route giữ/nhả ghế theo resource `/api/v1/seat-holds`; không còn nested `POST/DELETE /trips/:id/seat-holds` hoặc `TripsService.holdSeats/releaseSeats` được đăng ký/gọi.
- **AC02 — Không mất read functionality:** `GET /api/v1/trips/:id/seats` tiếp tục trả schema `tripSeatId`, `seatNumber`, `status`, `position`; API Admin seat inventory/chuyến và cargo capacity không thay đổi.
- **AC03 — Canonical create:** `POST /api/v1/seat-holds` vẫn tạo hold thành công cho ghế trống/chuyến hợp lệ bằng `tripId` và `seatIds` là `gheChuyenXeId`; DB có record `GiuCho` và seat liên kết; không yêu cầu Idempotency-Key/cookie mới trong R1 nếu implementation hiện tại chưa có.
- **AC04 — Canonical release:** `DELETE /api/v1/seat-holds` với `X-Hold-Token` hiện tại chỉ giải phóng đúng ghế của hold trong test happy path; không làm mất booking đã tồn tại.
- **AC05 — Duplicate route removed:** Request vào hai nested routes cũ không thể mutate ghế/hold; phản hồi là route không hỗ trợ (404 hoặc method not allowed phù hợp router), không trả thành công giữ/nhả giả.
- **AC06 — Không có client gọi endpoint chết:** Search toàn repo không còn callsite runtime gọi nested hold; nếu có caller cần migration, phải được xử lý có test hoặc ghi blocker và dừng task thay vì xóa bừa.
- **AC07 — Scope:** Không thay schema, migration, `.env`, DB data, contract booking/payment; không triển khai các hardening findings ngoài R1.
- **AC08 — Quality:** Target tests liên quan pass; typecheck/lint phần thay đổi pass; `git diff --check` sạch. Test nào không chạy được phải báo nguyên nhân và không tuyên bố PASS.

## 5. Test cases thực chất

| Case | Cách kiểm tra | Kỳ vọng |
|---|---|---|
| T01 | API integration: tạo chuyến/ghế fixture hợp lệ, `POST /seat-holds` với seat IDs | Thành công, đúng seat IDs, có `GiuCho`, `giuChoId` tương ứng, seat `DANG_GIU`. |
| T02 | Gọi `DELETE /seat-holds` với hold token từ T01, rồi đọc seat status | Ghế trở lại `TRONG`, không đổi các ghế khác. |
| T03 | Gọi `POST /trips/:id/seat-holds` với `seatNumbers` cũ | Route không còn khả dụng; DB/seat state không thay đổi. |
| T04 | Đang có hold canonical, gọi `DELETE /trips/:id/seat-holds` với seat number của hold đó | Route không còn khả dụng, không nhả ghế đang có `GiuCho`. |
| T05 | `GET /trips/:id/seats` trước/sau tạo hold và sau release | Schema/ID/label giữ nguyên, status phản ánh mutation canonical. |
| T06 | Hai request canonical cùng giữ một `gheChuyenXeId` | Chỉ một thành công, không có duplicate hold/ghế; ưu tiên integration MySQL/MariaDB đang dùng, không dùng mock để giả lập transaction. |
| T07 | Regression/compile: kiểm tra các import/DTO/tests và code search sau khi bỏ methods | Không dangling import, không route trùng, không phải skip test cũ để pass. |

**Cách chạy:** Dùng test scripts đúng của repo, chỉ chạy targeted API/Trip/SeatHold và các test Web bị ảnh hưởng (nếu wrapper Web thay đổi), sau đó typecheck/lint phù hợp. Tránh full test suite không cần thiết. DB-backed test chỉ dùng **DB riêng worktree**, không đụng schema/dữ liệu repo gốc. Nếu test environment chưa sẵn, chạy test khả dụng và nêu giới hạn rõ trong handoff.

## 6. Postman smoke test dành cho người dùng

Dùng API worktree (dự kiến `http://localhost:4002/api/v1` nếu cấu hình thực tế không đổi), DB/worktree riêng. Chuẩn bị `tripId` có chuyến chưa khởi hành và `tripSeatId` lấy từ `GET /trips/:tripId/seats`:

1. `GET /trips/:tripId/seats`: chọn một seat `TRONG`, ghi `tripSeatId` và `seatNumber`.
2. `POST /seat-holds` với JSON `{ "tripId": <tripId>, "seatIds": [<tripSeatId>] }`: ghi `holdToken` trả về. **Không thêm Idempotency-Key bắt buộc nếu API chưa triển khai.**
3. `GET /trips/:tripId/seats`: seat đó thành `DANG_GIU`.
4. `DELETE /trips/:tripId/seat-holds` với `{ "seatNumbers": ["<seatNumber>"] }`: không được làm seat trở lại `TRONG`.
5. `POST /trips/:tripId/seat-holds` với body cũ: không còn endpoint giữ ghế thành công.
6. `DELETE /seat-holds` kèm header `X-Hold-Token: <holdToken>`: kết quả release thành công theo API hiện có.
7. `GET /trips/:tripId/seats`: seat về `TRONG`.

**Ghi chú:** Smoke ở đây chỉ xác nhận loại duplicate và canonical happy path; không thay thế review các finding ownership/secret/cleanup trong `SeatHoldsService`.

## 7. Phạm vi loại trừ và cách xử lý blocker

Không triển khai A1.1–A1.6, signing-secret rotation, keyring, idempotency, rate limiting, guest session, cải tiến owner/CAS/cleanup rộng; không tạo/đổi booking, payment settlement/SePay, shipment/cargo, khứ hồi, invoice, UI checkout. Không thêm Redis/dependency/Prisma migration. Không làm cleanup ghế orphan. Không tự sửa P0/P1 khác chỉ vì chúng tồn tại trong PR.

Nếu một việc nằm ngoài R1 là điều kiện **bắt buộc** khiến hệ thống fail khi bỏ duplicate (ví dụ wrapper có caller thật), ghi chính xác source location, lý do, tác động và giải pháp tối thiểu; không mở rộng âm thầm. Nếu không thể sửa an toàn trong R1, dừng không commit phần dở dang và xin quyết định.

## 8. Handoff, commit và điểm dừng

Cuối task, viết **duy nhất** `docs/fix-conflict/FINAL_HANDOFF.md` (không tạo handoff phase khác). Nội dung tối thiểu:

- HEAD/branch/worktree và baseline; file đổi/xóa; lý do chọn implementation chính và có/không tích hợp logic Sony.
- Đường API còn lại, thay đổi các caller, kết quả test thực chạy (PASS/FAIL/BLOCKED), những test chưa chạy.
- Checklist và kết quả smoke Postman nếu đã tự kiểm tra; các bước để người dùng tự smoke.
- Các rủi ro/finding **có sẵn** chưa xử lý (nhất là fallback trong `SeatHoldsService`, orphan seat cũ), caller ngoài repo chưa xác nhận, đề xuất task tiếp theo là Booking/Web reconciliation; không tuyên bố findings đã resolve.
- Commit SHA (nếu chưa biết lúc viết handoff, dùng thông tin dự kiến rồi báo SHA thật sau commit), `git status` cuối và giới hạn chưa xác minh.

Tự review `git diff`, `git diff --check`, `git status`, loại file rác/cache/env/secret. Stage đúng code + tests + spec này + **một final handoff**, dùng `git add -f` riêng cho tài liệu nếu `docs/*` bị local exclude; tuyệt đối không add cả thư mục chứa artifact không liên quan. Tạo **một commit local** Conventional Commits tiếng Việt, ví dụ header `fix(seat-holds): loại bỏ luồng giữ ghế trùng sau merge` và body gạch đầu dòng liền nhau, cách header đúng một dòng trống. Không amend/rewrite commit trước.

**Không push remote, không tạo PR, không resolve/reply review conversations, không merge/rebase/reset repo. Sau khi commit thì DỪNG, chờ người dùng smoke test và reviewer xem diff.**
