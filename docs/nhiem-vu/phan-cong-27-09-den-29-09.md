# PHÂN CÔNG CUSTOMER — TỪ CHỦ NHẬT 27/09/2026 ĐẾN THỨ BA 29/09/2026

> Phạm vi: **Customer Web + Customer Mobile + Customer API**.  
> Không làm Admin trong mốc này.  
> Mục tiêu của mốc 3 ngày: đến tối **Thứ Ba 29/09/2026**, phải demo được flow Customer cốt lõi bằng API thật:
>
> **Đăng nhập → tìm chuyến nhiều nhà xe → xem chi tiết chuyến → xem/chọn ghế → tính giá → tạo booking → tạo thanh toán → kiểm tra trạng thái → xem kết quả booking.**

---

# 1. Quy ước phân công

## Người A — Customer Web + Backend Discovery & Engagement

A chịu trách nhiệm chính:

- Customer Web (`apps/web`);
- Auth/customer;
- Nhà xe, tuyến xe, chuyến xe;
- API tìm kiếm/chuyến xe phục vụ chung cho cả Web và Mobile.

## Người B — Customer Mobile + Backend Commerce & Fulfillment

B chịu trách nhiệm chính:

- Customer Mobile;
- Ghế/giữ ghế;
- Booking;
- Promotion trong checkout;
- Payment;
- API giao dịch phục vụ chung cho cả Web và Mobile.

## Nguyên tắc

- A và B **không tạo API riêng cho Web/Mobile**.
- Endpoint nào đã có owner thì người còn lại không tự viết endpoint/service thứ hai.
- Web và Mobile được phép dùng fixture trong lúc chờ API của người kia, nhưng **đến cuối Thứ Ba flow cốt lõi phải chạy bằng API thật**.
- Không tự đổi API contract trong lúc làm mà không báo người còn lại.

---

# 2. Mục tiêu phải đạt khi kết thúc Thứ Ba

Mốc này **chưa yêu cầu hoàn thiện toàn bộ MEDIUM/LOW** trong `endpoint-api.md` và `function-uiux.md`.

Phải hoàn thành trước nhóm HIGH tạo thành một flow chạy xuyên suốt:

```text
Auth
  ↓
Trip Search
  ↓
Trip Detail
  ↓
Seat Availability / Seat Hold
  ↓
Booking Quote
  ↓
Promotion Validate
  ↓
Create Booking
  ↓
Create Payment
  ↓
Payment Status
  ↓
Booking Result
```

---

# 3. CHỦ NHẬT — 27/09/2026

## 3.1 Người A

### API phải bàn giao trong ngày

| Trạng thái cuối ngày | Method | Endpoint |
|---|---|---|
| DONE | POST | `/api/v1/auth/login` |
| DONE | POST | `/api/v1/auth/refresh` |
| DONE | POST | `/api/v1/auth/logout` |
| DONE | GET | `/api/v1/me` |
| DONE | GET | `/api/v1/bus-companies` |
| DONE | GET | `/api/v1/bus-companies/:busCompanyId` |
| DONE | GET | `/api/v1/routes` |
| DONE | GET | `/api/v1/trips/search` |
| DONE | GET | `/api/v1/trips/:tripId` |

### Web phải bàn giao trong ngày

1. **Web shell cơ bản**
   - header/navigation;
   - logo;
   - login/account area;
   - language switch vị trí UI;
   - responsive cơ bản.

2. **Trang đăng nhập**
   - form email/số điện thoại + password theo contract hiện tại;
   - validation cơ bản;
   - loading/error/success;
   - gọi API login thật;
   - lưu/khôi phục session theo `rule-api.md`.

3. **Trang chủ / tìm chuyến**
   - điểm đi;
   - điểm đến;
   - ngày đi;
   - nút tìm chuyến.

4. **Trang kết quả tìm chuyến**
   - dùng `GET /trips/search` thật;
   - hiển thị nhiều nhà xe;
   - loading/error/empty/success;
   - filter cơ bản theo contract đã có;
   - CTA xem chi tiết.

5. **Trang chi tiết chuyến**
   - dùng `GET /trips/:tripId` thật;
   - thông tin nhà xe;
   - tuyến;
   - giờ khởi hành;
   - loại xe/thông tin xe;
   - giá;
   - CTA chọn ghế.

### Cuối ngày A phải giao cho B

- Contract thực tế của `GET /trips/search`.
- Contract thực tế của `GET /trips/:tripId`.
- Kiểu `tripId` chính thức.
- Các field B cần dùng để kiểm tra chuyến khi tạo booking.

---

## 3.2 Người B

### API phải bàn giao trong ngày

| Trạng thái cuối ngày | Method | Endpoint |
|---|---|---|
| DONE | GET | `/api/v1/trips/:tripId/seats` |
| DONE | POST | `/api/v1/bookings/quote` |
| DONE | POST | `/api/v1/promotions/validate` |

### Việc bắt buộc phải chốt trong ngày

Trước khi viết seat hold phải chốt:

- cấu trúc lưu giữ ghế;
- owner của hold;
- `holdToken`;
- `expiresAt`;
- thời gian timeout giữ ghế;
- cách giải phóng ghế hết hạn.

Không được chỉ đổi trạng thái ghế thành `DANG_GIU` mà không biết **ai giữ** và **giữ tới khi nào**.

### Mobile phải bàn giao trong ngày

1. **App navigation/shell cơ bản**.
2. **Màn hình đăng nhập** theo contract của A.
3. **Màn hình tìm chuyến**.
4. **Màn hình danh sách kết quả**.
5. **Màn hình chi tiết chuyến**.
6. **Màn hình chọn ghế**:
   - gọi `GET /trips/:tripId/seats` thật;
   - phân biệt ghế trống / không thể chọn / đang chọn;
   - hiển thị ghế đang chọn;
   - hiển thị tạm tính;
   - xử lý loading/error.

> Nếu API tìm chuyến của A chưa merge vào đầu ngày, Mobile được phép dựng service theo contract đã thống nhất và nối API thật ngay khi A bàn giao.

---

# 4. THỨ HAI — 28/09/2026

## 4.1 Người A

### API phải bàn giao trong ngày

| Trạng thái cuối ngày | Method | Endpoint |
|---|---|---|
| DONE | POST | `/api/v1/auth/register/request-otp` |
| DONE | POST | `/api/v1/auth/register/verify-otp` |
| DONE | POST | `/api/v1/auth/register` |

> Nếu OTP provider thật chưa được cấu hình, phải thống nhất cơ chế DEV/test rõ ràng. Không được hard-code OTP trong frontend production flow.

### Web phải bàn giao trong ngày

1. **Đăng ký tài khoản**.
2. **Xác thực OTP đăng ký**.
3. **Trang chọn ghế**:
   - dùng API seat của B;
   - chọn/bỏ chọn ghế;
   - xử lý `SEAT_UNAVAILABLE`;
   - nếu seat hold đã xong thì hiển thị thời gian hết hạn hold.

4. **Trang Checkout**:
   - thông tin chuyến;
   - ghế đã chọn;
   - thông tin người đặt;
   - mã khuyến mãi;
   - gọi `POST /bookings/quote`;
   - gọi `POST /promotions/validate`;
   - hiển thị breakdown giá từ backend.

5. Chuẩn bị service cho:
   - create booking;
   - payment create;
   - payment status.

### Cuối ngày A phải đạt

Web đi được đến màn hình Checkout bằng API thật.

---

## 4.2 Người B

### API phải bàn giao trong ngày

| Trạng thái cuối ngày | Method | Endpoint |
|---|---|---|
| DONE | POST | `/api/v1/seat-holds` |
| DONE | DELETE | `/api/v1/seat-holds/:holdToken` |
| DONE | POST | `/api/v1/bookings` |
| DONE | GET | `/api/v1/bookings/:bookingId` |

### Business rule bắt buộc

`POST /bookings` phải:

- kiểm tra chuyến còn bookable;
- kiểm tra ghế lại ở backend;
- không tin giá client gửi lên;
- tính giá backend;
- validate promotion backend;
- kiểm tra ownership của hold;
- xử lý transaction;
- ngăn 2 user mua cùng một ghế;
- trả lỗi `409 SEAT_UNAVAILABLE` khi ghế vừa bị người khác giữ/đặt.

### Mobile phải bàn giao trong ngày

1. **Seat hold thật**:
   - chọn ghế → tạo hold;
   - bỏ checkout → release hold;
   - hiển thị countdown theo `expiresAt` nếu có.

2. **Checkout Mobile**:
   - form người đặt;
   - ghế;
   - mã khuyến mãi;
   - booking quote;
   - breakdown tổng tiền.

3. **Tạo booking thật**:
   - gọi `POST /bookings`;
   - xử lý lỗi ghế hết;
   - chuyển sang bước thanh toán khi booking thành công.

4. **Màn hình booking summary/result tạm thời** để sẵn sàng nhận trạng thái payment ngày Thứ Ba.

### Cuối ngày B phải đạt

Mobile phải chạy được flow:

```text
Tìm chuyến
→ Chi tiết
→ Chọn ghế
→ Hold ghế
→ Quote
→ Áp mã
→ Tạo booking
```

---

# 5. THỨ BA — 29/09/2026

## 5.1 Người A

### API

Không mở thêm module lớn mới trong ngày Thứ Ba.

A tập trung:

- fix bug auth;
- fix bug trip search/detail;
- đảm bảo contract không thay đổi ngoài ý muốn;
- hỗ trợ B các lỗi integration liên quan trip/auth.

### Web phải bàn giao trong ngày

1. **Tạo booking thật** từ Checkout.
2. **Màn hình chọn phương thức thanh toán**:
   - MoMo;
   - VNPAY;
   - ZaloPay.

3. **Gọi API tạo payment** của B.
4. **Xử lý redirect/return Web**.
5. **Poll/check payment status**.
6. **Trang kết quả booking/payment**:
   - booking id;
   - chuyến;
   - ghế;
   - tổng tiền;
   - trạng thái thanh toán;
   - CTA phù hợp.

7. Hoàn thiện các trạng thái:
   - loading;
   - error;
   - empty nếu có;
   - success;
   - payment pending;
   - payment failed.

### Cuối ngày A phải đạt

Customer Web phải demo được end-to-end:

```text
Login
→ Search
→ Trip Detail
→ Select Seat
→ Checkout
→ Promotion
→ Create Booking
→ Payment
→ Booking Result
```

---

## 5.2 Người B

### API phải bàn giao trong ngày

| Trạng thái cuối ngày | Method | Endpoint |
|---|---|---|
| DONE | POST | `/api/v1/payments` |
| DONE | GET | `/api/v1/payments/:paymentId` |
| DONE | GET | `/api/v1/payments/:paymentId/status` |
| DONE* | POST | `/api/v1/payments/momo/webhook` |
| DONE* | POST | `/api/v1/payments/vnpay/webhook` |
| DONE* | POST | `/api/v1/payments/zalopay/webhook` |

`DONE*` nghĩa là phải hoàn thiện theo provider nào đã có đủ sandbox credential/config. Nếu team chưa có credential của một provider, **không fake trạng thái SUCCESS**; phải ghi rõ provider đó bị block bởi cấu hình ngoài hệ thống.

### Payment backend bắt buộc

- payment gắn với booking/order hợp lệ;
- user chỉ tạo/xem payment của dữ liệu thuộc mình;
- idempotency chống tạo giao dịch trùng;
- verify signature callback/webhook;
- không tin callback từ frontend;
- không giữ DB transaction trong lúc gọi payment provider;
- retry callback không được tạo payment/ticket trùng;
- status backend là nguồn sự thật.

### Mobile phải bàn giao trong ngày

1. **Màn hình chọn payment provider**.
2. **Tạo payment thật**.
3. **Mở payment URL/deeplink phù hợp**.
4. Khi app resume/quay lại:
   - gọi status API;
   - hiển thị pending nếu chưa xác nhận;
   - success khi backend xác nhận;
   - failed/cancelled khi backend trả trạng thái tương ứng.

5. **Màn hình kết quả booking/payment hoàn chỉnh**.
6. Fix toàn bộ lỗi integration với API của A.

### Cuối ngày B phải đạt

Customer Mobile phải demo được end-to-end:

```text
Login
→ Search
→ Trip Detail
→ Select Seat
→ Hold Seat
→ Checkout
→ Promotion
→ Create Booking
→ Payment
→ Booking Result
```

---

# 6. Tổng hợp endpoint mỗi người phải bàn giao đến hết Thứ Ba

## 6.1 Người A — Backend

### Authentication / Customer

- `POST /api/v1/auth/register/request-otp`
- `POST /api/v1/auth/register/verify-otp`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`

### Discovery

- `GET /api/v1/bus-companies`
- `GET /api/v1/bus-companies/:busCompanyId`
- `GET /api/v1/routes`
- `GET /api/v1/trips/search`
- `GET /api/v1/trips/:tripId`

**Tổng A: 12 endpoint.**

---

## 6.2 Người B — Backend

### Seats / Booking / Promotion

- `GET /api/v1/trips/:tripId/seats`
- `POST /api/v1/seat-holds`
- `DELETE /api/v1/seat-holds/:holdToken`
- `POST /api/v1/bookings/quote`
- `POST /api/v1/promotions/validate`
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/:bookingId`

### Payment

- `POST /api/v1/payments`
- `GET /api/v1/payments/:paymentId`
- `GET /api/v1/payments/:paymentId/status`
- `POST /api/v1/payments/momo/webhook`
- `POST /api/v1/payments/vnpay/webhook`
- `POST /api/v1/payments/zalopay/webhook`

**Tổng B: 13 endpoint.**

---

# 7. Tổng hợp giao diện mỗi người phải bàn giao đến hết Thứ Ba

## 7.1 Người A — Customer Web

A phải bàn giao tối thiểu:

1. Web shell/header/navigation.
2. Đăng nhập.
3. Đăng ký.
4. Xác thực OTP đăng ký.
5. Trang chủ/tìm chuyến.
6. Kết quả tìm chuyến.
7. Chi tiết chuyến.
8. Chọn ghế.
9. Checkout.
10. Áp mã khuyến mãi.
11. Chọn phương thức thanh toán.
12. Xử lý payment return/status.
13. Kết quả booking/payment.

**Yêu cầu:** tất cả màn hình thuộc flow trên phải nối API thật vào cuối Thứ Ba.

---

## 7.2 Người B — Customer Mobile

B phải bàn giao tối thiểu:

1. App navigation/shell.
2. Đăng nhập.
3. Trang/màn hình tìm chuyến.
4. Danh sách kết quả.
5. Chi tiết chuyến.
6. Chọn ghế.
7. Seat hold + countdown.
8. Checkout.
9. Áp mã khuyến mãi.
10. Tạo booking.
11. Chọn phương thức thanh toán.
12. Redirect/deeplink/payment handling.
13. Payment status khi app resume.
14. Kết quả booking/payment.

**Yêu cầu:** tất cả màn hình thuộc flow trên phải nối API thật vào cuối Thứ Ba.

---

# 8. Những chức năng CHƯA giao trong mốc 27–29/09

Để tránh dàn trải, chưa đưa vào deadline Thứ Ba:

- quên/reset password;
- cập nhật profile;
- lịch sử giao dịch;
- danh sách vé;
- tra cứu vé;
- hủy vé;
- hóa đơn;
- gửi hàng hóa;
- support chat realtime;
- notification;
- review;
- đổi vé;
- chatbot AI;
- gợi ý chuyến thay thế;
- content động.

Các nhóm này chuyển sang milestone tiếp theo sau khi flow HIGH đã chạy ổn định.

---

# 9. Điều kiện để được tính là “DONE”

## API

Một endpoint **không được tính DONE** nếu mới chỉ có controller hoặc trả dữ liệu hard-code.

Phải có tối thiểu:

- đúng method/path;
- DTO/query validation;
- controller gọi service;
- business logic ở service;
- đọc/ghi database thật bằng Prisma khi endpoint cần dữ liệu;
- response/error đúng convention;
- authorization/ownership nếu endpoint private;
- xử lý edge case quan trọng;
- transaction/concurrency/idempotency khi nghiệp vụ yêu cầu;
- không còn mock làm nguồn dữ liệu chính.

## UI/UX

Một màn hình **không được tính DONE** nếu chỉ vẽ giao diện tĩnh.

Phải có tối thiểu:

- gọi qua frontend service/API layer;
- API thật ở milestone cuối;
- loading;
- error;
- empty nếu phù hợp;
- success feedback;
- validation form;
- responsive đối với Web;
- trạng thái phù hợp Mobile;
- không duplicate shared component khi component dùng lại đã tồn tại.

---

# 10. Checkpoint bắt buộc mỗi cuối ngày

## Chủ Nhật

- A demo: Login + Search + Trip Detail trên Web.
- B demo: Seat API + Booking Quote + Seat UI trên Mobile.

## Thứ Hai

- A demo: Web đi từ Search đến Checkout.
- B demo: Mobile đi từ Search đến Create Booking.

## Thứ Ba

Cả hai phải demo **cùng một backend/database**:

```text
Customer Web:    Search → Seat → Booking → Payment → Result
Customer Mobile: Search → Seat → Booking → Payment → Result
```

Nếu một flow vẫn phụ thuộc fixture/mock để chạy thì milestone **chưa hoàn thành**.

---

# 11. Quy tắc ưu tiên khi trễ tiến độ

Nếu có nguy cơ không kịp deadline, ưu tiên theo thứ tự:

1. Không làm UI polish trước khi API thật chạy.
2. Không làm MEDIUM/LOW.
3. Không thêm feature ngoài tài liệu.
4. Giữ bằng được flow:
   `Search → Detail → Seat → Quote → Booking → Payment → Result`.
5. Fix lỗi business/concurrency/payment trước animation, hiệu ứng và trang trí.
6. Không giảm validation, authorization hoặc transaction chỉ để demo chạy.

