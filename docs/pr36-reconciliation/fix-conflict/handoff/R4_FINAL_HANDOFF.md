# R4 — Payment Backend / SePay Handoff

**Trạng thái: BLOCKED — đã khóa đường xác nhận thanh toán không an toàn; xác thực HMAC SePay đã triển khai, quyết toán SePay vẫn tắt.** Quyết định persistence đã được duyệt và migration đã áp dụng trên DB worktree; chưa chuyển R5 vì mapping giao dịch, late-payment policy và ảnh hưởng cargo chưa được chốt.

## Đối chiếu và quyết định

- Worktree `fix/pr36-integration`, trước thay đổi tại `35e680a3a0052a9d161000fd1b6fc00e93e240f4`; `origin/develop` tại `21e41783741c1db88040d29ac9fa590e15c1caf1`; code Sony trước merge tại parent `2dc2ff7d0998f06bc0066eff44cb3e9e2cdd10ac`.
- Chọn `PaymentsService.confirmPaymentSuccess()` làm settlement core: callback MoMo/VNPay/ZaloPay đã xác minh chữ ký, đối chiếu provider/amount, dùng transaction và CAS; đây là nền an toàn hơn đường `BookingsService.confirmBookingPayment()` của Sony vốn cho public caller tự ghi paid và tạo `ThanhToan` không cần provider proof.
- Đã xóa `POST /api/v1/bookings/:bookingId/confirm-payment` cùng mutation service trùng. Nếu CAS đổi booking thất bại trong settlement transaction, nay throw để rollback thay vì commit một phần.
- SePay payload/docs hiện hành xác định `id` là ID giao dịch ổn định qua retry/replay; `code` là mã thanh toán; `referenceCode` là mã ngân hàng. SePay hỗ trợ API Key, HMAC-SHA256 và OAuth; tài liệu khuyến nghị HMAC. Nguồn: [payload và idempotency](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook), [xác thực](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc), [bảo mật](https://developer.sepay.vn/vi/sepay-webhooks/bao-mat).
- `ThanhToan` có trường nullable `maGiaoDichSePay VARCHAR(100)` để giữ nguyên ID provider dạng số dưới dạng text, với unique index `ThanhToan_maGiaoDichSePay_key`; migration additive `20261014181000_add_sepay_transaction_id` đã áp dụng riêng trên `vexgo_pr36`. Payment lịch sử không có event ID giữ `NULL`; unique constraint ngăn cùng một SePay transaction ID được lưu cho nhiều payment. `DonGiaoDich.maDonGiaoDich` vẫn là mã đơn, không thay thế transaction ID. Webhook hiện vẫn bị khóa và chưa ghi trường này.
- Chủ dự án xác nhận Dashboard dùng HMAC-SHA256. Theo [tài liệu xác thực SePay](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc) và [tài liệu bảo mật](https://developer.sepay.vn/vi/sepay-webhooks/bao-mat), handler kiểm tra `X-SePay-Signature: sha256=<hex>` và `X-SePay-Timestamp` theo Unix seconds; chuỗi ký là timestamp, dấu chấm, rồi **raw body bytes**; timestamp lệch quá 300 giây bị từ chối. Nest bật `rawBody` để xác minh đúng bytes đã nhận, và chữ ký được so sánh constant-time.
- `.env.example` dùng placeholder an toàn `SEPAY_WEBHOOK_SECRET`. `.env` thật không bị sửa; `SEPAY_WEBHOOK_SECRET` chưa được cấu hình trong local environment lúc kiểm tra. Cần đặt cùng secret với Dashboard riêng trong môi trường local/deploy, không gửi secret qua chat hoặc commit. `SEPAY_WEBHOOK_TOKEN` cũ không còn được handler đọc.
- Thiếu HMAC secret trả 503; chữ ký thiếu/sai hoặc timestamp ngoài cửa sổ trả 401. Chữ ký đúng vẫn trả HTTP 503 (`SERVICE_UNAVAILABLE`) trước mọi truy vấn/mutation DB cho tới khi các gate settlement bên dưới được chốt. Không log raw body, chữ ký hoặc secret.

## Files và callers

- `apps/api/src/bookings/bookings.controller.ts`, `apps/api/src/bookings/bookings.service.ts`: gỡ endpoint/service xác nhận paid công khai.
- `apps/api/src/main.ts`: bật Nest raw-body capture phục vụ xác minh chữ ký provider.
- `apps/api/src/payments/payments.controller.ts`, `apps/api/src/payments/payments.module.ts`: bỏ phụ thuộc `BookingsService`; controller chuyển raw body cùng hai header SePay tới handler.
- `apps/api/src/payments/payments.service.ts`: HMAC-SHA256, cửa sổ timestamp ±300 giây và so sánh constant-time; vẫn fail-closed cho tới khi settlement an toàn. Giữ rollback khi booking CAS thất bại.
- `.env.example`: thay mẫu API token cũ bằng placeholder an toàn cho `SEPAY_WEBHOOK_SECRET`.
- `apps/api/test/unit/payments/payments.service.spec.ts`, `apps/api/test/integration/payments/payments-webhook.spec.ts`: kiểm tra HMAC/fail-closed, raw-body chính xác qua HTTP, chữ ký thiếu/sai/hết hạn, SePay không mutate, route cũ 404, rollback trên MySQL, unique transaction ID và nhiều giá trị `NULL`.
- `prisma/schema.prisma`, `prisma/migrations/20261014181000_add_sepay_transaction_id/migration.sql`: thêm nullable SePay transaction ID có unique constraint; migration chỉ áp dụng trên DB worktree `vexgo_pr36`.
- Web còn caller legacy tại `apps/web/src/features/payments/components/payment-page.tsx` → `bookingsApi.confirmPayment()`. Backend hiện trả 404; Web bắt lỗi và không tạo success state từ response lỗi. Cần bỏ hành động này và nối polling/trạng thái thật trong R5; trong giai đoạn chuyển tiếp khách sẽ thấy lỗi khi bấm xác nhận thủ công.
- Không tìm thấy caller trong Admin hoặc Mobile ở source được kiểm tra. Không thể kết luận về external callers.

## Blockers và quyết định cần chủ dự án

1. **Ghi event ID khi xử lý callback:** schema đã sẵn sàng, nhưng handler chưa dùng trường mới. Chỉ triển khai ghi/đối soát SePay event sau khi hoàn thiện mapping với payment/order.
2. **Chốt mapping SePay:** backend chưa có quy tắc đã xác minh để map `code`/mã chuyển khoản tới đúng payment đang pending và cấu hình tài khoản nhận để kiểm tra `accountNumber`. Không dùng QR/frontend làm bằng chứng, không fuzzy-match theo content/booking ID; chỉ nhận tiền vào và amount chính xác. Xử lý chuyển dư cần quy tắc hoàn/đối soát.
3. **Late payment:** core hiện giữ booking/đơn đã hủy ở trạng thái hủy, ghi nhận provider payment là thành công và đánh dấu cần hoàn/đối soát; không có xử lý refund provider mới trong R4. Chưa tìm thấy timeout job chuyên biệt cho payment trong API source.
4. Đường Sony cũ cũng cập nhật `PhieuGuiHang` của booking kèm hàng. Settlement core hiện không cập nhật trạng thái này; cần quyết định/kiểm thử cùng shared cargo flow ở R8 trước khi khôi phục thanh toán cho booking có hàng.

Cho đến khi các quyết định trên được xử lý, không bật webhook SePay production và không tuyên bố R4 settlement hoàn tất. Các callback MoMo/VNPay/ZaloPay và refund processor giữ nguyên; refund provider mới không thuộc R4.

## Kiểm thử

- `npm exec -- prisma migrate status` trước thay đổi — **PASS**, database `vexgo_pr36` và shadow DB `vexgo_pr36_shadow` có 25 migration up to date.
- `npm exec -- prisma migrate deploy` — **PASS**, chỉ áp dụng `20261014181000_add_sepay_transaction_id` trên `127.0.0.1:3306/vexgo_pr36`; không chạy seed/reset.
- Integration test `payments-webhook.spec.ts` — **PASS, 24/24** trên MySQL worktree sau migration, gồm kiểm tra HMAC raw-body, timestamp, không settlement; hai payment có event ID `NULL` và từ chối ghi lặp cùng SePay transaction ID.
- `vitest run test/unit/payments/payments.service.spec.ts` — **PASS, 27/27**; `vitest run test/integration/payments/payments-webhook.spec.ts` — **PASS, 24/24** sau schema addition và migration (51 tests tổng).
- `npm exec -- prisma validate` — **PASS**; `npm exec -- prisma generate` — **PASS** với Prisma 7.10.0.
- `npm run typecheck` trong `apps/api` — **PASS**.
- `npm run lint` trong `apps/api` — **PASS**.
- `git diff --check` — **PASS**.
- Test ghi log exception 503 cho webhook hợp lệ đã xác thực nhưng đang bị khóa; đây là phản hồi fail-closed được kỳ vọng, không phải test failure.
- GitNexus index khả dụng chỉ thuộc checkout `SourceCode/vexgo` branch khác, stale 18 commits và không khớp worktree này; không dùng index đó. Blast radius được kiểm tra bằng source/caller search trực tiếp.

## Postman smoke checklist

1. Đọc booking/order đang `CHO_THANH_TOAN`; gọi `POST /api/v1/bookings/{bookingId}/confirm-payment` cũ, xác nhận 404 và đọc lại booking/order/payment không đổi.
2. Gửi request thiếu chữ ký, chữ ký HMAC sai hoặc timestamp cũ hơn 300 giây qua `POST /api/v1/payments/sepay-webhook`; xác nhận 401 và DB không đổi.
3. Với secret đã đặt riêng trong local env, tạo `X-SePay-Timestamp` bằng Unix seconds hiện tại và `X-SePay-Signature` từ HMAC-SHA256 của `timestamp + "." + raw JSON bytes`; gửi đúng nguyên bytes đã ký. Xác nhận chữ ký qua bước auth nhưng API trả HTTP 503 (`SERVICE_UNAVAILABLE`), trạng thái/order/payment không đổi. Không dùng Authorization API Key, không lưu secret vào collection/log và không chuyển khoản thật.
4. Migration đã áp dụng trên DB worktree. Không bật callback production cho tới khi mapping payment/order, tài khoản nhận, late-payment policy và ảnh hưởng booking kèm cargo được chốt. Sau đó mới chạy sandbox valid/mismatch/replay/concurrent và đọc lại payment/order/booking/ticket.
