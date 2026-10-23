# Cấu hình chat realtime cho Customer Web và Admin

Web, Admin và Mobile sử dụng cùng backend/domain/database. REST tải lịch sử;
Socket.IO nhận tin và sự kiện trực tiếp qua namespace `/chat`. REST hoạt động
không đồng nghĩa socket đã kết nối đúng backend.

## File cấu hình

Copy file mẫu tương ứng thành `.env.local` trong từng app:

- `apps/admin/.env.example` → `apps/admin/.env.local`.
- `apps/web/.env.example` → `apps/web/.env.local`.

Ví dụ backend chạy cổng **4002**, giữ các cấu hình khác của app:

```dotenv
# apps/admin/.env.local: REST dùng origin, không thêm /api/v1
NEXT_PUBLIC_API_URL=http://localhost:4002
NEXT_PUBLIC_SOCKET_URL=
```

```dotenv
# apps/web/.env.local: REST cần /api/v1
NEXT_PUBLIC_API_URL=http://localhost:4002/api/v1
NEXT_PUBLIC_SOCKET_URL=
```

`NEXT_PUBLIC_SOCKET_URL` để trống/không khai báo sẽ lấy origin từ URL API, nên
cả hai app trên kết nối `http://localhost:4002/chat`. Không còn fallback cứng
về 4000 khi API đã cấu hình cổng khác. Customer Web chỉ giữ mặc định 4000 nếu
không cấu hình cả URL API lẫn socket; Admin vẫn yêu cầu URL API như các màn khác.

Nếu triển khai socket ở một origin riêng, cấu hình rõ trong cả hai app:

```dotenv
NEXT_PUBLIC_SOCKET_URL=https://realtime.example.com
```

Chỉ điền origin; code tự nối namespace `/chat`. URL override được ưu tiên so
với API origin. Reverse proxy phải chuyển tiếp Socket.IO (mặc định đường dẫn
`/socket.io`) và hỗ trợ WebSocket upgrade; không đặt REST prefix vào socket URL.
Khi truy cập từ máy khác, `localhost` là máy đang mở trình duyệt: dùng địa chỉ
backend mà trình duyệt đó truy cập được. Trang HTTPS cần endpoint realtime an toàn.

Sau khi đổi `NEXT_PUBLIC_*`, dừng và chạy lại dev server. Production phải build
lại frontend rồi restart/deploy bản build mới vì Next đưa các giá trị public
vào client bundle. Các giá trị này không phải secret; không thêm JWT/password
hoặc secret backend vào biến `NEXT_PUBLIC_*` hay file mẫu.

## Điều kiện nhận hội thoại/tin nhắn

- Customer và Admin phải dùng cùng backend/DB.
- Customer chat với đúng nhà xe của tài khoản nhân viên/Admin đang dùng.
- Tài khoản tenant cần `chat:read` hoặc `chat:manage`; Super Admin không được
  tham gia chat CSKH theo contract hiện tại.
- Backend CORS/auth-cookie origin phải cho phép đúng địa chỉ Web/Admin thực tế.
- Mở mục Chăm sóc khách hàng, kiểm tra bộ lọc trạng thái và từ khóa tìm kiếm.

Admin đồng bộ lại hộp thư khi nhận `support.connected`, kể cả lần đầu khi chưa
chọn hội thoại. Nhờ đó các hội thoại tạo trong khoảng giữa REST load và socket
authentication được nạp lại; khôi phục lịch sử hội thoại đang mở vẫn dùng
checkpoint/pagination và bảo vệ phiên như trước.

## Chẩn đoán khi phải F5 mới thấy tin

1. Xác nhận request REST `/api/v1/support-chat/conversations` đi đúng backend.
2. Kiểm tra kết nối `/socket.io` và namespace `/chat` cũng đến đúng origin.
   `connect` ở tầng transport chưa chứng minh được JWT đã hợp lệ; ứng dụng chờ
   sự kiện xác thực `support.connected` trước khi coi là online.
3. Kiểm tra lỗi auth/quyền/CORS và đúng nhà xe; không gỡ các kiểm tra quyền để
   làm chat xuất hiện.
4. Gửi tin từ Customer khi Admin đang mở: nội dung và danh sách hội thoại phải
   cập nhật mà không reload. Thử thêm lần mất/kết nối lại mạng.

File mẫu chỉ cung cấp cấu hình; không tự cấu hình lại môi trường đã triển khai.
