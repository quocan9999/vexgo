# Chatbot: xác minh và sửa bảo vệ phiên, tra cứu, lịch sử

Baseline: develop `ec75064`, PR68. Nhánh: `fix/ai-chatbot-session-and-lookup-safety`. Phạm vi Backend dùng chung Web/Mobile; không đổi schema/migration hoặc quy tắc hủy vé của TicketsService.

## Bằng chứng trước sửa

Chạy `test/unit/ai-chatbot/ai-chatbot-security.spec.ts` với service thật và bản ghi tổng hợp (không có khách thật): **8 fail / 1 pass**. Các assertion thất bại xác nhận:

- Phiên có khachHangId trả lịch sử khi không có principal và khi principal khác chủ.
- POST tái sử dụng token của phiên khác không bị từ chối.
- Tool vé/vận đơn bỏ qua kiểm tra điện thoại nếu thiếu input; tool vé trả phí cố định0.1 và dùng `||` làm mất giá vé0.
- Nhánh trả lời/handoff chỉ ghi ASSISTANT, không ghi USER; lỗi đồng bộ session bị nuốt rồi tiếp tục trả lời như thành công.
- Handoff nói “đang kết nối” trong khi không có tác vụ kết nối nhân viên.

Đây là kiểm chứng thực thi tự động, không phải khai thác dữ liệu thật hoặc E2E với MySQL/LLM. Log trước sửa nằm ngoài repo tại `mobile-qa-evidence/chatbot-prep-20261108/backend-security-before.log`.

## Bản sửa

- Phiên gắn khách hàng yêu cầu JWT đúng chủ cho GET history và POST reuse. Identity chỉ lấy từ principal đã xác thực. Không tạo phiên vô chủ khi principal không ánh xạ được khách hàng.
- Phiên guest giữ mô hình UUID bí mật/capability để khách vãng lai tiếp tục sử dụng. Không dùng token guest cho phiên authenticated: đổi identity phải mở phiên mới. Không coi token guest là public/shareable; che token trong log URL và lỗi not-found.
- UUID validation và message trim/1–2000 ký tự; body không nhận customerId để đổi chủ.
- Tool tra cứu bắt buộc số điện thoại đầy đủ hợp lệ trước truy vấn, chuẩn hóa0/+84 và so khớp toàn bộ số người đặt hoặc người gửi/nhận. Không so9 số cuối hay bỏ qua bước xác minh.
- Tool vé dùng quote từ `TicketsService.lookupTicket`, không tự tính eligibility/phí hủy; dùng nullish fallback để giữ giá0. Chatbot không thực hiện hủy hoặc hoàn tiền.
- Ghi USER trước xử lý và ghi ASSISTANT trước ACK; lỗi lưu trả503 `AI_HISTORY_UNAVAILABLE`. History sắp theo createdAt rồi id để ổn định khi nhiều tin cùng giây. Không tạo dữ liệu USER giả cho phiên lịch sử đã mất câu hỏi.
- Copy handoff hướng dẫn user mở kênh CSKH, không khẳng định đã chuyển/đã gửi khiếu nại. System prompt và tài liệu mặc định sửa về hoàn tiền qua liên hệ hỗ trợ.
- Khi bootstrap, chỉ nhận diện tài liệu GLOBAL `DOC-CANCEL-POLICY` đúng SHA-256 của nội dung mặc định cũ rồi thay nội dung và xóa chunks cũ trong transaction. Sau transaction mới tạo embedding/chunks mới. Không ghi đè tài liệu nhà xe/custom. Đây là cập nhật dữ liệu tri thức có kiểm soát khi khởi động bản mới, không phải migration/reset/seed toàn DB.

## Kiểm thử sau sửa

- **107/107** test chatbot + TicketsService qua, trong10 files. Trong đó21 ca mới (17 service/unit,4 HTTP integration);22 ca chatbot có sẵn và64 ca vé.
- HTTP integration dùng controller, validation/envelope/error filter, AccessTokenGuard và JWT ký/kiểm tra thật, với Prisma records trong bộ nhớ. Xác nhận guest/khác chủ403, owner200, JWT sai401, guest capability vẫn hoạt động, payload sai400 và USER/ASSISTANT được lưu. Không giả đây là MySQL/live server E2E.
- Build và TypeScript noEmit qua. Lint type-aware exit0, còn warning của codebase; không tuyên bố zero-warning.
- Mở rộng auth/API foundation:342 qua,6 fail. Chạy lại riêng2 file trên worktree develop ec75064 nguyên bản:66 qua, **cùng6 fail**. Bốn assertion catalog chưa có quyền dashboard mới; hai assertion lỗi chung nhận raw404/unstructured HttpException message. Những file đó không được sửa trong PR chatbot. Lỗi chung có thể lộ message nội bộ và cần follow-up riêng.

Lệnh chạy (từ apps/api, Node binary dùng dependency root có sẵn):

```text
node ../../node_modules/vitest/vitest.mjs run test/unit/ai-chatbot test/integration/ai-chatbot test/unit/tickets --reporter=dot
```

Log: `backend-security-targeted-final.log`, `backend-security-regression.log`, `backend-baseline-regression.log`, `backend-security-build.log`, `backend-security-typecheck.log`, `backend-security-lint.log` dưới cùng thư mục evidence ngoài repo. Log giữ dữ liệu test tổng hợp, không chứa key Groq/Jina thật.

## Triển khai và giới hạn

Chưa restart API QA/report, migrate hoặc ghi DB chính/QA thật trong lượt này. Chưa gọi Groq/Jina hoặc test Android. Khởi động app mới chỉ thực hiện sau review; dùng migration chatbot từ PR68 trước nếu DB chưa có4 bảng AI.

Không thêm idempotency/requestId: timeout vẫn phải kiểm tra lịch sử, không tự retry POST. USER có thể đã lưu nhưng ASSISTANT chưa lưu khi request lỗi;503 phản ánh chưa ACK. Các phiên cũ chỉ có ASSISTANT không thể khôi phục câu hỏi đã mất.

Client gửi/đọc phiên authenticated phải kèm JWT; client guest không cần đăng nhập. Token phải tách khi login/logout, đổi tài khoản/nhà xe. Mobile core đã giữ token trong bộ nhớ, bỏ phản hồi phiên cũ và chặn tự gửi lại. Lịch sử USER mới có thể parse cùng history DTO đã chuẩn bị. Web hiện gửi anonymous nên tiếp tục theo guest capability; token cũ không phải UUID cần bỏ và tạo mới.

Các tài liệu chính sách mặc định khác (hành lý/VAT/đối tượng ưu tiên…) vẫn cần nhà xe/lead duyệt nội dung. PR này chỉ sửa mâu thuẫn hoàn tiền đã xác nhận; không coi mọi văn bản mẫu là chính sách chính thức.

## Kiểm tra ảnh hưởng

GitNexus index ec75064 tại worktree riêng, chạy impact trước sửa. Lookup tools → orchestrator → service/controller; history → controller; bootstrap policy → retrieval; logger sanitizer → request logger. Các target đã phân giải có riskLOW; controller dynamic HTTP và một số receiver là giới hạn của callgraph, đã đối chiếu source và HTTP tests, không coi caller rỗng là không ảnh hưởng. Detect-changes phải hoàn tất trước commit; không sửa source Web/Admin hoặc schema.
