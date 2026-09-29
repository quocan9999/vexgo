# API xác thực và hồ sơ khách hàng

## Chạy local

API chạy tại `http://localhost:4000`, Customer Web tại `http://localhost:3000` và Admin Web tại `http://localhost:3001`. Frontend gọi API khác port là bình thường; CORS của backend đã cho phép hai origin local này.

```bash
docker compose up -d
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev --workspace=@vexgo/api
```

Các biến môi trường bắt buộc/liên quan:

```dotenv
DATABASE_URL=mysql://vexgo_app:...@127.0.0.1:3306/vexgo
SMS_PROVIDER=console
OTP_HASH_SECRET=replace-with-at-least-32-random-characters
OTP_TTL_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_PROOF_TTL_SECONDS=600
JWT_ACCESS_SECRET=replace-with-at-least-32-random-characters
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
```

`JWT_ACCESS_SECRET` và `OTP_HASH_SECRET` là bắt buộc. Hãy tự tạo hai giá trị ngẫu nhiên riêng biệt, mỗi giá trị dài ít nhất 32 ký tự. API dừng khởi động nếu một secret bị thiếu, quá ngắn hoặc còn chứa `replace-with`; mã hiện tại không tự kiểm tra hai secret có trùng nhau hay không. Các giá trị minh họa bên trên là placeholder bị từ chối, không dùng nguyên văn.

## Hiện trạng xác thực và phân quyền

Backend đăng ký Customer qua OTP, xác thực đăng nhập bằng số điện thoại/mật
khẩu, phát JWT access token HS256, và lưu refresh session trong DB với refresh
token được hash. `AccessTokenGuard` và `AuthorizationGuard` được đăng ký toàn
cục: endpoint cần đăng nhập mặc định được bảo vệ; endpoint public/optional phải
được đánh dấu rõ.

Trên branch `feature/admin-auth-authorization`, các API tenant `routes`,
`vehicle-types`, `vehicles/seats`, `fare-prices` yêu cầu `NHA_XE_ADMIN` và lấy
tenant từ principal được backend dựng từ DB. API Super Admin quản lý riêng tài
khoản `NHA_XE_ADMIN` theo contract sau:

| Method | Endpoint | Quyền | Mục đích |
|---|---|---|---|
| GET | `/api/v1/admin-accounts` | `SUPER_ADMIN` | Danh sách, filter `busCompanyId`/`status`, pagination/search/sort |
| GET | `/api/v1/admin-accounts/:id` | `SUPER_ADMIN` | Chi tiết tài khoản admin nhà xe |
| POST | `/api/v1/admin-accounts` | `SUPER_ADMIN` | Tạo account + employee + role trong transaction |
| PATCH | `/api/v1/admin-accounts/:id` | `SUPER_ADMIN` | Sửa tên/ngày sinh/email/CCCD |
| PATCH | `/api/v1/admin-accounts/:id/status` | `SUPER_ADMIN` | Khóa `TAM_KHOA` hoặc mở `HOAT_DONG` |

Tài khoản được tạo với role cố định `NHA_XE_ADMIN`; không nhận role/status/
permission từ client. Tenant được lưu qua `TaiKhoan → NhanVien → NhaXe`, không
đặt trong JWT. Khóa thu hồi session đang hoạt động; mở khóa không tạo session.
Endpoint không hard-delete và không cho đổi tenant, mã nhân viên, phone hoặc
password qua profile PATCH. Danh sách này chưa có nghĩa tất cả module nghiệp vụ
đã được audit hoặc permission matrix đã hoàn tất.

`POST /api/v1/admin-accounts` nhận `fullName`, `phoneNumber`, `password`,
`busCompanyId`, `employeeCode` và các field tùy chọn `dateOfBirth`, `email`,
`citizenId`. Mật khẩu dài 8–72 byte UTF-8; ba field tùy chọn cuối nhận `null`
để xóa. Profile PATCH chỉ nhận `fullName`, `dateOfBirth`, `email`, `citizenId`;
status PATCH chỉ nhận `{ "status": "HOAT_DONG" | "TAM_KHOA" }`. Email/CCCD
không có unique constraint hiện tại.

Admin Web và Customer Web vẫn dùng UI demo, chưa gọi API auth thật. Admin login
hiện nhập email trong khi backend login nhận số điện thoại. `VaiTroQuyen` chưa
được dùng để authorize permission runtime; role guard kiểm tra role đã gán.
Việc đăng nhập Admin trên UI, permission matrix và bảo vệ các module còn lại cần
tiếp tục theo Feature 15–16. Không dùng `busCompanyId` từ body/query/header để
làm tenant identity; tenant phải suy ra từ quan hệ tài khoản → nhân viên → nhà
xe trong DB.

`SMS_PROVIDER=console` chỉ dùng local. Khi gọi API gửi OTP, mã sáu chữ số xuất
hiện trong terminal NestJS dưới dòng `[LOCAL OTP]`. OTP và các hash không được
trả trong response.

## Thiết lập Postman

Tạo environment variable:

```text
baseUrl = http://localhost:4000/api/v1
accessToken = (để trống)
refreshToken = (để trống)
```

Body của các request dùng `Body` → `raw` → `JSON`. Số điện thoại phải ở định dạng E.164 Việt Nam, ví dụ `+84901234567`, không dùng `0901234567`.

### 1. Gửi OTP đăng ký

```http
POST {{baseUrl}}/auth/register/request-otp
Content-Type: application/json
```

```json
{
  "phoneNumber": "+84901234567"
}
```

Response `201`:

```json
{
  "data": {
    "challengeId": "uuid",
    "expiresAt": "2026-09-28T10:05:00.000Z",
    "resendAfter": "2026-09-28T10:01:00.000Z"
  }
}
```

Sao chép `challengeId`, sau đó đọc OTP trong terminal API.

### 2. Xác thực OTP

```http
POST {{baseUrl}}/auth/register/verify-otp
Content-Type: application/json
```

```json
{
  "challengeId": "uuid-vua-nhan",
  "phoneNumber": "+84901234567",
  "otp": "123456"
}
```

Response `201` trả `otpProof` dùng một lần và có hiệu lực 10 phút:

```json
{
  "data": {
    "otpProof": "opaque-one-time-proof",
    "expiresAt": "2026-09-28T10:15:00.000Z"
  }
}
```

### 3. Đăng ký khách hàng

```http
POST {{baseUrl}}/auth/register
Content-Type: application/json
```

```json
{
  "otpProof": "opaque-one-time-proof",
  "fullName": "Nguyễn Văn An",
  "phoneNumber": "+84901234567",
  "password": "VexGo@123",
  "email": "an@example.com",
  "citizenId": "079123456789",
  "dateOfBirth": "2000-01-01"
}
```

Response `201`:

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "accountId": 1,
      "customerId": 1,
      "fullName": "Nguyễn Văn An",
      "phoneNumber": "+84901234567",
      "roles": ["KHACH_HANG"]
    }
  }
}
```

Lưu `data.accessToken` và `data.refreshToken` vào environment Postman.

### 4. Đăng nhập

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
```

```json
{
  "phoneNumber": "+84901234567",
  "password": "VexGo@123"
}
```

Response `200` có cùng cấu trúc token như đăng ký.

### 5. Lấy hồ sơ hiện tại

```http
GET {{baseUrl}}/me
Authorization: Bearer {{accessToken}}
```

Response `200`:

```json
{
  "data": {
    "accountId": 1,
    "customerId": 1,
    "customerCode": "KH00000001",
    "loyaltyPoints": 0,
    "fullName": "Nguyễn Văn An",
    "phoneNumber": "+84901234567",
    "dateOfBirth": "2000-01-01",
    "citizenId": "079123456789",
    "email": "an@example.com",
    "phoneVerified": true,
    "status": "HOAT_DONG",
    "createdAt": "2026-09-28T10:00:00.000Z",
    "updatedAt": "2026-09-28T10:00:00.000Z"
  }
}
```

### 6. Cập nhật hồ sơ

```http
PATCH {{baseUrl}}/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

```json
{
  "fullName": "Nguyễn Văn Bình",
  "dateOfBirth": "2000-01-01",
  "email": null,
  "citizenId": "079123456789"
}
```

Các field được phép là `fullName`, `dateOfBirth`, `email`, `citizenId`. Gửi `null` cho ba field tùy chọn để xóa giá trị. Không thể đổi `phoneNumber`, `accountId` hoặc `customerId` qua endpoint này. API request/response dùng English camelCase; service mới ánh xạ sang tên field Prisma nội bộ.

### 7. Refresh token

```http
POST {{baseUrl}}/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

Response `200` trả cặp token mới. Phải thay cả `accessToken` và `refreshToken` đang lưu; refresh token cũ hết hiệu lực ngay và dùng lại sẽ nhận `401 REFRESH_TOKEN_INVALID`.

### 8. Đăng xuất

```http
POST {{baseUrl}}/auth/logout
Content-Type: application/json
```

```json
{
  "refreshToken": "{{refreshToken}}"
}
```

Thành công trả `204 No Content`. Access token thuộc phiên vừa thu hồi không gọi được `/me` nữa.

## Dùng từ frontend

Đặt base URL trong biến môi trường của frontend, ví dụ:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
```

Frontend gọi các URL như `${NEXT_PUBLIC_API_BASE_URL}/auth/login` và `${NEXT_PUBLIC_API_BASE_URL}/me`. Với endpoint bảo vệ, gửi header `Authorization: Bearer <accessToken>`. Không import Prisma hoặc truy cập MySQL/phpMyAdmin từ frontend.

## Mã lỗi chính

| HTTP | `error` | Ý nghĩa |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body sai kiểu, sai định dạng hoặc có field không cho phép |
| 400 | `OTP_INVALID` | OTP/challenge/số điện thoại không khớp |
| 400 | `OTP_EXPIRED` | OTP hết hạn |
| 400 | `OTP_ATTEMPTS_EXCEEDED` | Đã nhập sai OTP 5 lần |
| 400 | `OTP_PROOF_INVALID` | Proof sai, hết hạn hoặc đã dùng |
| 409 | `OTP_RESEND_TOO_SOON` | Chưa đủ 60 giây để gửi lại OTP |
| 503 | `OTP_DELIVERY_FAILED` | SMS provider không gửi được OTP; challenge được hoàn tác để có thể thử lại |
| 409 | `PHONE_ALREADY_REGISTERED` | Số điện thoại đã có tài khoản |
| 401 | `INVALID_CREDENTIALS` | Sai số điện thoại hoặc mật khẩu |
| 401 | `ACCESS_TOKEN_INVALID` | Access token sai/hết hạn hoặc phiên đã thu hồi |
| 401 | `REFRESH_TOKEN_INVALID` | Refresh token sai/hết hạn/đã rotate |
| 403 | `ACCOUNT_INACTIVE` | Tài khoản bị khóa hoặc không hoạt động |
| 403 | `CUSTOMER_ROLE_REQUIRED` | Tài khoản không có quyền khách hàng |
| 404 | `CUSTOMER_PROFILE_NOT_FOUND` | Không có hồ sơ khách hàng tương ứng |

Lỗi luôn theo envelope:

```json
{
  "statusCode": 401,
  "error": "ACCESS_TOKEN_INVALID",
  "message": "Access token không hợp lệ hoặc đã hết hạn."
}
```
