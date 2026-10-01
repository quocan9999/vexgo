# API quản lý tài khoản Admin nhà xe

Tài liệu mô tả API dùng chung `/api/v1` để **Super Admin** quản lý tài khoản
nhân viên gắn với một nhà xe. Admin Web dùng luồng đăng nhập và phân quyền hiện
hành của backend.

## Chính sách truy cập và dữ liệu

- Tất cả endpoint dưới đây yêu cầu access token hợp lệ, role `SUPER_ADMIN` và
  permission tương ứng: `admin-account:read`, `admin-account:create` hoặc
  `admin-account:update`.
- Resource chỉ gồm tài khoản có liên kết `NhanVien` và mọi role (nếu có) đều
  thuộc tenant role catalog. Nhân viên chưa có role vẫn được quản lý để có thể
  được cấp role sau; tài khoản `SUPER_ADMIN`, khách hàng, mixed-scope hoặc ID
  ngoài tập này trả `404 ADMIN_ACCOUNT_NOT_FOUND`.
- Nhà xe của nhân viên được lưu qua `TaiKhoan → NhanVien → NhaXe`.
- `busCompanyId` trong request tạo là lựa chọn gán tenant do Super Admin được
  phép thực hiện; đây không phải nguồn xác định tenant của principal.
- Không có hard delete. Khóa tài khoản dùng trạng thái `TAM_KHOA`; trạng thái
  làm việc của nhân viên không bị thay đổi theo. Khi khóa, các session hiện hoạt
  bị thu hồi trong cùng transaction. Mở khóa không cấp session/token mới.
- Response không chứa mật khẩu, refresh-token hash hoặc session secret.

## Tạo tài khoản

```http
POST /api/v1/admin-accounts
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "fullName": "Nguyễn Minh Anh",
  "phoneNumber": "+84901234567",
  "password": "VexGo@123",
  "busCompanyId": 12,
  "employeeCode": "FUTA-NV-0001",
  "roleNames": ["NHAN_VIEN_BAN_VE", "NHAN_VIEN_CSKH"],
  "dateOfBirth": "1990-02-28",
  "email": "admin@example.com",
  "citizenId": "079123456789"
}
```

`dateOfBirth`, `email`, `citizenId` là tùy chọn và có thể gửi `null`. Mật khẩu
phải dài từ 8 đến 72 byte UTF-8. Backend hash bằng cùng cơ chế với auth hiện
hành.

`roleNames` là tùy chọn. Nếu bỏ qua, API giữ tương thích và gán mặc định
`["NHA_XE_ADMIN"]`. Nếu truyền, phải là danh sách không rỗng, không trùng và
chỉ chứa role tenant hiện có: `NHA_XE_ADMIN`, `NHAN_VIEN_BAN_VE`,
`NHAN_VIEN_CSKH`, `NHAN_VIEN_PHU_XE`, `NHAN_VIEN_KINH_DOANH`. Không gửi `null`,
`SUPER_ADMIN`, `KHACH_HANG`, role platform hoặc role không tồn tại. Endpoint
tạo từ chối danh sách rỗng; account mới phải được tạo với ít nhất một tenant
role.

Backend tự đặt:

- `TaiKhoan.trangThai = HOAT_DONG`;
- `TaiKhoan.daXacThucSoDienThoai = true` theo luồng provision nội bộ;
- `NhanVien.trangThaiLamViec = DANG_LAM_VIEC`;
- role được resolve từ catalog trên server; endpoint không nhận `vaiTroId`.

Không gửi `role`, `roles`, `permissions`, `status`, `phoneVerified` hoặc
`employmentStatus`. Tạo `TaiKhoan`, `NhanVien` và tất cả bản ghi
`TaiKhoanVaiTro` là một transaction;
nếu một bước thất bại thì không để lại record dở dang.

Response `201`:

```json
{
  "data": {
    "accountId": 101,
    "fullName": "Nguyễn Minh Anh",
    "phoneNumber": "+84901234567",
    "dateOfBirth": "1990-02-28",
    "citizenId": "079123456789",
    "email": "admin@example.com",
    "phoneVerified": true,
    "status": "HOAT_DONG",
    "roles": ["NHA_XE_ADMIN"],
    "employee": {
      "employeeId": 201,
      "employeeCode": "FUTA-NV-0001",
      "employmentStatus": "DANG_LAM_VIEC"
    },
    "busCompany": {
      "busCompanyId": 12,
      "code": "FUTA",
      "name": "FUTA",
      "status": "HOAT_DONG"
    },
    "createdAt": "2026-09-29T10:00:00.000Z",
    "updatedAt": "2026-09-29T10:00:00.000Z"
  }
}
```

## Danh sách và chi tiết

```http
GET /api/v1/admin-accounts?page=1&pageSize=10&search=FUTA&busCompanyId=12&status=HOAT_DONG&sortBy=createdAt&sortDirection=desc
GET /api/v1/admin-accounts/:id
```

Danh sách hỗ trợ `page`, `pageSize`, `search`, `sortBy`, `sortDirection`, cùng
các filter `busCompanyId` và `status`. Các giá trị `sortBy` được chấp nhận:
`fullName`, `phoneNumber`, `status`, `createdAt`, `updatedAt`. `busCompanyId` là
filter platform do Super Admin yêu cầu, không làm thay đổi quyền của request.

Response danh sách dùng envelope chung:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

## Cập nhật hồ sơ

```http
PATCH /api/v1/admin-accounts/:id
```

Chỉ nhận các field `fullName`, `dateOfBirth`, `email`, `citizenId`. Với ba field
nullable, gửi `null` để xóa giá trị hiện tại. Không thể đổi `phoneNumber`,
`password`, `busCompanyId`, `employeeCode`, role, permission hoặc trạng thái qua
endpoint này. Field ngoài hợp đồng trả `400 VALIDATION_ERROR`.

## Thay thế vai trò tài khoản

```http
PUT /api/v1/admin-accounts/:id/roles
Content-Type: application/json
```

```json
{
  "roleNames": ["NHAN_VIEN_BAN_VE", "NHAN_VIEN_CSKH"]
}
```

Endpoint yêu cầu `SUPER_ADMIN` và permission `admin-account:update`. Đây là
thao tác thay thế toàn bộ tập vai trò tenant của tài khoản, không phải thêm một
vai trò đơn lẻ. `roleNames` bắt buộc; danh sách có thể rỗng để thu hồi toàn bộ
vai trò tenant. Danh sách không được trùng và chỉ nhận các role trong tenant
catalog; backend resolve role ID từ database, không nhận `vaiTroId` từ client.

Endpoint chỉ nhận tài khoản nhân viên trong managed collection. Tài khoản
`SUPER_ADMIN`, tài khoản có vai trò customer/platform hoặc scope trộn, và tài
khoản không có liên kết `NhanVien` đều trả `404 ADMIN_ACCOUNT_NOT_FOUND` để
không làm lộ loại tài khoản ngoài collection. Thay đổi được khóa theo account
row và thực hiện trong một transaction; nếu role catalog thiếu role được chọn,
không có assignment nào bị xóa.

Các request tiếp theo resolve role và permission từ quan hệ hiện tại trong DB,
nên access token/session đang còn hiệu lực không giữ lại quyền cũ sau khi đổi
vai trò. Gửi `roleNames: []` không khóa account hoặc xóa liên kết nhân viên; nó
chỉ khiến account không còn tenant role/permission cho tới khi được gán role
mới.

Thành công trả `200` với envelope `{ "data": <account> }` giống endpoint chi
tiết; `roles` là tập role tenant sau khi cập nhật.

## Khóa và mở khóa tài khoản

```http
PATCH /api/v1/admin-accounts/:id/status
Content-Type: application/json
```

Khóa:

```json
{ "status": "TAM_KHOA" }
```

Mở khóa:

```json
{ "status": "HOAT_DONG" }
```

Gửi lại trạng thái hiện tại là hợp lệ và idempotent. Khi khóa, backend cập nhật
trạng thái tài khoản và thu hồi session đang hoạt động trong một transaction.
Mở khóa chỉ đổi trạng thái; người dùng phải đăng nhập lại để có phiên mới.

## Lỗi nghiệp vụ chính

| HTTP | Mã lỗi                     | Trường hợp                                                            |
| ---- | -------------------------- | --------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`         | Dữ liệu sai định dạng, role không hợp lệ hoặc có field ngoài hợp đồng |
| 401  | `ACCESS_TOKEN_INVALID`     | Thiếu hoặc access token không hợp lệ                                  |
| 403  | `ROLE_FORBIDDEN`           | Người gọi không phải `SUPER_ADMIN`                                    |
| 403  | `PERMISSION_FORBIDDEN`     | Người gọi thiếu permission của endpoint                               |
| 404  | `ADMIN_ACCOUNT_NOT_FOUND`  | ID không thuộc tập tài khoản nhân viên tenant được quản lý            |
| 404  | `BUS_COMPANY_NOT_FOUND`    | Nhà xe được chọn không tồn tại                                        |
| 409  | `PHONE_ALREADY_REGISTERED` | Số điện thoại đã được dùng                                            |
| 409  | `EMAIL_ALREADY_REGISTERED` | Email đã được dùng                                                    |
| 409  | `EMPLOYEE_CODE_EXISTS`     | Mã nhân viên đã được dùng trong cùng nhà xe                           |
| 500  | `AUTH_ROLE_NOT_CONFIGURED` | Một role tenant được chọn chưa có trong seed/catalog                  |

Email có unique constraint; CCCD không có unique constraint hiện tại nên API
không tự đặt thêm quy tắc duy nhất cho CCCD.
