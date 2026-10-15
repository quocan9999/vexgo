# PR #36 — Final review handoff F1/F2

## Baseline và phạm vi

- Worktree `vexgo-pr36-integration`, branch `fix/pr36-integration`; HEAD trước commit `5fda32f384b7852f46c60d8fb923ecefc2614227`.
- Đã fetch và đối chiếu `origin/develop` tại `21e41783741c1db88040d29ac9fa590e15c1caf1`; không merge/rebase/reset.
- Hai review conversation còn mở: F1 `PRRT_kwDOUfyB7s6sr1qI`; F2 `PRRT_kwDOUfyB7s6sr3PF`.
- Thay đổi thuộc lượt này: cập nhật regression integration F1, xóa bốn seed script ad-hoc F2 và handoff này. `README.md` cùng `handoff/R4_FINAL_HANDOFF.md` đã có thay đổi trước lượt này và được giữ riêng, không đưa vào commit.

## F1 — Fixture SePay cho guest/customer booking

- `booking-status-history.spec.ts` dùng `SEPAY_ACCOUNT_NUMBER = '0012345678'` riêng cho test; lưu và phục hồi cả `SEPAY_WEBHOOK_SECRET` lẫn `SEPAY_ACCOUNT_NUMBER` trong `afterAll`.
- Payload có `accountNumber` trước khi tạo chữ ký HMAC. Cả guest và customer đều tạo payment, đọc trạng thái pending, xác minh chữ ký giả trả 401 và không đổi booking, gửi webhook hợp lệ hai lần, rồi xác minh booking/order/ticket/payment và chỉ có một lịch sử thanh toán cùng một SePay transaction ID.
- `payments-webhook.spec.ts` đã có regression HTTP/MySQL cho tài khoản thiếu/sai, chữ ký thiếu/giả/hết hạn, replay đồng thời/lặp lại, transaction ID trùng và payment/booking/ticket/history không bị ghi sai. Không sửa validation trong `PaymentsService`.

## F2 — Seed script demo giá/chuyến

- Đã xóa `prisma/seed-route-2k.mjs`, `prisma/seed-more-routes-2k.mjs`, `prisma/seed-trips-0810.mjs`, `prisma/seed-trips-2010.mjs`. Đọc nội dung từ HEAD nhưng không chạy script nào.
- Script lấy `DATABASE_URL` hoặc `MIGRATION_URL`; hai script route dùng giá 2.000đ và có thể cập nhật `BangGia`, hai script còn lại tạo/cập nhật chuyến theo ngày cố định.
- Tìm toàn bộ source, package scripts và tài liệu không thấy caller/tham chiếu tới bốn tên script. Không cần sửa package hay docs khác.

## Kiểm thử

| Phạm vi | Kết quả |
|---|---|
| API unit tests: `npx vitest run --no-file-parallelism test/unit` | PASS — 52 files, 680 tests |
| API `npm run typecheck` | PASS |
| API `npm run lint` | PASS |
| Oxlint riêng test F1 | PASS không lỗi; một cảnh báo có sẵn `typescript(no-misused-spread)` tại dòng 40 (`...options`) |
| Booking và SePay integration suites | BLOCKED — 59 tests bị skip do `beforeAll` timeout/pool timeout; MySQL không lắng nghe tại `127.0.0.1:3306` và Docker daemon không chạy |
| `git diff --check` và `git diff --cached --check` | PASS — không phát hiện whitespace error |

Integration command đã thử: `npx vitest run --no-file-parallelism test/integration/bookings/booking-status-history.spec.ts test/integration/payments/payments-webhook.spec.ts` trong `apps/api`. `.env` root trỏ đúng DB riêng `vexgo_pr36`; không có kết nối, migration, seed, reset hoặc ghi DB. Vì chưa chạy được MySQL integration, không coi F1 đã được nghiệm thu end-to-end.

## Final self-audit PR #36 so với `origin/develop`

- Seat hold: mutation chính là `SeatHoldsService`; booking yêu cầu `seatIds`/`holdToken`, kiểm tra hold và consume trong transaction. Tuy nhiên còn fallback release khi không tìm thấy record ở `seat-holds.service.ts:484–503`; token là bearer và controller không truyền principal. Đây là **P1 blocker** cần hardening riêng: signed token không chứng minh hold còn active trong DB.
- Booking: không còn `TripsService.holdSeats/releaseSeats`; source search xác nhận create booking không có nhánh bỏ qua hold. Web one-way lấy trip-seat IDs, tạo hold rồi gửi token.
- Payment: SePay xác minh secret, raw-body HMAC/timestamp, `SEPAY_ACCOUNT_NUMBER` và transaction ID trước settlement; các provider dùng chung `confirmPaymentSuccess`. Checkout Web thật đọc trạng thái backend; route cũ `/booking/:bookingId/payment` là demo có `setPaid`, được ghi nhãn demo và không được route checkout thật gọi.
- Cargo: booking và shipment dùng chung `CargoPricingService`/`CargoCapacityService`; phụ phí dễ vỡ 20.000đ và giá trị cao 50.000đ nằm trong shared pricing theo quyết định đã duyệt. Cả hai entry point gọi `ShipmentPersistenceService.persistInTransaction`.
- Tenant: list/detail shipment yêu cầu principal và kiểm tra owner/tenant. Riêng `POST /api/v1/shipments/lookup` là public, không gắn `ThrottlerGuard`, và trả email/điện thoại, địa chỉ, kiện hàng cùng timeline sau khi khớp mã + số điện thoại (`shipments.controller.ts:38–43`, `shipments.service.ts:378–476`). Đây là **P1 blocker** về PII/rate-limit, ngoài scope F1/F2.
- Demo/mock: Next route `/trips/[tripId]` dùng API thật và `OneWayBooking`/`RoundTripBooking`; `TripDetail`/`SeatPicker` dùng mock không được route này import. Luồng khứ hồi chưa được hỗ trợ đầy đủ và có UI chặn; ghi nhận backlog, không mở rộng task.
- Endpoint legacy `DELETE /seat-holds/:holdToken` còn tồn tại như alias; không thấy caller trong repo, consumer ngoài repo chưa xác minh. Không xóa trong F1/F2.
- Các giới hạn cần theo dõi: SePay/browser live smoke chưa chạy; thanh toán đến muộn sau khi booking hủy cần đối soát/hoàn tiền; guest booking chưa có OTP/claim và không auto-link theo phone; các nội dung này không được sửa trong task.

## Checklist smoke sau khi MySQL worktree sẵn sàng

1. Chỉ khởi động MySQL của môi trường worktree và xác nhận DB `vexgo_pr36`; chạy lại hai integration suites nêu trên tuần tự.
2. Với SePay Test Mode, dùng booking guest và customer mới. Gửi payload có `accountNumber` khớp chính xác cấu hình backend (giữ số 0 đầu), mã đơn chính xác, tiền vào và số tiền đúng; xác nhận booking/order/ticket đã trả, chỉ có một payment/history/transaction ID sau khi gửi lại cùng event.
3. Gửi chữ ký giả và tài khoản sai/thiếu; xác nhận HTTP lỗi và booking/order/payment/ticket không đổi. Không dùng tiền thật.
4. Xác nhận bốn seed script không còn trong checkout và không có tham chiếu; tuyệt đối không chạy các script đã xóa để thử.
5. Smoke riêng các blocker PII shipment lookup và seat-hold fallback trước merge; F1/F2 không xử lý hai vấn đề này.

## Đánh giá bàn giao

**NOT READY FOR MERGE.** F1 fixture đã được cập nhật nhưng integration chưa chạy được vì MySQL worktree không khả dụng. Ngoài ra còn hai blocker ngoài scope: P1 release seat hold fallback/ownership và P1 public shipment lookup PII không có rate limit riêng. Reviewer cần tự kiểm tra hai diff F1/F2 rồi resolve đúng review conversations; không resolve thay reviewer. Không push/merge/tạo PR.
