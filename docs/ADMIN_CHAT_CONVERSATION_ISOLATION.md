# Admin chat: tách lịch sử theo hội thoại — 30/10/2026

Base Backend/Web develop d29e9c8. Lỗi xuất hiện khi chuyển giữa các hội thoại đã tải:
Admin giữ mảng messages cũ rồi reconcile với lịch sử mới, khiến tin nhắn của nhiều
hội thoại cùng hiển thị dưới tên khách đang chọn.

## Sửa

- Giới hạn tin nhắn dùng để render, read receipts và cursor theo cuocTroChuyenId
  đang chọn ngay trong render, kể cả trước khi request hoàn tất hoặc khi tải lỗi.
- Lúc nhận lịch sử chỉ reconcile tin thuộc hội thoại đích; vẫn giữ tin realtime
  cùng hội thoại đến trong khi request đang chạy. Giữ nguyên request guards cũ.
- Không xóa tin trong DB; lịch sử đã đóng vẫn xem riêng. Không đổi API/schema.
- Thêm dependencies ổn định của state setters để giữ lint React Compiler.

## Kiểm thử

- Hai regression mới: chuyển sau khi lịch sử cũ đã tải, giữa khách khác nhau và
  hai hội thoại của cùng khách; kiểm tra cả thời gian tải chậm và chuyển trở lại.
  Cả hai thất bại trên source cũ tại assertion không còn tin trước, qua sau sửa.
- Suite admin-chat-messenger:24/24 qua sau sửa. Typecheck sau Next typegen qua.
- Browser thật Chrome + API/MySQL local: chuyển97(đã đóng) →98(cùng khách)
  →99(khách demo), từng transcript chỉ có tin riêng. DB đọc đối chiếu:97 có10tin,
  98 và99 mỗi hội thoại2tin. Không gửi thêm tin hoặc đóng thêm hội thoại khi retest.
- Source đã áp dụng vào vexgo_chat_worktree đang phục vụ Admin3005 để người dùng
  test tiếp; bản gốc được sao lưu ngoài Git. Nhánh fix giữ thay đổi để review.
- Chưa thực thi full Admin suite/build hoặc chu kỳ live đóng/mở/gửi tin mới;
  không dùng kết quả kiểm tra lịch sử để khẳng định các gate đó đã qua.

Evidence riêng ở mobile-qa-evidence/chat-isolation-*.log và
cargo-device-20261029/admin-chat-isolation-fixed.png. Không đưa dữ liệu phiên,
thông tin liên hệ hoặc bản sao DB vào PR. Người dùng đã yêu cầu commit/push/tạo PR; chưa merge.

GitNexus detect-changes trên vexgo_chat_worktree (production file có hash giống hệt nhánh fix) nhận diện 2symbols,5flows, risk medium. Chỉ mục runtime còn cũ; không coi đây là bằng chứng toàn hệ thống không bị ảnh hưởng. Phân tích index riêng worktree mới chưa hoàn tất lúc bàn giao.
