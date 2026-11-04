# Hoàn tiền qua hỗ trợ sau hủy vé

## Quy tắc

Khách hủy vé qua API hiện có, sau đó chủ động liên hệ hỗ trợ và cung cấp mã vé để yêu cầu hoàn tiền theo chính sách nhà xe. Hệ thống không hoàn tiền online hoặc cam kết thời gian tiền về.

## Backend

- RefundProcessorService giữ chữ ký tương thích cho các caller hiện có, nhưng không đọc cấu hình provider, tạo timer, gọi network, ghi DB hoặc tự hoàn tất khoản hoàn.
- Giữ tính phí, eligibility, transaction hủy/giải phóng ghế và bản ghi HOAN_TIEN/DANG_XU_LY cho đối soát thủ công. RefundAmount chỉ là số tiền dự kiến theo chính sách.
- Response và notice hủy (dùng chung inbox/email/push) chỉ dẫn khách liên hệ hỗ trợ. Không đổi cấu trúc response.
- .env.example bỏ cấu hình provider cũ, ghi rõ không được dùng. Dù env local cũ còn giá trị, processor cũng không gửi request.
- Không thêm migration, không đổi schema hoặc chỉnh DB chính. Không tự đổi lịch sử đã hoàn tiền. Không thêm endpoint quyết toán thủ công; nghiệp vụ quản trị đó cần phạm vi riêng nếu triển khai.

## Client

Mobile ở nhánh fix/mobile-manual-refund-support đã đổi thông báo trước/sau hủy, nhãn Dự kiến hoàn và CTA vào chat hỗ trợ hiện có. Guest lookup có hướng dẫn đăng nhập để chat. Không tự gửi tin nhắn. Frontend Web cần đối chiếu nhãn riêng nếu còn hiển thị cam kết hoàn online; thay đổi này không chỉnh mã UI Web/Admin.

## Kiểm chứng

- 54/54 unit test ở refund processor, tickets và lifecycle notices qua.
- TypeScript typecheck và oxlint type-aware trên hai source file thay đổi qua.
- DB test riêng: hai lifecycle integration test trong payments-webhook qua; 51 ca còn lại bỏ qua do lọc. Xác minh bản ghi hoàn vẫn DANG_XU_LY, thoiDiemHoanTat null, không gọi provider và không tạo notice/email/push hoàn thành. Không chuyển tiền thật.
- Booking-status-history integration chỉ cập nhật expected message, chưa chạy suite cần DB/user cô lập riêng của suite đó.
- API chính đang chạy chưa tự restart/deploy nhánh này.

## Phân tích ảnh hưởng

Worktree vexgo_payment_notifications_api_worktree, nhánh fix/manual-refund-support, base cb13ad7 (nhánh thông báo). GitNexus index còn tại 66a2ce8, chậm một commit; đã thử refresh nhưng không hoàn tất và dừng tiến trình. Impact class báo CRITICAL (3 direct callers, mở rộng rộng qua DI). ProcessRefund có 5 dependants; cancelTicket service có một caller giải được và một receiver không giải được. Đã đối chiếu text callers và diff commit thông báo tại đúng source trước sửa. Detect-changes nhận 9 file/12 symbol, nhưng không dùng số 0 affected-processes của index cũ làm bằng chứng không ảnh hưởng. Đã thử refresh lại khi chuẩn bị PR nhưng vẫn không hoàn tất; giữ rõ giới hạn index cũ khi review. Bước detect_changes trên đúng worktree vẫn phải chạy trước commit theo AGENTS.md.

PR Backend đặt trên nhánh feature/payment-confirmation-notifications của PR #54; sau khi PR cha merge cần retarget develop và kiểm tra lại diff/CI. Mobile phối hợp: https://github.com/quocan9999/vexgo_mobile/pull/19. Không tự merge.
