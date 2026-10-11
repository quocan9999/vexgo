# Danh Sách Chức Năng Dành Cho Người Dùng (Customer Web - VexGo)

Tài liệu này tổng hợp toàn bộ các tính năng, luồng nghiệp vụ và tiện ích dành riêng cho **Người Dùng / Khách Hàng (Customer)** trên nền tảng **VexGo** (`apps/web`).

---

## 1. Tìm Kiếm & Tra Cứu Chuyến Xe

- **Tìm kiếm chuyến xe đa năng**:
  - Chọn điểm đi (Nơi xuất phát), điểm đến (Nơi nhận/Nơi đến).
  - Chọn ngày khởi hành theo lịch trực quan.
  - Hỗ trợ tìm kiếm cả vé **Một chiều** và vé **Khứ hồi** (chọn ngày đi & ngày về linh hoạt).
  - Đề xuất các tuyến đường phổ biến, điểm đến du lịch nổi bật ngay tại trang chủ.
- **Bộ lọc tìm kiếm nâng cao**:
  - Lọc theo **Nhà xe vận chuyển** (Phương Trang, Thành Bưởi, Hoa Mai...).
  - Lọc theo **Khung giờ xuất bến**: Sáng (06:00 – 12:00), Chiều (12:00 – 18:00), Tối (18:00 – 22:00), Đêm (22:00 – 06:00).
  - Lọc theo **Loại xe**: Giường nằm, Ghế ngồi, Limousine VIP...
  - Lọc theo **Khoảng giá vé**.
- **Sắp xếp chuyến xe**:
  - Giờ xuất bến sớm nhất / muộn nhất.
  - Giá vé thấp đến cao / cao đến thấp.

---

## 2. Sơ Đồ Chọn Ghế Tương Tác Trực Quan

- **Sơ đồ ghế phân tầng**:
  - Hiển thị cấu trúc xe rõ ràng: Tầng dưới (Tầng 1) và Tầng trên (Tầng 2).
  - Phân biệt từng loại ghế: Ghế tiêu chuẩn, Ghế VIP, Ghế đầu xe / cuối xe.
- **Trạng thái ghế theo thời gian thực**:
  - Ghế còn trống (màu trắng/xám viền nhạt).
  - Ghế đang chọn (nổi bật màu cam/xanh).
  - Ghế đã có người đặt (màu tối/khóa không thể chọn).
- **Khóa giữ chỗ tạm thời (Seat Hold)**:
  - Khi khách chọn ghế, hệ thống tạm thời giữ ghế để tránh trường hợp người khác chọn trùng cùng lúc.
- **Chọn ghế khứ hồi**:
  - Chọn ghế cho chiều đi, sau đó chuyển sang chọn ghế cho chiều về độc lập trong cùng một luồng đặt vé.

---

## 3. Quy Trình Đặt Vé & Khai Báo Hành Khách

- **Thông tin hành khách**:
  - Nhập họ tên, số điện thoại, email nhận vé điện tử.
  - Tự động điền trước thông tin nếu khách hàng đã đăng nhập tài khoản.
- **Điểm đón & Điểm trả khách**:
  - Lựa chọn bến xe xuất phát hoặc các điểm đón trung chuyển dọc tuyến.
  - Lựa chọn bến xe đến hoặc các điểm trả khách theo danh sách có sẵn.
- **Mã giảm giá & Khuyến mãi**:
  - Nhập mã ưu đãi để được khấu trừ trực tiếp vào tổng tiền thanh toán.
- **Tóm tắt cước phí minh bạch**:
  - Hiển thị chi tiết giá vé từng ghế, tổng cước chiều đi, tổng cước chiều về (nếu có), giảm giá và tổng thanh toán cuối cùng.

---

## 4. Thanh Toán Trực Tuyến & Hóa Đơn Điện Tử

- **Chuyển khoản Ngân hàng tự động qua VietQR**:
  - Tạo mã QR thanh toán chuẩn VietQR có sẵn số tài khoản, tên người nhận, số tiền chính xác và nội dung chuyển khoản tự động.
  - Khách chỉ cần mở app ngân hàng quét mã là thanh toán xong ngay mà không sợ gõ sai thông tin.
- **Hóa đơn điện tử & Vé điện tử**:
  - Xuất hóa đơn chi tiết đơn đặt vé ngay sau khi thanh toán thành công.
  - Chứa đầy đủ thông tin: Mã đơn, Mã vé, Tên nhà xe, Tuyến đường, Giờ xuất bến, Biển số xe, Vị trí ghế.
  - Cung cấp **Mã QR vé xe điện tử** để tài xế hoặc phụ xe quét kiểm tra khi khách lên xe.

---

## 5. Tra Cứu Vé & Hủy Vé Trực Tuyến (Tự Động)

- **Tra cứu vé xe công khai**:
  - Áp dụng cho cả khách vãng lai và khách có tài khoản.
  - Chỉ cần nhập **Mã vé** và **Số điện thoại** đặt vé để xem lại toàn bộ thông tin hành trình và mã QR vé.
- **Hủy vé trực tuyến tự động**:
  - Khách tự thao tác hủy vé trực tiếp trên website mà không cần liên hệ tổng đài.
  - Hệ thống tự động tính phí hủy vé và số tiền hoàn trả theo quy định chuẩn:
    - **Trước giờ khởi hành > 24 tiếng**: Phí hủy 10% giá vé.
    - **Trước giờ khởi hành từ 12 – 24 tiếng**: Phí hủy 20% giá vé.
    - **Dưới 12 tiếng trước khi xe chạy**: Không hỗ trợ hủy vé trực tuyến.
  - Hiển thị bảng báo giá hoàn tiền chi tiết trước khi khách bấm nút xác nhận hủy.

---

## 6. Dịch Vụ Gửi Hàng Theo Xe Khách (Gửi Hàng Độc Lập)

- **Gửi hàng không cần mua vé đi cùng**:
  - Khách có thể gửi hàng hóa, bưu phẩm, thực phẩm, thiết bị theo chuyến xe mà không cần đi xe.
- **Chọn nhà xe & chuyến xe linh hoạt**:
  - Tìm kiếm chuyến xe chạy trong ngày nhận chở hàng.
  - Thẻ chuyến xe hiển thị gọn gàng, căn thẳng hàng giờ xuất bến, bến gửi và mức cước khởi điểm.
- **Khai báo người gửi & người nhận**:
  - Nhập họ tên, số điện thoại người gửi và người nhận.
  - Người nhận chỉ cần cầm CCCD/SĐT ra bến xe hoặc văn phòng nhà xe để nhận hàng.
- **Khai báo kiện hàng chi tiết**:
  - Nhập tên kiện hàng (Ví dụ: Thùng hoa quả, quần áo, tài liệu...).
  - Chọn danh mục hàng hóa (Bưu phẩm, Thực phẩm, Quần áo, Đồ điện tử...).
  - Khai báo kích thước kiện hàng: Chiều Dài x Chiều Rộng x Chiều Cao (cm).
  - Khai báo khối lượng thực tế (kg).
- **Dịch vụ cộng thêm**:
  - Tùy chọn **Hàng dễ vỡ** (+20.000đ).
  - Tùy chọn **Hàng giá trị cao / Bảo hiểm** (+50.000đ).
- **Tính cước phí tự động & minh bạch**:
  - Cước cơ bản (cho 5kg đầu): 50.000đ.
  - Phụ phí vượt cân: Tự động tính theo khối lượng thực tế hoặc khối lượng thể tích quy đổi.
- **Không bắt buộc đăng nhập**:
  - Khách vãng lai tạo đơn gửi hàng được ngay lập tức, hệ thống tự động sinh **Mã vận đơn (Waybill code)**.

---

## 7. Tra Cứu Vận Đơn Hàng Hóa Thời Gian Thực

- **Tra cứu vận đơn nhanh**:
  - Truy cập tab Tra cứu vận đơn trên trang gửi hàng hoặc đường dẫn trực tiếp.
  - Chỉ cần nhập **Mã vận đơn** + **Số điện thoại** (người gửi hoặc người nhận).
- **Theo dõi hành trình kiện hàng**:
  - Hiển thị dòng thời gian trạng thái vận đơn trực quan:
    1. Đã tạo mã vận đơn
    2. Đã bàn giao hàng tại bến xuất phát
    3. Xe đang vận chuyển trên đường
    4. Hàng đã tới bến nhận
    5. Người nhận đã nhận hàng thành công

---

## 8. Quản Lý Tài Khoản Cá Nhân & Khách Hàng Thân Thiết

- **Đăng ký & Đăng nhập**:
  - Đăng ký tài khoản bằng Số điện thoại + Mật khẩu.
  - Đăng nhập bảo mật với JWT và tự động gia hạn phiên đăng nhập.
  - Quên mật khẩu / Đặt lại mật khẩu qua mã xác thực OTP gửi về điện thoại/email.
- **Quản lý hồ sơ cá nhân**:
  - Xem và cập nhật họ tên, email, số điện thoại, ngày sinh, địa chỉ.
  - Đổi mật khẩu tài khoản trong trang cài đặt bảo mật.
- **Lịch sử đặt vé & Đơn gửi hàng**:
  - Xem danh sách toàn bộ các vé xe đã đặt (vé sắp đi, vé đã hoàn thành, vé đã hủy).
  - Xem lại các đơn gửi hàng đã tạo để dễ dàng theo dõi mà không cần nhớ từng mã vận đơn.
- **Tích điểm & Khách hàng thân thiết (Loyalty)**:
  - Tích lũy điểm thưởng qua mỗi chuyến đi và mỗi đơn gửi hàng thành công.
  - Sử dụng điểm thưởng để đổi voucher ưu đãi hoặc giảm giá cho các lần đặt vé tiếp theo.

---

## 9. Trang Thông Tin, Cẩm Nang & Hỗ Trợ Khách Hàng

- **Giới thiệu nền tảng VexGo (`/about`)**: Giới thiệu dịch vụ, mạng lưới nhà xe đối tác và cam kết chất lượng.
- **Liên hệ & Gửi phản hồi (`/contact`)**: Form gửi thắc mắc, phản ánh dịch vụ hoặc yêu cầu hỗ trợ đến ban quản trị.
- **Cẩm nang du lịch & Tin tức (`/posts`, `/posts/[id]`)**: Đọc các bài viết chia sẻ kinh nghiệm du lịch, hướng dẫn di chuyển, thông tin tuyến đường mới.
- **Đóng góp / Tài trợ cộng đồng (`/donate`)**: Trang thông tin ủng hộ các hoạt động xã hội hoặc chương trình thiện nguyện của nền tảng.
