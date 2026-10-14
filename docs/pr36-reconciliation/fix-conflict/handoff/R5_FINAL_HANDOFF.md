# R5 — Handoff Customer Web Payment/QR

## Kết quả

R5 đã chuyển màn thanh toán sang đọc booking đã được backend xác thực làm nguồn dữ liệu cho mã đơn, số tiền, hạn thanh toán và trạng thái. QR chỉ hiển thị khi booking khớp ID, mã đơn, số tiền, đang chờ thanh toán và có deadline hợp lệ; giao diện không gọi API xác nhận thanh toán thủ công. Khi backend báo booking và payment đều `DA_THANH_TOAN`, frontend điều hướng đúng một lần tới invoice.

Trang invoice chỉ hiển thị vé khi API trả đúng booking ID, payment đã thanh toán và booking ở trạng thái `DA_THANH_TOAN` hoặc `HOAN_TAT`. Dữ liệu sessionStorage không còn được dùng làm bằng chứng thanh toán hoặc dựng vé mẫu. Lỗi API, booking đang chờ, bị hủy/hết hạn, không khớp hoặc thiếu dữ liệu đều dừng ở trạng thái cảnh báo, không hiển thị vé đã thanh toán.

## Phạm vi và file

- `apps/web/src/features/payments/components/payment-page.tsx`: xác minh booking qua `GET /api/v1/bookings/:id/detail`; kiểm tra identity/reference/amount/status/deadline; polling có timeout, retry hữu hạn khi lỗi khởi tạo, dừng theo deadline/trạng thái cuối và abort khi unmount; bỏ thao tác `confirmPayment()` cùng ghi trạng thái paid giả.
- `apps/web/src/features/payments/components/invoice-page.tsx`: chỉ đọc booking từ API; gửi bearer token hoặc bằng chứng guest bookingCode + phoneNumber để backend quyết định quyền đọc; chỉ dựng invoice sau trạng thái paid; bỏ fallback sessionStorage và dữ liệu vé mẫu.
- `apps/web/src/features/account/services/bookings.api.ts`: xóa wrapper `confirmPayment()` không còn caller trong Customer Web; tìm kiếm source xác nhận frontend không còn gọi endpoint `confirm-payment`.
- `apps/web/test/unit/payments/payment-page.spec.tsx`: kiểm thử hành vi QR, pending/paid/terminal/error, identity/amount mismatch, timeout, cleanup và không gọi mutation.
- `apps/web/test/unit/payments/invoice-page.spec.tsx`: kiểm thử component invoice khi pending, paid, unauthorized/API lỗi, guest/auth, dữ liệu sessionStorage cũ và unmount.
- `apps/api/test/integration/bookings/booking-status-history.spec.ts`: mở rộng regression DB-backed xác minh booking guest/customer → payment SEPAY chờ → webhook HMAC hợp lệ → API detail trả đúng booking/order/amount, trạng thái paid, deadline, server time và vé.
- `apps/web/package.json`: đưa invoice component test vào lệnh test mục tiêu của Customer Web.
- `apps/web/AGENTS.md` và `apps/web/CLAUDE.md`: Next.js tự tạo hướng dẫn agent của phiên bản đang dùng khi chạy dev server; đã đọc hướng dẫn và tài liệu cấu trúc Next.js tương ứng.
- `docs/pr36-reconciliation/fix-conflict/handoff/R5_FINAL_HANDOFF.md`: tài liệu bàn giao này.

Không đổi API/backend runtime, Prisma schema, database structure, migration, webhook implementation, settlement implementation, `.env` hoặc cấu hình SePay. Integration test chỉ tạo và dọn fixture thuộc test riêng trên database `vexgo_pr36`.

## Đối chiếu review conversations

- **F1 P1 — `PRRT_kwDOUfyB7s6sZcTY`:** invoice chỉ dùng response backend có quyền truy cập và trạng thái booking/payment đã thanh toán; pending, terminal, mismatch, lỗi API/offline và dữ liệu session cũ không dựng hóa đơn success.
- **F2 P2 — `PRRT_kwDOUfyB7s6sZcTm`:** QR chỉ xuất hiện sau khi booking backend khớp ID, booking/order code, amount và trạng thái chờ; QR dùng amount/reference xác minh từ response backend.
- **F3 P2 — `PRRT_kwDOUfyB7s6ryIAt`:** polling dùng deadline/serverTime từ backend, retry ban đầu có giới hạn, ngừng ở deadline/trạng thái terminal, và hủy timer/request khi unmount.
- Ba review conversations vẫn chưa được resolve; reviewer cần tự xác minh rồi resolve.

## Kiểm thử và self-review

- `apps/web: npm test`: PASS — 104 Node tests và 51 Vitest tests trong 3 file mục tiêu.
- Customer Web `npm run typecheck`: PASS — `next typegen` và `tsc --noEmit` hoàn tất.
- ESLint các component/test Customer Web liên quan: PASS — 0 lỗi; 2 warning `<img>` ở payment/invoice.
- API integration `npx vitest run --config vitest.config.ts test/integration/bookings/booking-status-history.spec.ts -t "creates a SePay attempt atomically and settles"`: PASS — 2 trường hợp guest/customer trên MySQL `vexgo_pr36`.
- API `npm run typecheck`: PASS. Oxlint trên integration test: PASS, có một warning `typescript(no-misused-spread)` tại dòng 38, không nằm trong thay đổi R5.
- Toàn bộ file integration `booking-status-history.spec.ts`: PASS — 12 tests; có một log lỗi được test cố ý tiêm để kiểm tra rollback, không phải test failure.
- Browser smoke desktop 1440×900 và mobile 375×667 tại Customer Web cổng 3004: PASS cho hiển thị pending, mã tham chiếu server, QR khi cấu hình local hợp lệ, không có nút xác nhận thủ công và không tràn ngang. Phản hồi `GET /bookings/:id/detail` trong browser smoke được stub ở tầng network.
- Browser smoke phản hồi chuyển pending → paid: PASS cho điều hướng tới `/invoice/:id` đúng một lần và chỉ hiển thị invoice sau paid. Phản hồi backend được stub ở tầng network.
- Luồng browser nối trực tiếp API local + webhook SePay sandbox → polling thật: DEFERRED. Khi kiểm tra, cổng API 4002 không có listener; vì vậy không ghi nhận đây là smoke end-to-end. R4 đã kiểm tra settlement/backend riêng bằng integration test nêu trên.
- `git diff --check`: PASS. GitNexus index cũ hơn worktree 2 commit; lần `analyze --index-only` bị dừng sau hơn 5 phút và trả exit 1. Kết quả impact còn trỏ caller `confirmPayment` cũ nên không dùng làm kết luận; đã đối chiếu source trực tiếp và không còn caller.
- Diff R5 không chứa thay đổi API runtime, Admin, booking creation, cargo, database structure, migration, env, README hoặc handoff R4. Hai file hướng dẫn agent trong apps/web do Next.js tự sinh khi chạy dev server.

## Checklist smoke test thủ công

Dùng API/Web local sau khi khởi động đúng cấu hình worktree: Customer Web `http://localhost:3004`, API base `http://localhost:4002/api/v1`. API chưa được xác nhận đang chạy trong lần kiểm tra này.

1. Tạo một booking một chiều qua Customer Web, lấy `bookingId`, `bookingCode`, `orderCode` và `totalAmount` do API trả về.
2. Gọi `GET /api/v1/bookings/{bookingId}/detail` bằng bearer token của chủ booking hoặc cặp header guest `x-booking-code` và `x-booking-phone`. Xác nhận response có đúng booking, orderCode, totalAmount, trạng thái, `paymentExpiresAt` và `serverTime`.
3. Theo luồng Customer Web mở màn payment. So sánh số tiền/nội dung chuyển khoản trên web với response API và QR. Trước khi webhook được backend xác nhận, UI phải giữ trạng thái đang chờ.
4. Nếu thiếu một biến cấu hình VietQR, xác nhận QR bị ẩn và hiện cảnh báo; không bấm hoặc gửi thao tác xác nhận thanh toán từ frontend.
5. Gửi giao dịch sandbox qua webhook SePay đã cấu hình và để backend xác minh callback. Chờ polling; chỉ sau khi API trả booking/payment paid, UI mới chuyển tới `/invoice/{bookingId}`.
6. Mở trực tiếp invoice khi booking pending, hoặc thử sai guest code/phone: không được thấy vé/badge “Đã thanh toán”. Sau khi API trả paid với đúng quyền sở hữu, kiểm tra mã booking/order và số tiền trên invoice khớp backend.
7. Thử API 401/403/404/5xx, booking bị hủy/hết hạn và tải lại/unmount: không có success giả; request/timer polling được dừng hoặc cleanup.

## DEFERRED / rủi ro ngoài R5

- Chưa thực hiện full browser smoke bằng webhook SePay sandbox thật do API local cổng 4002 không chạy tại thời điểm kiểm tra. Cần chủ dự án tự bật API và xác minh webhook sandbox trước khi xác nhận end-to-end.
- Invoice chính thức cho round-trip/aggregate nhiều booking không thuộc R5; API hiện map chi tiết từng booking theo chuyến. Không dùng fallback để ghép hai lượt. Cần task riêng nếu backend cung cấp contract round-trip aggregate.
- Không harden hoặc thay đổi xác thực webhook, kiểm tra settlement/payment, guest claim/ownership backend trong task này. Review findings ngoài R5 giữ nguyên; reviewer xác minh và tự resolve review conversations.
