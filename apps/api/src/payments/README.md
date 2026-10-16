# Thanh toán và xử lý settlement

## Production entrypoint

- SePay gửi callback vào `POST /api/v1/payments/sepay-webhook`; controller chuyển raw body, `x-sepay-signature` và `x-sepay-timestamp` cho `PaymentsService`.
- `PaymentsService.handleSepayWebhook` xác minh HMAC/timestamp, thời điểm `transactionDate` theo giờ Việt Nam, tài khoản nhận, mã đơn khớp chính xác, giao dịch tiền vào, số tiền VND và mã giao dịch duy nhất trước khi settlement.
- Đơn booking và đơn chỉ có shipment đi qua cùng callback và `confirmPaymentSuccess`; không có writer payment riêng cho shipment.

## Tạo payment và khóa dùng chung

- `createSepayPaymentAttempt` là helper ghi payment `SEPAY / THANH_TOAN / DANG_XU_LY` trong transaction tạo order của cả `BookingsService` và `ShipmentsService`.
- `PaymentSettlementService.withLockedPayment` mở transaction, khóa hàng `DonGiaoDich` bằng `lockPaymentOrder`, đọc lại payment/order/shipment trong khóa rồi gọi writer của `PaymentsService` trên cùng transaction client.
- Admin shipment status dùng cùng `lockPaymentOrder`, do đó thay đổi trạng thái vận chuyển và callback tiền không thể cùng ghi dựa trên một trạng thái order cũ.
- Booking settlement giữ cập nhật order, booking, vé, ghế và lịch sử trong transaction. Shipment-only settlement cập nhật payment và order; trạng thái vận chuyển vẫn bắt đầu ở `MOI_TAO` và được Admin cập nhật theo luồng riêng.

## Đọc trạng thái thanh toán

- `GET /api/v1/payments/:paymentId/status` yêu cầu Customer đã đăng nhập và kiểm tra payment thuộc hồ sơ Customer đó.
- Guest xác minh trạng thái shipment qua `POST /api/v1/shipments/lookup` bằng mã vận đơn cùng số điện thoại người gửi hoặc người nhận. Response chỉ trả dữ liệu theo dõi/thanh toán cần thiết sau khi khớp thông tin; không dùng payment ID tuần tự làm bằng chứng sở hữu.

## Hết hạn đơn và khoản thu đến trễ

- Deadline 10 phút được tính từ `DonGiaoDich.ngayTao`. Scheduler xử lý cả booking và shipment độc lập; booking kèm hàng tiếp tục hủy order, booking, vé, shipment, ghi history và nhả ghế như lifecycle hiện có.
- Callback settlement lấy cùng `DonGiaoDich` lock và so deadline với thời điểm giao dịch ngân hàng đã xác thực từ SePay, không dùng thời điểm webhook tới server để phân loại giao dịch đúng hạn. Nếu scheduler chưa chạy và giao dịch đã tới/sau deadline, transaction settlement tự hủy order/shipment, ghi history và đánh dấu payment attempt đang chờ thất bại trước khi ghi nhận khoản tiền SePay đã xác thực.
- Thời điểm server xử lý vẫn được dùng để ghi lúc tự hủy. Nếu scheduler đã hủy order trước khi callback tới, kể cả `transactionDate` cho thấy tiền vào trước deadline, callback chỉ ghi nhận tiền và yêu cầu đối soát; không hồi sinh shipment/order đã hủy.
- Shipment hết hạn chuyển `DonGiaoDich` và `PhieuGuiHang` sang `DA_HUY`; trạng thái này loại hàng khỏi phép tính capacity hiện có. Callback đến sau chỉ chuyển payment thành `THANH_CONG` và lưu transaction ID, không phục hồi order, shipment hoặc capacity.
- Reconciliation được nhận biết bền khi SePay đã thu tiền cho order/booking/shipment đã hủy hoặc khi order đã settlement nhận thêm một transaction SePay khác. Giao dịch bổ sung được lưu thành payment `CAN_DOI_SOAT` riêng, không settlement lại order; payment status API và guest shipment lookup trả `requiresReconciliation`. Không tự gọi refund provider.
- Scheduler, settlement và status mutation đều serialize trên cùng order lock. Webhook replay không thêm history hay side effect lần nữa.

## Kiểm thử tham chiếu

- `apps/api/test/integration/payments/payments-webhook.spec.ts` kiểm tra signed production callback cho shipment-only order và booking, idempotency, validation/chữ ký, ownership/status, settlement và các regression booking.
- `apps/api/test/integration/shipments/shipments.spec.ts` kiểm tra POST tạo shipment guest qua HTTP và xác minh order/payment tồn tại với đúng amount/deadline.
- `apps/api/test/unit/payments/payment-settlement.service.spec.ts` kiểm tra shared order-lock boundary.
