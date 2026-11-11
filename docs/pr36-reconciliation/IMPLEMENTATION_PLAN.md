# Kế hoạch triển khai reconciliation sau Phase 0

> Trạng thái: kế hoạch; chưa thực thi trong Phase 0. Mỗi phase tạo thay đổi có thể review riêng và chỉ tiếp tục sau khi acceptance của phase đó đạt.

**Mục tiêu:** Hợp nhất PR #36 với `origin/develop` mà giữ invariant booking/hold/payment hiện có, đóng các lỗ hổng exposure/settlement được review, và thống nhất contract API cho Web/Admin/các client đã xác nhận.

**Kiến trúc dự kiến:** Backend hiện có trên develop là nguồn sự thật cho booking, seat hold, provider settlement và permission. Giữ shipment độc lập và cargo gắn booking thành hai entry point, nhưng chuyển phần rate/route/capacity/persistence dùng chung vào một domain service. Web/Admin gọi một API contract qua service layer; backend luôn kiểm tra lại quyền, giá, trạng thái và capacity.

**Nguồn quyết định:** `PHASE_00_AUDIT.md`, `ENDPOINT_NORMALIZATION.md`, `AGENTS.md`, `docs/nhiem-vu/rule-api.md`, `docs/nhiem-vu/rule-ui-ux.md`. Base code là `origin/develop` SHA `21e41783741c1db88040d29ac9fa590e15c1caf1`; PR audit là `6b52356b748f3db3f42215614d8ff3db97a3ddc7`.

## Điều kiện toàn cục

- Không thay đổi schema/migration/database cho đến khi contract và fee snapshot được thống nhất; nếu cần schema, phase riêng phải đánh giá Admin + Customer và tuân thủ Prisma/migration rules.
- Không để frontend quyết định paid, ownership, giá cuối hoặc capacity. Không cập nhật tiền/booking/ticket chỉ từ callback chưa verify.
- Không liên kết guest record vào customer hiện hữu bằng phone chưa được xác minh.
- Mọi API tiếp tục dùng prefix `/api/v1`, response/error envelope và tenant/customer authorization theo `rule-api.md`.
- Giữ shipment độc lập khác entry point so với cargo attach; không nhân đôi rate/persistence/status logic.
- Trước khi loại endpoint/shape, inventory caller mobile ngoài repo và thống nhất rollout/compatibility.
- Không chạy migration/reset/seed; integration tests dùng test database được cấu hình riêng và dữ liệu fixture transaction-safe.

## Quyết định sản phẩm/API cần có trước khi chạm logic tương ứng

1. Guest booking/shipment: bắt buộc đăng nhập, hay guest có claim/OTP và record tách biệt cho đến khi xác minh?
2. Khứ hồi: aggregate hai leg nguyên tử hay tạm chặn checkout khứ hồi?
3. Cargo: trường rate nào là nguồn tính cuối, ai trả phí cargo đi kèm booking, surcharge nào thuộc bảng rate?
4. Independent shipment: payment provider/settlement nào được hỗ trợ, và khi nào chuyển `CHO_THANH_TOAN`?
5. Shipment cancellation: actor, cutoff, fee/refund policy và status transition nào được hỗ trợ?
6. Invoice: chứng từ chính thức hay biên nhận booking; quyền đọc và điều kiện hiển thị paid?
7. Xác nhận các caller mobile/ngoài repo trước breaking changes.

Không cần trì hoãn các phase P0 về public exposure và settlement để trả lời quyết định UI/product; các thay đổi đó phải giữ interface an toàn, không thêm guest access mới.

## Phase 1 — Đóng đường ghi trạng thái thanh toán không xác thực và PII shipment

**Ưu tiên:** P0; thực hiện trước mở rộng checkout/cargo.

**Files/symbols dự kiến:**

- `apps/api/src/bookings/bookings.controller.ts`: bỏ route `confirmPayment` public; bỏ service mutation chỉ được gọi từ route này nếu không còn caller hợp lệ.
- `apps/api/src/bookings/bookings.service.ts`: không cho frontend lệnh chuyển payment/booking/ticket thành paid.
- `apps/api/src/shipments/shipments.controller.ts`: thay `OptionalAuth` trên list/detail bằng policy rõ ràng.
- `apps/api/src/shipments/shipments.service.ts`: áp customer ownership, tenant scope, projection PII tối thiểu; anonymous chỉ dùng lookup credential.
- `apps/api/test/integration/bookings/`, `payments/`, `shipments/`: test HTTP thật với test DB theo cách tổ chức hiện có.
- `apps/web/src/features/account/services/bookings.api.ts`, `apps/web/src/features/payments/components/payment-page.tsx`, `apps/web/src/features/payments/components/invoice-page.tsx`: bỏ confirm thủ công, dùng read-only verified status; không hiển thị paid khi pending/API error.

**Steps:**

1. Viết integration test gọi direct confirm unauthenticated và xác nhận route không tồn tại/không có bất kỳ state/record nào chuyển paid.
2. Viết test anonymous shipment list/detail bị từ chối; Customer B và tenant B không xem shipment của A; Admin customer subresource vẫn scope đúng.
3. Thay đổi controller/service để public settlement không tồn tại và shipment list/detail luôn có scope bắt buộc.
4. Migrate Web payment page sang status read-only có owner auth; giữ waiting/error/retry. Invoice chỉ được điều hướng sau status paid từ backend; xóa fallback đánh dấu paid trong luồng thật.
5. Chạy integration tests, Web targeted tests, typecheck/lint cho files bị ảnh hưởng; kiểm tra mọi API caller trước khi bỏ route.

**Acceptance:** Không có thao tác user frontend có thể settle payment; unverified provider event không được coi là paid; anonymous shipment list/detail không trả PII; customer/tenant isolation được chứng minh; Web pending/error không hiện invoice success.

**Review threads:** `PRRT_kwDOUfyB7s6rbMPJ`, `PRRT_kwDOUfyB7s6rrr4p`, `PRRT_kwDOUfyB7s6rrr4s`. P0 SePay token/amount là threads riêng và nằm trong Phase 2.

## Phase 2 — Hợp nhất provider settlement và trạng thái payment

**Ưu tiên:** P0/P1; sau Phase 1 hoặc song song chỉ khi file ownership không xung đột.

**Files/symbols dự kiến:**

- `apps/api/src/payments/payments.controller.ts`: SePay webhook transport/auth boundary.
- `apps/api/src/payments/payments.service.ts`: dùng `confirmPaymentSuccess()` common settlement, provider reference, exact amount/currency/order.
- `apps/api/src/bookings/bookings.service.ts`: loại `confirmBookingPayment()` settlement duplicate nếu không còn caller khác.
- `apps/api/test/integration/payments/payments-webhook.spec.ts`, `apps/api/test/integration/payments/`: mở rộng test theo convention dự án.

**Steps:**

1. Thêm tests cho token/signature absent/invalid, amount zero/negative/NaN/mismatch, reference không tìm thấy, replay và hai callback chạy đồng thời.
2. Xác minh đúng contract SePay hiện cấu hình; fail-closed trước mọi lookup/mutation, không lộ secret qua log.
3. Chuẩn hóa reference mapping và route callback vào common settlement hiện có; settlement lock/CAS và provider transaction id được ghi cùng payment state.
4. Giữ late-payment/cancelled-order behavior theo develop; không tự settle đơn hết hạn hoặc tự refund nếu policy không có.
5. Chạy payment integration, kiểm tra duplicate/replay và rollback sau lỗi DB.

**Acceptance:** Invalid callback/amount/currency/reference không đổi payment/booking/ticket; callback hợp lệ settle một lần; callback retry/đồng thời không tạo payment duplicate; common settlement giữ atomicity.

**Review threads:** `PRRT_kwDOUfyB7s6rbMPO`, `PRRT_kwDOUfyB7s6rbMPU`, `PRRT_kwDOUfyB7s6rbMPy`. Không mở rộng sang provider khác ngoài các thay đổi cần thiết để giữ common contract.

## Phase 3 — Trả seat hold + booking core về contract có ownership

**Ưu tiên:** P1, blocker cho checkout booking.

**Files/symbols dự kiến:**

- `apps/api/src/seat-holds/seat-holds.controller.ts`, `seat-holds.service.ts`, DTOs: giữ resource hold develop.
- `apps/api/src/trips/trips.controller.ts`, `trips.service.ts`: loại nested hold routes và legacy `holdSeats/releaseSeats`.
- `apps/api/src/bookings/bookings.controller.ts`, `bookings.service.ts`, `bookings/dto/create-booking.dto.ts`: principal policy, DTO chuẩn, required token, `verifyHold` + `consumeHoldInTx`.
- `apps/web/src/features/trips/services/trips.api.ts`, `apps/web/src/features/booking/components/one-way-booking.tsx`, `round-trip-booking.tsx`, booking services: tạo/giữ/release token và gửi token cùng seat IDs.
- `apps/api/test/integration/seat-holds/seat-holds-concurrency.spec.ts`, `apps/api/test/integration/trips/trips-concurrency.spec.ts`, booking tests; Web booking/seat interaction tests.

**Steps:**

1. Viết fail-first tests cho concurrent hold, ownership mismatch, expiry, release wrong token, booking thiếu token và hold consume rollback.
2. Migrate Web từ `seatNumbers` sang IDs và token; hiển thị hold expiry/seat conflict từ backend. Không retry bằng unauthenticated fallback khi authenticated booking lỗi.
3. Khôi phục `CreateBookingDto` một shape cụ thể và develop booking flow; bỏ update branch cho phép seat `TRONG`/hold của người khác.
4. Xóa nested legacy endpoints/wrappers sau khi `rg` + inventory caller ngoài repo xác nhận không còn client cần alias.
5. Chạy seat concurrency + booking integration + Web targeted suite.

**Acceptance:** Mỗi ghế chỉ có một hold hợp lệ; hold gắn token, trip, seat set, principal (nếu login) và expiry; booking không tạo nếu hold không hợp lệ; release không thể nhả hold người khác; không có hai API hold có semantics khác.

**Review threads:** `PRRT_kwDOUfyB7s6rbMPZ`, `PRRT_kwDOUfyB7s6rbMPj`, `PRRT_kwDOUfyB7s6rbMPr`.

## Phase 4 — Chốt guest, khứ hồi và contract customer checkout

**Ưu tiên:** P1; phụ thuộc product decisions ở đầu tài liệu và Phase 3.

**Files/symbols dự kiến:**

- `apps/api/src/bookings/bookings.controller.ts`, `bookings.service.ts`, booking DTO/auth/claim modules phù hợp quyết định guest.
- `apps/api/src/shipments/shipments.service.ts` cho guest identity branch.
- `apps/web/src/features/booking/components/one-way-booking.tsx`, `round-trip-booking.tsx`, `apps/web/src/features/payments/components/payment-page.tsx`, `invoice-page.tsx`.
- Tests booking guest ownership, roundtrip transaction, payment error/polling expiry.

**Steps:**

1. Chọn auth-only hoặc guest claim flow. Nếu auth-only, reject guest create. Nếu guest, tạo ownership unverified riêng và claim token/OTP; link account chỉ sau verification.
2. Quyết định multi-leg booking. Nếu backend aggregate được duyệt, thiết kế request/response trước tests; nếu không, ngăn roundtrip checkout trước khi booking/payment draft được tạo.
3. Cập nhật detail/read flow thành owner scoped hoặc guest capability; bỏ numeric public booking detail.
4. Poll payment/booking state read-only; dừng polling theo terminal backend state `paid/cancelled/expired`; timer client chỉ hỗ trợ UX, không làm authority.
5. Chỉ có invoice/receipt success khi API trả paid. Xóa fallback sessionStorage/mock trong production path; mock chỉ được giữ trong explicit demo/test context nếu sản phẩm yêu cầu.
6. Test customer/guest/roundtrip failure, pending, expiry, cancellation, network/API error; kiểm tra điều hướng đúng một lần.

**Acceptance:** Không account-link bằng phone chưa verify; khứ hồi không thể hiển thị/tính giá cho leg chưa tồn tại; backend expiry dừng polling; pending/error không giả thành success; UI vẫn theo design system Admin/Web hiện hữu.

**Review threads:** `PRRT_kwDOUfyB7s6rrr46`, `PRRT_kwDOUfyB7s6rrr4_`, `PRRT_kwDOUfyB7s6ryIAt`.

## Phase 5 — Cargo domain service dùng chung cho attached và independent shipment

**Ưu tiên:** P1; thực hiện sau khi cargo rate/payer/payment policy được chốt.

**Files/symbols dự kiến:**

- `apps/api/src/shipments/shipments.service.ts` và module/service mới bên trong shipment domain nếu cần: rate lookup, route-point validation, fee-detail snapshots, capacity reservation, status history.
- `apps/api/src/bookings/bookings.service.ts`: gọi shared cargo logic trong transaction booking, không duy trì fee/capacity algorithm riêng.
- DTOs `apps/api/src/shipments/dto/`, booking cargo DTO và Web `shipments.api.ts`, `send-freight-page.tsx`, booking cargo form.
- Tests `apps/api/test/unit/shipments/shipments.service.spec.ts`; bổ sung integration tests rate/capacity/transaction tại `apps/api/test/integration/shipments/` và `bookings/`.

**Steps:**

1. Viết test matrix cho rate effective date, origin/destination pair, category, bracket lower/upper bound, missing/multiple rate, pickup/dropoff role/operator/route.
2. Chốt charge formula từ `BangCuocGuiHang`/schema và payer; loại fallback rate khác bracket/category và hard-coded fees.
3. Tạo shared method dùng transaction client để resolve rate + persist `ChiTietCuocGuiHang` + total snapshot/history cho cả hai entry point.
4. Xây capacity reservation atomic/serialized bảo vệ cả shipment create lẫn booking attached cargo; test hai request song song vượt giới hạn.
5. Thêm/điều chỉnh shipment quote API chỉ khi UI cần preview; quote không giữ capacity/không thay giá backend lúc create.
6. Chạy DB-backed integration tests cho rollback, concurrent capacity và fee detail consistency. Không sửa migration/schema nếu chưa có need chứng minh và phê duyệt team.

**Acceptance:** Cùng input cho independent/attached dùng cùng rate policy; không có guessed point hoặc wrong rate; phí tổng khớp snapshot detail; capacity không vượt dù concurrent; lỗi cargo rollback booking/order/hold đúng transaction.

**Review threads:** `PRRT_kwDOUfyB7s6rrr4u`, `PRRT_kwDOUfyB7s6rrr4y`, `PRRT_kwDOUfyB7s6rrr43`.

## Phase 6 — Contract docs, compatibility và đóng review

**Files dự kiến:**

- `docs/nhiem-vu/endpoint-api.md`, API feature docs/README theo contract đã merge.
- Web/Admin callers đã inventoried; client/mobile repo ngoài nếu team cung cấp.
- Relevant integration and UI contract tests.

**Steps:**

1. `rg` toàn source + API access log/test fixtures tìm caller cho endpoints/DTO cũ; đối chiếu mobile/client ngoài repo với owner.
2. Cập nhật endpoint spec: method/path/auth/role/request/query/response/error, idempotency, deprecated alias và ngày loại bỏ.
3. Migrate callers trước, thêm compatibility adapter chỉ khi có caller đã xác nhận và adapter không bypass ownership/invariant.
4. Chạy regression suites theo endpoint matrix, typecheck/lint/build cho workspace API/Web/Admin liên quan.
5. Self-review theo `PHASE_00_AUDIT.md`; tạo commit riêng cho từng phase theo repo workflow. Reviewer xác minh rồi tự resolve GitHub threads; người triển khai không tự resolve review conversation.

**Acceptance:** Không còn caller dùng contract đã bỏ; docs phản ánh source; API inventory không có duplicate action/resource; mọi P0/P1 thread đã có test evidence và reviewer sign-off.

## Thứ tự ưu tiên và dependency

```text
Phase 1 P0 access/state boundaries ──┬── Phase 2 verified provider settlement
                                    └── Phase 3 hold + booking invariant
Phase 3 ── Phase 4 guest/roundtrip/payment read flow
Phase 4 + product rate decisions ── Phase 5 cargo + shipment shared logic
Phases 1–5 ── Phase 6 docs/client compatibility/review sign-off
```

Phase 1 và payment-provider work không được dùng để mở rộng scope sang endpoint/refund hay security issue không có test/caller liên quan; mọi code change trong các phase sau phải bám audit này và quyết định sản phẩm được ghi lại.
