# SePay — xác minh tài khoản nhận tiền

## Finding và thay đổi

- Xử lý review thread `PRRT_kwDOUfyB7s6sWMrd`: webhook có thể settle đơn khi giao dịch được chuyển vào tài khoản khác.
- `PaymentsService.handleSepayWebhook()` tiếp tục xác minh HMAC-SHA256 và timestamp trước khi parse payload; sau đó yêu cầu `SEPAY_ACCOUNT_NUMBER` hợp lệ và `payload.accountNumber` là chuỗi không rỗng, không có khoảng trắng thừa, khớp chính xác.
- So sánh nguyên văn nên giữ số `0` đầu; không ép kiểu số, trim để so khớp, so khớp một phần hoặc đọc `NEXT_PUBLIC_*`.
- Kiểm tra tài khoản diễn ra trước mọi truy vấn đơn/payment và settlement, bao gồm retry có transaction ID đã xử lý. Không có ngoại lệ cho PAYMENT_DEMO_MODE hay SePay Test Mode.
- Cấu hình backend thiếu/rỗng/không hợp lệ trả `503 SEPAY_ACCOUNT_NOT_CONFIGURED`. Payload thiếu/sai kiểu/rỗng trả `400 SEPAY_ACCOUNT_NUMBER_INVALID`; tài khoản không trùng trả `400 SEPAY_ACCOUNT_MISMATCH`. Không ghi số tài khoản, chữ ký hay secret vào log.
- Đã thêm `SEPAY_ACCOUNT_NUMBER=` rỗng vào `.env.example`. Không sửa `.env` hoặc giá trị cấu hình local. Developer phải tự điền chính xác số tài khoản backend cho phép nhận, khớp với `accountNumber` SePay gửi; không gửi giá trị qua chat.

## Đối chiếu và phạm vi

- Review thread hiện tại là P1 và unresolved. `origin/develop` không có handler SePay HMAC hiện tại; giữ adapter và settlement core đã tích hợp trên branch, chỉ bổ sung allowlist tài khoản ở đầu handler.
- Tài liệu SePay chính thức mô tả `accountNumber` là trường chuỗi số tài khoản trong webhook payload: [Tích hợp webhook SePay](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook).
- Context7 NestJS xác nhận ConfigService đọc cấu hình môi trường; xử lý tại handler giúp cấu hình thiếu fail closed mà không thay đổi bootstrap/API providers.
- GitNexus re-index hoàn tất trên worktree nhưng MCP vẫn báo index chậm 8 commit. Exact impact của `PaymentsService.handleSepayWebhook` là LOW, với caller trực tiếp là controller và unit tests; `detect_changes` báo CRITICAL/776 flows do symbol `accountNumber` không có ID graph và gắn nhầm nhiều flow không liên quan. Đã đối chiếu source callers và test HTTP; không diễn giải các process name kia thành blast radius thật.
- Không thay đổi webhook authentication, replay protection, amount/reference validation, transaction, settlement, API route, schema, migration, QR, polling hay provider khác.

## Kiểm thử

- TDD: regression unit tests ban đầu đỏ **12 case** trên implementation cũ vì không kiểm tra account/config.
- `npm test -- test/unit/payments/payments.service.spec.ts`: **PASS — 53/53**.
- `npm test -- test/integration/payments/payments-webhook.spec.ts`: **PASS — 33/33** trên MySQL worktree `vexgo_pr36`; kiểm tra HTTP ký HMAC, tài khoản khớp, sai/thiếu tài khoản không mutate order/booking/payment/ticket/history, và replay cùng transaction ID nhưng sai tài khoản bị từ chối.
- Fixture integration dùng chuỗi kiểm thử có số `0` đầu và khôi phục lại các biến môi trường process sau suite. Không migration, reset hoặc seed database.
- `npm run typecheck` trong `apps/api`: **PASS**.
- `npm run lint` trong `apps/api`: **PASS**.
- `git diff --check`: **PASS**.

## SePay Test Mode smoke

- **BLOCKED, chưa chạy:** `.env` local hiện chưa có key `SEPAY_ACCOUNT_NUMBER`. Không thay đổi `.env` và không thực hiện chuyển khoản thật.
- Trước smoke, tự thêm `SEPAY_ACCOUNT_NUMBER=<số tài khoản nhận đã cấu hình trên SePay>` vào `.env` root; dùng chính xác chuỗi `accountNumber` trong payload test, giữ nguyên số `0` đầu. Khởi động lại API để tải cấu hình.
- Tạo một giao dịch mô phỏng mới trong SePay Test Mode và gửi webhook đã ký tới API. Kỳ vọng đúng tài khoản trả HTTP 200 `{ "success": true }`; sai tài khoản hoặc thiếu `accountNumber` trả HTTP 400 và booking/payment giữ nguyên; nếu chưa cấu hình biến thì HTTP 503. Đọc trạng thái từ API/DB worktree sau mỗi trường hợp.

## Git và review

- Giữ nguyên các thay đổi có sẵn tại `README.md` và `docs/pr36-reconciliation/fix-conflict/handoff/R4_FINAL_HANDOFF.md`; không đưa vào commit finding này.
- Không push, không tạo PR và không resolve review conversation. Reviewer cần xác minh diff rồi tự resolve thread.
