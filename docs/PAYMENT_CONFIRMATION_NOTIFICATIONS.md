# Thông báo khách hàng: inbox, email và Android push

Base Backend develop `66a2ce8`. Phối hợp với nhánh Mobile
`feature/payment-confirmation-notifications`.

## Sự kiện và tính nhất quán

- Thanh toán được quyết toán hợp lệ: `booking-paid:<bookingId>`. Đọc lại vé đã thanh toán, tổng đơn gồm phí hàng và toàn bộ mã vé. Đơn miễn phí dùng cùng event sau khi phát hành vé.
- Hủy vé: `ticket-cancelled:<ticketId>`. Nội dung phân biệt khoản hoàn đang chờ với hoàn thành công.
- Hoàn tiền: hỗ trợ xử lý ngoài ứng dụng sau khi khách liên hệ. Hủy vé không tự phát sinh xác nhận hoàn tiền thành công. Helper `refund-succeeded:<paymentId>` chỉ chấp nhận bản ghi đã hoàn tất và không được refund processor gọi tự động nữa.
- Nhắc điểm đón: `departure-reminder:<ticketId>:<pickupMillis>`, trong 2 giờ trước giờ đón theo snapshot và múi giờ nghiệp vụ. Kiểm tra lại vé, đơn, chuyến và giờ đón trước khi gửi; bỏ job đã hết hiệu lực.

Inbox/outbox được tạo trong transaction nghiệp vụ; rollback không để lại thông báo thành công. Unique eventKey chống lặp callback/worker. Không phát lại đơn cũ chỉ vì triển khai tính năng. Khách vãng lai chỉ nhận email hợp lệ; không tự ghép tài khoản theo số điện thoại. Mỗi chiều khứ hồi có booking/event riêng.

## Migration và cấu hình

Sao lưu, migrate deploy, generate Prisma Client rồi build/restart; không reset/seed:

- `20261105020000_payment_confirmation_notifications`: metadata ThongBao và EmailThongBao.
- `20261105021000_customer_push_notifications`: ThietBiThongBao và PushThongBao.

Hai migration đã áp dụng DB test và DB local chính sau khi được đồng ý. Backup chứa dữ liệu cá nhân được giữ ngoài Git. Bảng push lưu ID tham chiếu; worker kiểm tra lại ownership, thiết bị và phiên hiện tại trước khi gửi. Rollback ứng dụng có thể giữ bảng/cột thêm mới; không xóa outbox đang chờ.

Cấu hình Backend theo `.env.example`:

```dotenv
SMTP_ENABLED=false
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
NOTIFICATION_REMINDERS_ENABLED=false
FCM_ENABLED=false
FCM_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

SMTP 465 dùng TLS trực tiếp, 587 bắt buộc STARTTLS; không bỏ kiểm tra certificate. Service-account JSON chỉ nằm trên server, ngoài Git/Flutter. Bật riêng từng worker sau khi cấu hình. Không cần đổi SePay cho email/push. Lỗi gửi sau commit không đổi trạng thái tiền/vé.

## Giao nhận và vận hành

Email/push dùng claim atomic và lease, hỗ trợ nhiều instance. Email được SMTP chấp nhận -> SENT, không chứng minh thư vào Inbox. Lỗi từ chối rõ ràng retry tối đa 5 lần; timeout/mất kết nối không rõ kết quả hoặc crash sau gửi -> UNKNOWN, không tự gửi lại. Cần đối soát provider trước thao tác lại. Push gửi lỗi không xác định cũng không retry mù; token không hợp lệ bị vô hiệu hóa đúng binding.

Push chỉ chứa nội dung chung, notificationId và recipientCustomerId; không đưa thông tin hành khách/vé lên màn khóa. Trước gửi phải khớp chủ sở hữu, token, phiên còn hiệu lực và tài khoản hoạt động. Token được mã hóa đường truyền và lưu trong DB có kiểm soát truy cập; không ghi token/body/secret vào application log. Đăng ký đồng thời retry riêng transaction idempotent khi P2002/P2034.

Reminder quét tối đa 100 vé/lượt mỗi phút với cursor luân phiên. Tải dữ liệu rất lớn có thể làm chậm nhắc; không cam kết SLA ở quy mô chưa đo. FCM có thể chậm do mạng/OS; trạng thái SENT chỉ là provider chấp nhận. TTL push hiện là 1 giờ.

## API Mobile

GET `/api/v1/notifications` scope theo customer; item có recipient `id`, `notificationId`, `category`, `bookingId`, `ticketId`, `isRead`, `createdAt`, `readAt`. PATCH `/notifications/:id/read` dùng recipient id; giữ PATCH `/notifications/read-all`. Với nhiều vé, ticketId là vé đầu tiên, nội dung liệt kê toàn bộ mã vé. Chi tiết vé vẫn kiểm tra ownership.

POST/DELETE `/api/v1/notifications/devices`, body `{ "token": "..." }`, yêu cầu phiên khách hàng thật. Đăng ký gắn token vào customer/account/session hiện tại; unregister chỉ tác động token của account gọi. Hỗ trợ FID và registration token; Mobile hiện dùng firebase_messaging 16 qua getToken; thiết bị nâng cấp trong đợt QA vẫn trả ID 22 ký tự được Backend nhận diện là FID.

## Bằng chứng và giới hạn

- Unit thông báo cuối: 34/34; TypeScript và Nest build qua.
- MySQL riêng: 53/53 test qua, kiểm tra settlement/rollback, dedupe, hủy/hoàn/nhắc và đăng ký thiết bị. Test thiết bị dùng JWT/session thật, gồm 4 request đăng ký đồng thời; phần harness thanh toán còn dùng principal test.
- Gmail SMTP thật: một thư QA được chấp nhận, người dùng xác nhận nhận trong Inbox. Không gửi vé cũ hàng loạt.
- Android realme 11 / Android 15: foreground nhận sự kiện và tự tải lại inbox; background hiện thông báo, chạm mở inbox; sau khi kết thúc tiến trình bằng kill (không Force stop), push vẫn hiện, chạm khởi động lại app và tải thông báo mới. Các probe dùng thông báo QA SYSTEM, không tạo booking/thanh toán thật.
- Luồng hoàn tiền online đã ngừng: processor không gửi request hoặc tự hoàn tất giao dịch, kể cả khi có cấu hình provider cũ. Kiểm thử MySQL riêng xác minh khoản hoàn vẫn pending, không phát sinh notice/email/push hoàn thành. Đây không phải bằng chứng chuyển tiền thật.
- Ba suite integration booking/history chỉ cập nhật cleanup fixture, chưa chạy local do yêu cầu môi trường riêng; cần CI kiểm tra.

Log, APK, backup và cấu hình riêng nằm ngoài Git. Không chia sẻ nguyên thư mục bằng chứng vì chứa credential và dữ liệu cá nhân.
