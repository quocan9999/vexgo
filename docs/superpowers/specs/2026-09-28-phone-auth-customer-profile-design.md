# Thiết kế Authentication và hồ sơ khách hàng bằng số điện thoại

## 1. Mục tiêu

Xây dựng authentication dùng chung cho Customer Web và Customer Mobile, chỉ dùng số điện thoại, mật khẩu và OTP. Phạm vi triển khai theo thứ tự:

1. `POST /api/v1/auth/register/request-otp`
2. `POST /api/v1/auth/register/verify-otp`
3. `POST /api/v1/auth/register`
4. `POST /api/v1/auth/login`
5. `POST /api/v1/auth/refresh`
6. `POST /api/v1/auth/logout`
7. `GET /api/v1/me`
8. `PATCH /api/v1/me`

Đăng nhập Google và Swagger không thuộc phạm vi. Các API quên/đổi mật khẩu và lịch sử giao dịch sẽ là giai đoạn tiếp theo.

## 2. Hiện trạng và khoảng trống

Backend hiện có `POST /auth/register` và `POST /auth/login` ở mức cơ bản. Register chỉ tạo `TaiKhoan`; chưa tạo `KhachHang`, chưa gán role và chưa yêu cầu OTP. Login kiểm tra bcrypt nhưng chưa phát hành token. Repository chưa có module `customers`, bảng OTP hoặc bảng phiên đăng nhập.

Schema hiện tại bắt buộc `TaiKhoan.soDienThoai`, có quan hệ một-một `TaiKhoan`–`KhachHang`, và role được gán qua `TaiKhoanVaiTro`. Vì vậy đăng ký khách hàng phải ghi cả ba phần trong một transaction.

## 3. Quyết định kiến trúc

### 3.1 OTP

OTP gồm 6 chữ số, hiệu lực 5 phút. Mỗi yêu cầu trả một `challengeId` ngẫu nhiên để bước verify không phải suy đoán OTP nào là mới nhất. Mã OTP không lưu dạng rõ; backend lưu HMAC-SHA256 bằng secret riêng `OTP_HASH_SECRET`.

Mỗi challenge có tối đa 5 lần nhập sai. Một số điện thoại phải chờ 60 giây trước khi yêu cầu lại. Verify thành công trả một `otpProof` ngẫu nhiên dùng một lần, hiệu lực 10 phút. Backend chỉ lưu SHA-256 của proof. Register phải tiêu thụ proof trong cùng transaction tạo tài khoản để ngăn replay và race condition.

Model Prisma mới `YeuCauOtp` dùng naming tiếng Việt hiện có, gồm tối thiểu:

- `yeuCauOtpId`, `challengeId` duy nhất;
- `soDienThoai`, `mucDich`;
- `maOtpHash`, `soLanThu`;
- `hetHanLuc`, `daXacThucLuc`;
- `proofHash`, `proofHetHanLuc`, `daSuDungLuc`;
- `createdAt`, `updatedAt`.

Database giữ một current-challenge row cho mỗi cặp `(soDienThoai, mucDich)` bằng unique constraint. Khi resend hợp lệ, row được thay challenge/code/expiry; conditional update theo cooldown bảo đảm hai request đồng thời không cùng gửi OTP.

Mục đích đầu tiên là `DANG_KY`; thiết kế cho phép bổ sung `QUEN_MAT_KHAU` và `CAP_NHAT_SO_DIEN_THOAI` sau này mà không tạo hệ OTP thứ hai.

Việc gửi SMS nằm sau interface `SmsSender`. Local development dùng `ConsoleSmsSender`, chỉ ghi OTP vào terminal và tuyệt đối không bật trong production. Adapter SMS thật sẽ được thêm khi team cung cấp nhà cung cấp và credential; controller/service không thay đổi.

### 3.2 Đăng ký khách hàng

`POST /auth/register` nhận `otpProof`, số điện thoại, họ tên, mật khẩu và các field tùy chọn. Backend kiểm tra proof đúng mục đích, đúng số điện thoại, còn hạn và chưa dùng.

Trong một Prisma transaction, backend:

1. claim proof bằng conditional update `daSuDungLuc IS NULL` và đặt `daSuDungLuc` ngay trong transaction;
2. tạo `TaiKhoan` với mật khẩu bcrypt, số điện thoại đã xác thực và trạng thái `HOAT_DONG`;
3. tạo `KhachHang` với mã khách hàng duy nhất và điểm tích lũy bằng 0;
4. gán role `KHACH_HANG` qua `TaiKhoanVaiTro`;
5. tạo phiên đăng nhập đầu tiên.

Nếu số điện thoại đã tồn tại, API trả `409 PHONE_ALREADY_REGISTERED`. Nếu proof sai/hết hạn/đã dùng, API trả mã lỗi nghiệp vụ ổn định tương ứng. Không trả hash mật khẩu hoặc token hash.

Mật khẩu yêu cầu từ 8 đến tối đa 72 byte UTF-8 để không bị bcrypt cắt ngầm. Số điện thoại dùng dạng E.164 Việt Nam, ví dụ `+84900000000`.

### 3.3 Access token và refresh session

Access token là JWT ký bằng `JWT_ACCESS_SECRET`, thời hạn mặc định 15 phút. Claims tối thiểu:

- `sub`: `taiKhoanId`;
- `sid`: định danh phiên đăng nhập;
- `roles`: danh sách role hiện tại.

Refresh token là chuỗi opaque ngẫu nhiên, không phải JWT. Database chỉ lưu SHA-256 của token trong model `PhienDangNhap`:

- `phienDangNhapId`, `sessionId` duy nhất;
- `taiKhoanId`, quan hệ tới `TaiKhoan`;
- `refreshTokenHash` duy nhất;
- `hetHanLuc`, `thuHoiLuc`;
- `tokenThayTheId` tùy chọn để audit rotation;
- `createdAt`, `updatedAt`.

Refresh token mặc định hiệu lực 30 ngày. Mỗi lần refresh thực hiện rotation: thu hồi token cũ và tạo token mới trong một transaction. Việc dùng lại token đã rotate làm phiên bị từ chối. Logout thu hồi phiên được chỉ ra bởi refresh token; guard tra cứu phiên DB ở mỗi request nên access token của phiên đó bị từ chối ngay.

`POST /auth/login` phải kiểm tra tài khoản tồn tại, mật khẩu đúng, trạng thái `HOAT_DONG`, sau đó phát hành cặp token. Sai số điện thoại hoặc mật khẩu dùng chung lỗi `401 INVALID_CREDENTIALS` để tránh lộ tài khoản tồn tại.

Response đăng ký/login/refresh dùng envelope thống nhất:

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
      "fullName": "Nguyễn Văn A",
      "phoneNumber": "+84900000000",
      "roles": ["KHACH_HANG"]
    }
  }
}
```

### 3.4 Guard và current customer

Một access-token guard dùng `JwtService.verifyAsync`, kiểm tra signature, expiry, account status và session chưa bị thu hồi. Decorator nội bộ lấy principal đã xác thực; controller không đọc `customerId` từ params/body.

Authorization của `/me` yêu cầu tài khoản có role `KHACH_HANG` và quan hệ `KhachHang`. Các module commerce sau này reuse guard/principal này, không tạo auth strategy riêng.

### 3.5 Hồ sơ cá nhân

Module mới `customers/` sở hữu `GET /me` và `PATCH /me`.

`GET /me` trả thông tin tài khoản và khách hàng hiện tại, gồm mã khách hàng, điểm tích lũy, họ tên, số điện thoại, ngày sinh, CCCD, email, trạng thái xác thực và timestamps phù hợp.

`PATCH /me` giai đoạn này cho phép cập nhật `fullName`, `dateOfBirth`, `citizenId`, `email`. Số điện thoại không được đổi trực tiếp vì cần OTP riêng; flow đổi số điện thoại sẽ bổ sung theo mục đích `CAP_NHAT_SO_DIEN_THOAI`. DTO dùng whitelist và từ chối field lạ. JSON công khai dùng English camelCase; service ánh xạ sang tên field Prisma tiếng Việt.

## 4. API contract

### 4.1 Request OTP

```http
POST /api/v1/auth/register/request-otp
Content-Type: application/json

{ "phoneNumber": "+84900000000" }
```

```json
{
  "data": {
    "challengeId": "uuid",
    "expiresAt": "2026-09-28T10:05:00.000Z",
    "resendAfter": "2026-09-28T10:01:00.000Z"
  }
}
```

Không trả OTP trong response. Local developer đọc OTP từ log của API.

### 4.2 Verify OTP

```http
POST /api/v1/auth/register/verify-otp
Content-Type: application/json

{
  "challengeId": "uuid",
  "phoneNumber": "+84900000000",
  "otp": "123456"
}
```

```json
{
  "data": {
    "otpProof": "opaque-one-time-proof",
    "expiresAt": "2026-09-28T10:15:00.000Z"
  }
}
```

### 4.3 Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "otpProof": "opaque-one-time-proof",
  "fullName": "Nguyễn Văn A",
  "phoneNumber": "+84900000000",
  "password": "VexGo@123",
  "email": "a@example.com",
  "citizenId": "079123456789",
  "dateOfBirth": "2000-01-01"
}
```

Thành công trả cặp token và user theo contract tại mục 3.3.

### 4.4 Login, refresh, logout

```http
POST /api/v1/auth/login
{ "phoneNumber": "+84900000000", "password": "VexGo@123" }
```

```http
POST /api/v1/auth/refresh
{ "refreshToken": "..." }
```

```http
POST /api/v1/auth/logout
{ "refreshToken": "..." }
```

Login và refresh trả contract token tại mục 3.3. Logout trả `204 No Content`.

### 4.5 Me

```http
GET /api/v1/me
Authorization: Bearer <accessToken>
```

```http
PATCH /api/v1/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "fullName": "Nguyễn Văn B",
  "dateOfBirth": "2000-01-01",
  "email": "b@example.com",
  "citizenId": "079123456789"
}
```

## 5. Error contract

Các lỗi chính:

- `400 VALIDATION_ERROR`
- `400 OTP_INVALID`
- `400 OTP_EXPIRED`
- `400 OTP_PROOF_INVALID`
- `409 OTP_RESEND_TOO_SOON`
- `409 PHONE_ALREADY_REGISTERED`
- `401 INVALID_CREDENTIALS`
- `401 ACCESS_TOKEN_INVALID`
- `401 REFRESH_TOKEN_INVALID`
- `403 ACCOUNT_INACTIVE`
- `403 CUSTOMER_ROLE_REQUIRED`
- `404 CUSTOMER_PROFILE_NOT_FOUND`

Response giữ format chung `{ statusCode, error, message, details? }`. Message tiếng Việt phục vụ client hiện tại; frontend phải ưu tiên map theo `error` code để hỗ trợ i18n.

## 6. Cấu hình môi trường

Biến môi trường mới:

```env
JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ACCESS_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
OTP_HASH_SECRET=replace-with-another-long-random-secret
OTP_TTL_SECONDS=300
OTP_PROOF_TTL_SECONDS=600
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_ATTEMPTS=5
SMS_PROVIDER=console
```

Production phải từ chối khởi động nếu dùng `SMS_PROVIDER=console` hoặc thiếu secret. Secret thật không commit vào repository.

## 7. Tổ chức code

```text
apps/api/src/auth/
  auth.controller.ts
  auth.service.ts
  auth.module.ts
  dto/
  guards/
  decorators/
  sms/
  tokens/

apps/api/src/customers/
  customers.controller.ts
  customers.service.ts
  customers.module.ts
  dto/

apps/api/test/unit/auth/
apps/api/test/unit/customers/
apps/api/test/integration/auth/
apps/api/test/integration/customers/
```

Controller chỉ nhận request và gọi service. OTP, token, transaction và Prisma query thuộc service/provider tương ứng.

## 8. Kiểm thử

Mỗi giai đoạn theo TDD và phải có regression test độc lập.

OTP:

- tạo challenge và gọi đúng SMS adapter;
- không lưu OTP rõ;
- cooldown, expiry, sai OTP, giới hạn attempts;
- proof chỉ dùng một lần;
- hai request/verify cạnh tranh không tạo hai tài khoản.

Register/login/session:

- transaction tạo đủ `TaiKhoan`, `KhachHang`, role và session;
- rollback toàn bộ nếu một bước lỗi;
- duplicate phone;
- password hash và credential sai;
- account tạm khóa;
- access claims đúng;
- refresh rotation, replay và logout.

Profile:

- thiếu/sai/expired token;
- account không phải customer;
- chỉ đọc/sửa đúng hồ sơ của token;
- validation ngày sinh, email, CCCD và field lạ.

Sau mỗi endpoint chạy targeted tests; trước khi hoàn tất chạy lint, typecheck, toàn bộ test, build, migration trên database test/dev và smoke test HTTP bằng Postman-equivalent request.

## 9. Triển khai theo từng PR/commit logic

1. Foundation OTP: schema/migration, SMS port, request OTP.
2. Verify OTP và proof một lần.
3. Register transaction và token foundation.
4. Login, refresh rotation và logout.
5. Customer module với `GET/PATCH /me`.
6. Tài liệu Postman cho toàn flow.

Mỗi bước phải giữ branch build/test được; không để controller skeleton trả dữ liệu giả.

## 10. Ngoài phạm vi

- Google/Facebook/Apple login;
- Swagger/OpenAPI UI;
- gửi SMS production khi chưa có provider/credential;
- forgot password, change password, phone change và transaction history trong đợt đầu;
- frontend integration và lưu token phía client.
