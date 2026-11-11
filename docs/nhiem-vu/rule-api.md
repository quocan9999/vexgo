# API Development Rules — VexGo Customer API

> Phạm vi áp dụng: **backend NestJS dùng chung cho Customer Web và Customer Mobile**, cùng với cách Web/Mobile gọi API.  
> Không tạo backend riêng cho Web, Mobile hoặc Admin chỉ vì giao diện khác nhau.  
> Danh sách endpoint Customer xem tại `endpoint-api.md`. Các quy tắc UI/component xem tại `rule-ui-ux.md` khi tài liệu đó được tạo.

---

# 1. Mục tiêu và nguyên tắc cốt lõi

API của VexGo phải tuân theo các nguyên tắc sau:

```text
ONE DATABASE
ONE BACKEND
ONE BUSINESS RULE
ONE API CONTRACT

DIFFERENT UI/UX
DIFFERENT CLIENT PLATFORM
DIFFERENT PERMISSION
```

- Customer Web và Customer Mobile **MUST dùng chung API**.
- Admin và Customer **SHOULD dùng chung resource/domain endpoint** nếu use case nghiệp vụ giống nhau; authorization quyết định phạm vi dữ liệu được phép thao tác.
- **MUST NOT** tạo `/web/*`, `/mobile/*`, `/customer-web/*`, `/customer-mobile/*` chỉ vì client khác nhau.
- Backend service là **nguồn sự thật** cho business rule.
- Frontend có thể validate/tính preview để cải thiện UX nhưng backend **MUST validate và tính lại** trước khi ghi dữ liệu.
- Frontend **MUST NOT** truy cập Prisma hoặc database trực tiếp.
- Prisma schema/database model **MUST NOT** được xem là public API contract. API phải có DTO/type riêng.

Luồng chuẩn:

```text
Customer Web / Customer Mobile
        ↓
Frontend service/API layer
        ↓
NestJS Controller
        ↓
NestJS Service / Domain logic
        ↓
Prisma
        ↓
MySQL
```

---

# 2. Mức độ bắt buộc của rule

Trong tài liệu này:

- **MUST**: bắt buộc thực hiện.
- **MUST NOT**: tuyệt đối không làm.
- **SHOULD**: nên thực hiện, chỉ bỏ qua khi có lý do kỹ thuật/nghiệp vụ rõ ràng.
- **MAY**: tùy chọn khi phù hợp.

Nếu một endpoint hiện tại xung đột với rule này, team phải **thống nhất contract trước khi sửa**, không tự đổi contract một phía rồi để Web/Mobile bị vỡ.

---

# 3. API base URL, versioning và naming

## 3.1 Base URL

Toàn bộ REST API **MUST** dùng prefix:

```text
/api/v1
```

Ví dụ:

```text
GET  /api/v1/trips/search
GET  /api/v1/trips/:tripId
POST /api/v1/bookings
POST /api/v1/payments
```

## 3.2 Naming URL

- URL **MUST dùng tiếng Anh**.
- Resource dùng danh từ số nhiều: `trips`, `bookings`, `payments`, `tickets`.
- URL dùng **kebab-case** khi có nhiều từ: `bus-companies`, `seat-holds`, `branch-offices`.
- **MUST NOT** dùng camelCase trong URL.
- **MUST NOT** đặt URL theo tên hành động kiểu RPC nếu resource-oriented API đã biểu diễn được nghiệp vụ.

Đúng:

```text
GET  /api/v1/bus-companies
GET  /api/v1/trips/:tripId
POST /api/v1/bookings/:bookingId/cancel
```

Sai:

```text
GET  /api/getBusCompanies
GET  /api/customerTrips
POST /api/doCancelBooking
GET  /api/mobile/trips
```

Các action nghiệp vụ như `cancel`, `exchange`, `quote`, `verify-otp` được phép khi chúng là một **use case riêng**, không phải CRUD thuần túy.

## 3.3 Không tách endpoint chỉ vì platform

Sai:

```text
POST /api/v1/web/bookings
POST /api/v1/mobile/bookings
```

Đúng:

```text
POST /api/v1/bookings
```

Khác biệt redirect/deeplink, UI hay cách lưu token phải xử lý ở client/platform layer, không nhân đôi business API.

---

# 4. Cấu trúc backend module

Mỗi domain/feature **MUST** nằm trong module riêng dưới `apps/api/src/`.

Ví dụ:

```text
apps/api/src/
├── auth/
├── customers/
├── bus-companies/
├── routes/
├── trips/
├── seat-holds/
├── bookings/
├── promotions/
├── payments/
├── tickets/
├── invoices/
├── shipments/
└── support-chat/
```

Một module nghiệp vụ thông thường:

```text
bookings/
├── bookings.module.ts
├── bookings.controller.ts
├── bookings.service.ts
├── dto/
│   ├── create-booking.dto.ts
│   ├── quote-booking.dto.ts
│   └── query-bookings.dto.ts
├── types/
└── ...
```

Quy tắc:

- Controller **MUST** mỏng: nhận request → lấy params/query/body/current user → gọi service → trả response.
- Controller **MUST NOT** chứa business logic phức tạp.
- Controller **MUST NOT** chứa truy vấn Prisma phức tạp.
- Service/domain layer chịu trách nhiệm business rule.
- Chỉ backend data-access/service phù hợp được truy cập Prisma.
- **MUST NOT** gom toàn bộ DTO của hệ thống vào một thư mục `dto/` chung nếu DTO thuộc feature cụ thể.
- **MUST NOT** copy business logic của module khác. Nếu cần dữ liệu/domain behavior từ module khác, dùng exported service/interface đã thống nhất.

---

# 5. API contract phải được chốt trước khi nối full-stack

Trước khi Web/Mobile tích hợp một flow, owner endpoint **MUST chốt** tối thiểu:

1. HTTP method.
2. URL.
3. Path params.
4. Query params.
5. Request body.
6. Auth/permission.
7. Success response.
8. Error response và error code quan trọng.
9. Idempotency/concurrency requirement nếu có.
10. Trạng thái HTTP trả về.

Không được làm kiểu:

> “Frontend cứ code trước, backend trả gì tính sau.”

Nếu contract thay đổi:

- cập nhật `endpoint-api.md`;
- cập nhật DTO/type frontend liên quan;
- cập nhật test;
- thông báo người đang dùng endpoint;
- tránh breaking change âm thầm.

---

# 6. Request data — dữ liệu client được phép gửi

## 6.1 Chỉ gửi dữ liệu client thực sự sở hữu

Client chỉ gửi **input/selection** của người dùng hoặc dữ liệu cần thiết cho use case.

Ví dụ tạo booking:

```json
{
  "tripId": 123,
  "seatIds": [10, 11],
  "pickupPoint": "Bến xe Miền Đông mới",
  "promotionCode": "SUMMER26",
  "contact": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "email": "a@example.com"
  },
  "holdToken": "hold_xxx"
}
```

Client **MUST NOT** gửi các field do backend quyết định như nguồn sự thật:

```json
{
  "unitPrice": 250000,
  "discountAmount": 50000,
  "totalAmount": 450000,
  "paymentStatus": "SUCCESS",
  "ticketStatus": "VALID",
  "seatStatus": "AVAILABLE"
}
```

Các dữ liệu trên có thể được client hiển thị từ response trước đó nhưng backend vẫn **MUST tính/xác minh lại** khi ghi dữ liệu.

## 6.2 Không tin `customerId` từ client cho dữ liệu cá nhân

Endpoint dạng:

```text
GET /api/v1/me
GET /api/v1/bookings
GET /api/v1/tickets
```

backend **MUST suy ra customer hiện tại từ token/session**.

Sai:

```text
GET /api/v1/bookings?customerId=42
```

nếu mục đích là lấy booking của người đang đăng nhập.

Client không được tự chỉ định ID người dùng khác để truy cập dữ liệu private.

## 6.3 Public identifiers

- Path/query/body **MUST** dùng identifier đã được contract công khai.
- Không expose internal secret, refresh token, password hash, provider secret, Prisma metadata.
- Không dùng index của mảng trên UI làm identifier gửi lên backend.

## 6.4 JSON field naming

Public REST JSON **MUST dùng `camelCase` tiếng Anh**.

Ví dụ:

```json
{
  "tripId": 123,
  "departureTime": "2026-09-27T08:00:00+07:00",
  "busCompany": {
    "id": 5,
    "name": "..."
  }
}
```

Prisma model/field hiện tại có thể giữ naming tiếng Việt theo schema dự án, nhưng backend **MUST map** sang API DTO/public contract phù hợp. Không leak tên field database chỉ vì thuận tiện.

---

# 7. DTO và validation

## 7.1 DTO bắt buộc cho input quan trọng

Input quan trọng **MUST** có DTO cụ thể.

Ví dụ:

```ts
export class CreateBookingDto {
  tripId: number;
  seatIds: number[];
  promotionCode?: string;
  contact: BookingContactDto;
  holdToken?: string;
}
```

- **MUST NOT** dùng `any` cho request body nếu có thể mô tả kiểu cụ thể.
- **MUST** dùng `class-validator` cho validation DTO.
- **MUST** bật `ValidationPipe` toàn cục.
- **SHOULD** bật whitelist để loại/không cho field ngoài DTO lọt vào xử lý.
- **SHOULD** dùng `forbidNonWhitelisted` ở API quan trọng để phát hiện client gửi sai contract sớm.
- Validation frontend chỉ phục vụ UX; backend **MUST validate lại**.

## 7.2 Validation tối thiểu

Tùy DTO, phải cân nhắc:

- required/optional;
- kiểu dữ liệu;
- min/max length;
- định dạng email/phone;
- enum hợp lệ;
- numeric range;
- array rỗng;
- array duplicate;
- ngày hợp lệ;
- ID > 0;
- giá trị null/undefined;
- business state sau validation cú pháp.

Ví dụ:

```text
seatIds = []                 → validation error
seatIds = [10, 10]           → validation/business error
pageSize = 100000            → validation error
sortBy = "DROP TABLE ..."    → validation error/whitelist
```

## 7.3 Validation cú pháp khác business validation

DTO validation kiểm tra dữ liệu **có đúng hình dạng**.

Service kiểm tra dữ liệu **có hợp lệ về nghiệp vụ**.

Ví dụ:

```text
DTO:
tripId phải là số nguyên dương.

Service:
trip phải tồn tại, còn mở bán, chưa khởi hành và ghế vẫn có thể đặt.
```

Không cố nhét toàn bộ business rule vào decorator DTO.

---

# 8. Path params, query params và filter

## 8.1 Pagination chuẩn

Danh sách phân trang **MUST** dùng:

```text
page
pageSize
```

Ví dụ:

```text
GET /api/v1/bookings?page=1&pageSize=10
```

Backend **MUST** đặt giới hạn `pageSize` hợp lý, không cho client yêu cầu vô hạn record.

## 8.2 Search/sort chuẩn

Nếu feature hỗ trợ:

```text
search
sortBy
sortDirection=asc|desc
```

`sortBy` **MUST được whitelist** theo field cho phép. Không truyền trực tiếp field từ query vào raw SQL/Prisma ordering mà không kiểm tra.

## 8.3 Filter nghiệp vụ

Có thể thêm filter cụ thể như:

```text
status
busCompanyId
routeId
departureDate
from
to
vehicleTypeId
minPrice
maxPrice
```

Tên filter **MUST nhất quán** giữa endpoint liên quan.

## 8.4 Date range

Nếu cần khoảng thời gian, dùng tên rõ nghĩa:

```text
fromDate
toDate
```

hoặc tên domain-specific rõ ràng nếu cần.

Không dùng các tên mơ hồ như:

```text
start
end
from1
date2
```

---

# 9. Ngày giờ và timezone

## 9.1 Format

Timestamp **MUST** dùng ISO 8601 có timezone/offset:

```text
2026-09-27T08:30:00+07:00
```

hoặc UTC:

```text
2026-09-27T01:30:00Z
```

Date-only dùng:

```text
2026-09-27
```

## 9.2 Nguồn sự thật thời gian

Backend **MUST** quyết định:

- trip còn mở bán hay không;
- hold đã hết hạn chưa;
- promotion còn hiệu lực không;
- booking có được hủy không;
- payment hết hạn chưa.

Frontend chỉ hiển thị/countdown theo timestamp backend cung cấp.

Frontend **MUST NOT** tự quyết định business rule dựa trên đồng hồ máy người dùng.

## 9.3 Timezone

Timezone nghiệp vụ phải được cấu hình thống nhất ở backend. Không hard-code nhiều timezone khác nhau trong từng module.

---

# 10. Tiền tệ và số tiền

## 10.1 Không dùng floating point cho business money

Backend **MUST NOT** dùng floating-point để tính tiền nghiệp vụ.

Dùng:

- MySQL `DECIMAL` / Prisma `Decimal`; hoặc
- integer theo đơn vị tiền nhỏ nhất nếu team thống nhất.

## 10.2 Contract tiền VND

Trong scope hiện tại, API Customer **SHOULD trả tiền VND dưới dạng số nguyên đơn vị đồng**.

Ví dụ:

```json
{
  "baseAmount": 500000,
  "discountAmount": 50000,
  "serviceFee": 0,
  "totalAmount": 450000,
  "currency": "VND"
}
```

Không trả:

```json
{
  "totalAmount": 450000.0000001
}
```

## 10.3 Backend luôn tính lại

Client có thể gửi:

```json
{
  "promotionCode": "SUMMER26"
}
```

Client **MUST NOT** quyết định:

```json
{
  "discountPercent": 20,
  "finalPrice": 400000
}
```

Promotion service/backend quyết định mức giảm cuối cùng.

---

# 11. Success response chuẩn

## 11.1 Resource đơn

Mọi response thành công có dữ liệu **MUST** dùng envelope `data`:

```json
{
  "data": {
    "id": 123,
    "status": "PENDING"
  }
}
```

**MUST NOT** tự đặt envelope khác như:

```json
{
  "result": {},
  "payload": {},
  "responseData": {}
}
```

## 11.2 Danh sách phân trang

```json
{
  "data": [
    { "id": 1 },
    { "id": 2 }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 50,
    "totalPages": 5
  }
}
```

`meta` phân trang **MUST** giữ đúng field:

```text
page
pageSize
totalItems
totalPages
```

Không feature này dùng `total`, feature kia dùng `count`, feature khác dùng `lastPage` nếu không có quyết định đổi contract chung.

## 11.3 Empty list

Danh sách không có dữ liệu trả:

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

Không dùng `404` chỉ vì list rỗng.

## 11.4 Mutation success

Create thường dùng `201 Created` và vẫn trả envelope:

```json
{
  "data": {
    "id": 123,
    "status": "PENDING"
  }
}
```

Update/action thành công thường dùng `200 OK` và trả resource/state mới nếu client cần đồng bộ.

Để giữ contract nhất quán, **SHOULD tránh `204 No Content`** cho các mutation Customer nếu client cần cập nhật state ngay sau thao tác.

---

# 12. Error response chuẩn

## 12.1 Format chung

Error response **MUST** theo dạng:

```json
{
  "statusCode": 404,
  "error": "BOOKING_NOT_FOUND",
  "message": "Không tìm thấy đơn đặt vé."
}
```

`error` là **machine-readable stable error code**.

`message` là message fallback cho người/log/debug, nhưng frontend **SHOULD map theo `error`** để hỗ trợ Việt – Anh.

## 12.2 Validation error

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "details": [
    {
      "field": "email",
      "message": "Email không hợp lệ."
    }
  ]
}
```

`details` chỉ thêm khi có ích.

Mỗi phần tử validation detail:

```text
field
message
```

## 12.3 Error code naming

Error code **MUST** dùng `UPPER_SNAKE_CASE`.

Ví dụ:

```text
VALIDATION_ERROR
UNAUTHORIZED
ACCESS_TOKEN_EXPIRED
FORBIDDEN
TRIP_NOT_FOUND
TRIP_NOT_BOOKABLE
SEAT_UNAVAILABLE
SEAT_HOLD_EXPIRED
PROMOTION_INVALID
PROMOTION_NOT_APPLICABLE
BOOKING_NOT_FOUND
BOOKING_NOT_CANCELLABLE
PAYMENT_NOT_FOUND
PAYMENT_ALREADY_PAID
PAYMENT_PROVIDER_ERROR
SHIPMENT_NOT_FOUND
```

Frontend **MUST NOT** parse chuỗi `message` để hiểu lỗi nghiệp vụ.

Sai:

```ts
if (error.message.includes('ghế')) {
  // ...
}
```

Đúng:

```ts
if (error.code === 'SEAT_UNAVAILABLE') {
  // ...
}
```

---

# 13. HTTP status code convention

Dùng status code theo ý nghĩa HTTP, không trả mọi thứ bằng `200`.

| Status | Dùng khi |
|---|---|
| `200 OK` | GET thành công, update/action thành công |
| `201 Created` | tạo resource thành công |
| `400 Bad Request` | request sai format/validation/business input cơ bản |
| `401 Unauthorized` | chưa đăng nhập, token invalid/expired |
| `403 Forbidden` | đã xác thực nhưng không có quyền |
| `404 Not Found` | resource không tồn tại hoặc không được expose |
| `409 Conflict` | xung đột trạng thái/concurrency, ví dụ `SEAT_UNAVAILABLE` |
| `422 Unprocessable Entity` | MAY dùng cho business validation phức tạp nếu team thống nhất; nếu chưa thống nhất thì ưu tiên `400` + error code rõ ràng |
| `429 Too Many Requests` | rate limit |
| `500 Internal Server Error` | lỗi server ngoài dự kiến |
| `502/503` | phụ thuộc external service gặp sự cố khi phù hợp |

**MUST NOT** trả `200` kèm `{ success: false }` cho lỗi nghiệp vụ/HTTP lỗi.

---

# 14. Authentication

## 14.1 Access token

Request private API **MUST** gửi access token qua:

```http
Authorization: Bearer <access-token>
```

Backend guard xác thực token và đưa current identity vào request context.

## 14.2 Refresh flow

Web và Mobile dùng chung endpoint:

```text
POST /api/v1/auth/refresh
```

Cơ chế lưu refresh credential có thể khác theo platform nhưng phải an toàn:

- Web **SHOULD** ưu tiên HttpOnly + Secure cookie nếu kiến trúc auth hiện tại hỗ trợ.
- Mobile **MUST** lưu refresh credential trong secure storage của hệ điều hành nếu credential được client quản lý.
- **MUST NOT** lưu refresh token nhạy cảm trong plain local storage/file không bảo vệ trên Mobile.
- Refresh credential **MUST NOT** được log.

Nếu team chọn một cơ chế khác, contract phải được chốt chung và cập nhật tài liệu trước khi tích hợp.

## 14.3 Logout

`POST /api/v1/auth/logout` **MUST** làm mất hiệu lực session/refresh credential theo cơ chế auth đã chọn.

Frontend xóa local auth state sau khi backend logout thành công hoặc khi refresh credential đã vô hiệu.

## 14.4 Authorization

Authentication trả lời:

> Người này là ai?

Authorization trả lời:

> Người này được làm gì với resource này?

Backend **MUST** kiểm tra ownership/scope.

Ví dụ:

- Customer chỉ xem booking/ticket/invoice/shipment của chính mình.
- Admin nhà xe chỉ thao tác dữ liệu thuộc nhà xe được phân quyền.
- Super Admin mới có phạm vi toàn hệ thống.

Ẩn nút ở frontend **không thay thế authorization backend**.

---

# 15. Frontend API client và service layer

## 15.1 Không gọi `fetch/axios` rải trong component

Web/Mobile **MUST** có API client/service layer tập trung.

Ví dụ cấu trúc:

```text
features/
└── bookings/
    ├── components/
    ├── hooks/
    ├── services/
    │   └── booking.service.ts
    └── types/
```

Component chỉ nên:

- nhận/render data;
- quản lý state UI;
- xử lý form interaction;
- gọi hook/service;
- hiển thị loading/error/empty/success.

Component **MUST NOT** chứa URL API rải rác hoặc tự cài token refresh.

## 15.2 Shared API types

Frontend nên có generic type tương đương:

```ts
export type ApiResponse<T> = {
  data: T;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ApiErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
};
```

Không tạo mỗi feature một kiểu envelope khác nhau.

---

# 16. Request interceptor

Web và Mobile **MUST** có một request interceptor/common request pipeline tại API client level.

Request interceptor chịu trách nhiệm các việc chung, không chứa business logic của feature.

## 16.1 Việc interceptor SHOULD làm

1. Gắn `baseURL`.
2. Gắn `Accept: application/json`.
3. Gắn `Content-Type: application/json` cho JSON request.
4. Gắn access token nếu endpoint cần auth.
5. Có thể gắn `Accept-Language: vi|en` nếu client dùng locale hiện tại.
6. Có thể gắn request/correlation id nếu hệ thống logging hỗ trợ.

Ví dụ logic:

```ts
config.headers.Authorization = `Bearer ${accessToken}`;
config.headers['Accept-Language'] = locale;
```

## 16.2 Việc interceptor MUST NOT làm

- Không tự thêm `customerId` từ local state vào mọi request.
- Không tự sửa request body business field như `totalAmount`, `status`, `discount`.
- Không tự retry mọi POST vô điều kiện.
- Không swallow lỗi rồi trả object giả như request thành công.
- Không chứa logic feature-specific như “nếu booking thì tự áp promo”.

## 16.3 Multipart/form-data

Khi upload file/image:

- dùng `multipart/form-data`;
- để HTTP client/runtime tạo boundary đúng;
- không ép JSON content type cho request upload;
- backend **MUST** validate file type/size/count;
- **MUST NOT** tin extension filename do client gửi.

---

# 17. Response interceptor

Response interceptor dùng để xử lý cross-cutting concern, không để che mất API contract.

## 17.1 Thành công

Response interceptor **SHOULD giữ nguyên response body envelope**:

```json
{
  "data": ...,
  "meta": ...
}
```

Không nên auto-unwrap tất cả thành `response.data.data`, vì list cần `meta` và một số flow cần header/status.

Feature service có thể map response thành model tiện dùng nếu cần.

## 17.2 Chuẩn hóa lỗi

Response interceptor **SHOULD** map HTTP error về một frontend error type chung:

```ts
class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: Array<{ field: string; message: string }>;
}
```

UI dùng:

```ts
error.code
```

thay vì phụ thuộc cấu trúc Axios/fetch cụ thể.

## 17.3 Không hiển thị toast trong interceptor

Global response interceptor **MUST NOT** tự bắn toast cho mọi lỗi.

Lý do:

- lỗi form cần hiển thị ngay tại field;
- `SEAT_UNAVAILABLE` cần refresh sơ đồ ghế;
- `PROMOTION_INVALID` cần hiển thị cạnh ô promo;
- `401` có thể được refresh token tự động;
- một lỗi có thể bị hiển thị toast lặp nhiều lần.

Interceptor chỉ normalize/route lỗi hệ thống; feature quyết định UX.

---

# 18. 401 interceptor và token refresh

Đây là rule bắt buộc để tránh Web/Mobile refresh token lỗi hoặc request lặp vô hạn.

## 18.1 Luồng chuẩn

Khi request private API trả:

```text
401 ACCESS_TOKEN_EXPIRED
```

client:

1. Kiểm tra request này chưa retry refresh trước đó.
2. Gọi `POST /api/v1/auth/refresh` **một lần**.
3. Nếu refresh thành công: cập nhật access token.
4. Retry request cũ **một lần** với token mới.
5. Nếu refresh thất bại: clear auth state và chuyển về trạng thái đăng nhập lại.

## 18.2 Single-flight refresh

Nếu 5 request cùng lúc đều nhận `401`, client **MUST NOT** gọi 5 refresh request độc lập.

Phải có cơ chế **single-flight/refresh queue**:

```text
Request A ─┐
Request B ─┤→ cùng chờ 1 refresh request
Request C ─┘
```

Sau khi refresh thành công, replay các request đang chờ.

## 18.3 Không refresh trong các trường hợp này

**MUST NOT** tự refresh khi:

- endpoint `/auth/login` trả `401`;
- endpoint `/auth/refresh` trả `401`;
- `403 FORBIDDEN`;
- `409 SEAT_UNAVAILABLE`;
- validation/business error khác.

## 18.4 Chống infinite loop

Mỗi request retry sau refresh **MUST** có cờ nội bộ như `_retry = true` hoặc cơ chế tương đương.

Nếu request retry tiếp tục `401`, dừng và logout/auth reset; không lặp vô hạn.

---

# 19. Retry request

## 19.1 GET/read request

Client **MAY** retry read request khi gặp network error/timeout/temporary `5xx`, nhưng phải có giới hạn.

Ví dụ:

```text
max 1–2 retry
exponential backoff nhỏ
```

## 19.2 Mutation request

`POST/PATCH/DELETE` **MUST NOT** bị auto-retry vô điều kiện.

Đặc biệt:

```text
POST /bookings
POST /payments
POST /shipments
```

retry sai có thể tạo record/giao dịch trùng.

Chỉ retry mutation khi:

- endpoint được thiết kế idempotent; hoặc
- request có `Idempotency-Key` và backend hỗ trợ đúng semantics.

---

# 20. Idempotency

Các thao tác có khả năng client/provider gửi lại **SHOULD/MUST** có cơ chế idempotency phù hợp.

## 20.1 Endpoint cần ưu tiên idempotency

- tạo payment;
- payment callback/webhook;
- tạo booking khi client có thể retry do timeout;
- confirm booking nếu có endpoint riêng;
- external provider event.

## 20.2 Idempotency key

Client có thể gửi:

```http
Idempotency-Key: <uuid>
```

Rule:

- Key đại diện cho **một logical action**, không phải mỗi HTTP retry một key mới.
- Nếu request timeout và client retry, **MUST reuse cùng key**.
- Backend lưu/đối chiếu key theo scope phù hợp.
- Cùng key + cùng operation phải trả cùng outcome hoặc conflict rõ ràng.
- Không tái sử dụng một key cho hai payload nghiệp vụ khác nhau.

## 20.3 Payment provider idempotency

Callback/webhook **MUST** deduplicate theo transaction/event identifier của provider khi có.

Không được tạo vé/payment/booking lần hai chỉ vì provider callback lại.

---

# 21. Concurrency — ghế và booking

Frontend chỉ hiển thị state ghế đã biết tại thời điểm fetch. Backend mới là nguồn sự thật.

## 21.1 Seat mutation

Giữ/đặt/xác nhận ghế **MUST** xử lý race condition tại backend/database.

Backend **MUST NOT** làm kiểu:

```text
1. SELECT thấy ghế TRỐNG
2. chờ lâu
3. INSERT booking
4. UPDATE ghế
```

mà không có atomicity/transaction/constraint phù hợp.

## 21.2 Khi ghế vừa bị người khác giữ/đặt

API trả:

```http
409 Conflict
```

```json
{
  "statusCode": 409,
  "error": "SEAT_UNAVAILABLE",
  "message": "Ghế đã được người khác giữ hoặc đặt."
}
```

Frontend phải:

- báo rõ cho user;
- refresh seat map;
- yêu cầu chọn ghế khác.

Frontend **MUST NOT** cố ép booking tiếp bằng dữ liệu cache cũ.

## 21.3 Seat hold

Nếu dùng hold:

- hold phải có owner/session;
- có `expiresAt`;
- backend kiểm tra expiry;
- release phải an toàn;
- expired hold phải có cơ chế dọn hoặc được coi như không còn hiệu lực.

**MUST NOT** chỉ set trạng thái `DANG_GIU` mà không biết ai giữ và giữ đến bao giờ.

---

# 22. Transaction

Prisma transaction **MUST** dùng khi một use case ghi nhiều bảng và cần all-or-nothing.

Ví dụ:

- tạo booking + tickets;
- giữ/chuyển trạng thái nhiều ghế;
- hủy vé + cập nhật booking + refund state phù hợp;
- payment success + cập nhật booking/ticket;
- tạo shipment + cargo items;
- áp khuyến mãi nhiều record nếu cần.

**MUST NOT** mở DB transaction rồi chờ network call tới MoMo/VNPAY/ZaloPay hoặc external service.

Luồng đúng:

```text
DB transaction ngắn
→ commit
→ external call
→ nhận response/callback
→ DB transaction tiếp theo nếu cần
```

Không giữ lock database trong lúc chờ internet/provider.

---

# 23. Payment rules

## 23.1 Backend tạo payment

Client gửi tối thiểu reference cần thanh toán + provider lựa chọn.

Backend quyết định:

- amount;
- order/payment reference;
- callback URL;
- provider payload;
- signature.

Client **MUST NOT** được quyết định amount cuối cùng.

## 23.2 Return URL / deep link

Web và Mobile có thể cần return target khác nhau, nhưng:

- **MUST whitelist/validate** return URL/deep link;
- **MUST NOT** cho client truyền arbitrary redirect URL rồi backend redirect/sign theo;
- không tạo hai business payment endpoint chỉ vì Web/Mobile khác return mechanism.

## 23.3 Callback/webhook

Payment callback **MUST**:

1. verify signature;
2. verify provider transaction/order identifiers;
3. verify amount/currency nếu provider hỗ trợ;
4. xử lý idempotent;
5. cập nhật payment/booking trong transaction phù hợp;
6. không tin dữ liệu “payment success” từ frontend.

Frontend redirect về trang success **không phải bằng chứng payment đã thành công**.

UI phải gọi status endpoint/backend để xác nhận.

---

# 24. Promotion rules

Promotion logic chỉ có **một nguồn sự thật** ở backend.

Backend kiểm tra tối thiểu khi phù hợp:

- mã tồn tại;
- đang active;
- thời gian hiệu lực;
- số lượt sử dụng;
- điều kiện customer;
- điều kiện bus company/trip/route/service;
- minimum amount;
- maximum discount;
- conflict với promotion khác;
- booking/shipment context.

Frontend có thể show “ước tính giảm”, nhưng backend phải tính lại trong quote và lúc create/confirm.

Không copy công thức promotion vào cả:

```text
Web
Mobile
bookings.service
shipments.service
```

mỗi nơi một bản.

---

# 25. Ownership và cross-module dependency

Mỗi domain có owner backend theo `endpoint-api.md`.

Khi module A cần module B:

- dùng exported service/interface;
- không query trực tiếp table domain khác chỉ để né dependency;
- không copy logic domain khác;
- tránh circular dependency bằng interface/facade phù hợp.

Ví dụ:

`bookings` cần trip:

```ts
tripsService.getTripForBooking(tripId)
```

Không tạo:

```text
customer-trip-copy.service.ts
booking-trip.service.ts   // copy logic trip
```

nếu `trips` đã là nguồn sự thật.

---

# 26. Authorization và data scope

## 26.1 Owner resource

Endpoint private như:

```text
GET /bookings/:bookingId
GET /tickets/:ticketId
GET /invoices/:invoiceId
GET /shipments/:shipmentId
```

backend **MUST** xác minh resource thuộc current customer hoặc user có quyền hợp lệ.

Không chỉ check “resource tồn tại”.

## 26.2 Tránh IDOR

Sai:

```ts
return prisma.ve.findUnique({ where: { id: ticketId } });
```

nếu bất kỳ customer đăng nhập nào cũng gọi được.

Đúng về ý tưởng:

```text
find ticket by ticketId + ownership/current customer scope
```

hoặc kiểm tra ownership sau query trong service.

## 26.3 Không leak existence khi nhạy cảm

Khi phù hợp, có thể trả `404` thay vì tiết lộ rằng resource tồn tại nhưng thuộc user khác.

---

# 27. CORS

Local development hiện dùng:

```text
Customer Web: http://localhost:3000
Admin Web:    http://localhost:3001
API:          http://localhost:4000
```

CORS:

- cấu hình bằng environment;
- **MUST NOT** hard-code production origin;
- chỉ allow origin cần thiết;
- nếu dùng credentials/cookie, cấu hình `credentials` chính xác;
- không dùng `*` cùng credentials.

Mobile native không hoạt động giống browser CORS nhưng vẫn dùng chung API/auth contract.

---

# 28. Logging và dữ liệu nhạy cảm

Backend/client **MUST NOT log**:

- password;
- OTP;
- access token;
- refresh token;
- payment secret/signature key;
- full card/bank credential;
- provider secret;
- dữ liệu nhạy cảm không cần thiết.

Log error nên có đủ context kỹ thuật nhưng không leak secret.

**SHOULD** log identifier nghiệp vụ an toàn như:

```text
bookingId
paymentId
tripId
requestId
provider transaction id đã mask/phù hợp
```

Không log toàn bộ request body auth/payment một cách mù quáng.

---

# 29. External service handling

Khi gọi MoMo/VNPAY/ZaloPay hoặc dịch vụ ngoài:

- timeout **MUST** được cấu hình;
- lỗi provider **MUST** map về error code nội bộ ổn định;
- không expose raw provider error object trực tiếp cho client;
- retry chỉ khi operation an toàn/idempotent;
- credential lấy từ env/secret manager phù hợp;
- **MUST NOT** commit API key/secret vào repository.

Ví dụ error client:

```json
{
  "statusCode": 502,
  "error": "PAYMENT_PROVIDER_ERROR",
  "message": "Không thể kết nối cổng thanh toán. Vui lòng thử lại."
}
```

Backend log có thể giữ provider error detail phù hợp để debug.

---

# 30. File upload

Nếu shipment/review/content có upload:

Backend **MUST** validate:

- MIME type;
- magic bytes/file signature nếu cần;
- size;
- số lượng file;
- quyền upload;
- filename sanitization;
- storage path/key.

Client **MUST NOT** gửi đường dẫn local rồi kỳ vọng backend đọc file trên máy client.

Response upload **SHOULD** trả file metadata/resource id, không expose filesystem path nội bộ.

Ví dụ:

```json
{
  "data": {
    "id": 991,
    "url": "https://...",
    "mimeType": "image/jpeg"
  }
}
```

---

# 31. Realtime/WebSocket rules

REST vẫn là baseline để:

- load history;
- reconnect;
- recover state.

WebSocket dùng cho realtime event.

## 31.1 Auth socket

Socket **MUST** xác thực user/session trước khi subscribe private channel.

## 31.2 Event naming

Dùng event name có namespace rõ ràng:

```text
support.message.send
support.message.new
support.message.read
support.connected
```

Không dùng event mơ hồ như:

```text
message
new
update
```

## 31.3 Persist trước/bên cạnh broadcast

Tin nhắn quan trọng **MUST** được persist theo business rule để user reconnect vẫn load lại được.

Không coi event realtime chỉ tồn tại trong memory là lịch sử chat.

## 31.4 Deduplication

Nếu socket/client có khả năng gửi lại message, **SHOULD** có client message id/idempotency mechanism để tránh duplicate.

---

# 32. API language / i18n

Không tạo endpoint đổi ngôn ngữ chỉ để đổi UI.

Client quản lý locale `vi`/`en`.

Backend:

- trả stable `error` code;
- `message` là fallback;
- có thể đọc `Accept-Language` nếu cần message/content localized;
- **MUST NOT** thay đổi business logic theo locale;
- không tự dịch tên nhà xe/tuyến/địa chỉ nếu database không có dữ liệu song ngữ.

Frontend map:

```text
SEAT_UNAVAILABLE
→ vi: Ghế đã được người khác chọn.
→ en: This seat is no longer available.
```

---

# 33. Cache và stale data

Các dữ liệu ít thay đổi như:

- bus companies;
- routes;
- cargo types;
- content pages;

có thể cache khi phù hợp.

Các dữ liệu biến động nhanh như:

- seat availability;
- seat hold;
- booking/payment status;
- promotion applicability;

**MUST NOT** được cache theo cách làm client/backend dùng state cũ để ra quyết định nghiệp vụ.

Frontend có thể cache để render nhanh nhưng phải revalidate trước thao tác ghi quan trọng.

---

# 34. Public lookup endpoint

Các endpoint public lookup như ticket/invoice/shipment **MUST** có cơ chế xác minh đủ để tránh dò dữ liệu hàng loạt.

Ví dụ có thể yêu cầu kết hợp:

```text
trackingCode + phone
invoiceCode + phone/email phù hợp
bookingCode + contact verification
```

Không expose dữ liệu private chỉ bằng ID tăng dần dễ đoán.

**SHOULD** rate-limit lookup endpoint.

---

# 35. Rate limiting và chống abuse

Các endpoint public/nhạy cảm **SHOULD** có rate limit phù hợp:

- login;
- register OTP;
- forgot password OTP;
- verify OTP;
- public lookup;
- chatbot nếu có;
- support/chat nếu có nguy cơ spam.

OTP endpoint **MUST** có cooldown/expiry/attempt limit phù hợp.

Không trả thông tin giúp attacker phân biệt quá chi tiết tài khoản có tồn tại hay không nếu không cần thiết.

---

# 36. Prisma và database rules

- `prisma/schema.prisma` là nguồn schema chính của ứng dụng.
- **MUST NOT** sửa database bằng phpMyAdmin rồi bỏ qua Prisma migration.
- **MUST NOT** sửa migration đã được team dùng nếu chưa thống nhất reset dev database.
- Prisma model/field tiếng Việt hiện có **MUST** được giữ nếu chưa có quyết định refactor chính thức.
- Prisma Client generated file **MUST NOT** sửa tay.
- Khi đổi schema, **MUST** xem ảnh hưởng cả Admin và Customer.
- Dữ liệu nghiệp vụ có lịch sử **SHOULD** dùng soft-delete/trạng thái phù hợp thay vì hard-delete.

---

# 37. Không expose Prisma entity trực tiếp

Controller **MUST NOT** đơn giản trả nguyên object Prisma nếu object đó chứa field nội bộ/nhạy cảm hoặc naming không phù hợp public API.

Nên có mapping/serializer/public response model.

Ví dụ database có:

```text
matKhauHash
refreshTokenHash
internalNote
providerSecret
```

public response **MUST NOT** chứa các field này.

Cho dù `undefined` ở một số flow, contract vẫn nên chủ động whitelist field được trả.

---

# 38. Error handling backend

## 38.1 Không throw error string tùy hứng

Sai:

```ts
throw new BadRequestException('Sai rồi');
```

nếu frontend cần logic theo lỗi.

Nên có exception/error factory thống nhất để tạo:

```json
{
  "statusCode": 409,
  "error": "SEAT_UNAVAILABLE",
  "message": "Ghế đã được người khác giữ hoặc đặt."
}
```

## 38.2 Unknown error

Lỗi ngoài dự kiến:

- log server-side với request/context phù hợp;
- client nhận generic `500`;
- **MUST NOT** trả stack trace/database detail/provider secret cho client production.

---

# 39. OpenAPI / Swagger

Backend **SHOULD** duy trì Swagger/OpenAPI cho Customer API khi project đã có setup phù hợp.

DTO, auth requirement, response và error example nên được mô tả đủ để Web/Mobile hiểu contract.

Swagger là hỗ trợ documentation, **không thay thế** `endpoint-api.md` về ownership/phân công và business decision còn TBD.

---

# 40. Test organization

Backend tests **MUST** nằm dưới:

```text
apps/api/test/
```

Cấu trúc:

```text
apps/api/test/
├── unit/<feature>/
├── integration/<feature>/
└── e2e/
```

Tên file:

```text
*.spec.ts
*.e2e-spec.ts
```

**MUST NOT** đặt business test trong `apps/api/src/`.

---

# 41. Test requirement cho endpoint

Test phải kiểm tra behavior thật, không chỉ kiểm tra “200 OK”.

Ví dụ Booking cần cân nhắc:

### Happy path

- trip hợp lệ;
- ghế hợp lệ;
- quote đúng;
- booking/ticket được tạo.

### Negative/edge case

- trip không tồn tại;
- trip không còn bookable;
- ghế vừa bị người khác giữ;
- ghế duplicate;
- promotion hết hạn;
- customer truy cập booking người khác;
- retry create không tạo trùng nếu dùng idempotency;
- transaction rollback nếu tạo ticket thất bại giữa chừng.

Khi sửa bug, **SHOULD** thêm regression test tái hiện bug.

Không tạo test trivial chỉ để tăng coverage.

---

# 42. Frontend handling theo loại lỗi

Frontend **SHOULD** xử lý lỗi theo semantics thay vì một toast chung.

| Error code | UX mong đợi |
|---|---|
| `VALIDATION_ERROR` | map lỗi vào field/form |
| `ACCESS_TOKEN_EXPIRED` | interceptor refresh token |
| `UNAUTHORIZED` | yêu cầu đăng nhập lại khi refresh không cứu được |
| `FORBIDDEN` | hiển thị không có quyền / điều hướng phù hợp |
| `SEAT_UNAVAILABLE` | refresh seat map, yêu cầu chọn lại |
| `SEAT_HOLD_EXPIRED` | clear hold, quay lại chọn ghế |
| `PROMOTION_INVALID` | hiển thị ngay vùng promo |
| `BOOKING_NOT_CANCELLABLE` | giữ booking state, giải thích không thể hủy |
| `PAYMENT_PROVIDER_ERROR` | cho retry payment an toàn, không tự tạo booking mới |
| `NETWORK_ERROR` | UI retry/offline phù hợp |

---

# 43. Loading, cancellation và duplicate click

Frontend phải chống người dùng double-click/double-submit ở mutation quan trọng.

Ví dụ:

- disable nút trong lúc create booking;
- disable “Thanh toán” sau khi request đã gửi;
- không gọi nhiều payment create do user bấm liên tục;
- có loading state rõ ràng.

Read request khi user đổi filter/search nhanh **SHOULD** cancel request cũ hoặc bỏ qua response stale để tránh UI hiển thị sai thứ tự.

---

# 44. API service không được chứa UI side effect

Service layer:

```ts
bookingService.create(...)
```

nên trả data/error.

Service **MUST NOT** tự:

- navigate screen;
- show toast;
- open modal;
- mutate component state trực tiếp.

UI/hook/controller của frontend quyết định side effect dựa trên kết quả.

---

# 45. Không dùng mock làm nguồn dữ liệu cuối cùng

Mock/fixture được phép để Web/Mobile code song song khi backend chưa xong.

Nhưng feature chỉ được xem là hoàn thành khi luồng chính là:

```text
UI
→ frontend service
→ API thật
→ NestJS
→ Prisma
→ MySQL
```

Fixture JSON **MUST NOT** còn là nguồn dữ liệu chính khi đánh dấu feature full-stack Done.

---

# 46. Contract freeze giữa hai thành viên

Trước khi mỗi người code API thuộc ownership của mình, hai người phải thống nhất tối thiểu identifier và response mà người còn lại cần.

Ví dụ giữa `trips` và `bookings`:

```text
tripId
seatId
busCompanyId
routeId
departureTime
basePrice/bookable pricing source
trip status
```

Một người **MUST NOT** tự rename `tripId → chuyenXeId` ở public API khi client/người khác đã dựa vào contract tiếng Anh.

Internal Prisma field có thể vẫn là tiếng Việt.

---

# 47. Breaking change

Thay đổi được xem là breaking nếu ví dụ:

- đổi URL;
- đổi HTTP method;
- rename/remove response field;
- đổi field type;
- đổi error code mà client đang dùng;
- thay semantics của status;
- thay pagination format.

Breaking change **MUST** được team thống nhất trước.

Trong giai đoạn khóa luận, ưu tiên sửa contract sớm trước khi nhiều client tích hợp. Khi đã được Web/Mobile dùng, không đổi tùy tiện.

---

# 48. Checklist review một endpoint trước khi merge

Trước khi merge endpoint, reviewer kiểm tra:

- [ ] Đúng module ownership.
- [ ] Đúng `/api/v1`.
- [ ] URL tiếng Anh, resource-oriented.
- [ ] Không tách Web/Mobile vô lý.
- [ ] Có DTO cụ thể.
- [ ] Validation backend đầy đủ.
- [ ] Không dùng `any` tùy tiện.
- [ ] Controller mỏng.
- [ ] Business rule nằm service/domain phù hợp.
- [ ] Không duplicate logic module khác.
- [ ] Authorization/ownership đúng.
- [ ] Không tin price/status/customerId từ client.
- [ ] Date/time đúng ISO 8601.
- [ ] Money không dùng float nghiệp vụ.
- [ ] Response dùng `data` / `meta` chuẩn.
- [ ] Error dùng stable error code.
- [ ] Status code hợp lý.
- [ ] Transaction dùng đúng chỗ.
- [ ] Concurrency xử lý nếu liên quan ghế/booking.
- [ ] Idempotency xử lý nếu request có thể retry.
- [ ] External call không nằm trong DB transaction dài.
- [ ] Không log secret/token/password/OTP.
- [ ] Có test meaningful.
- [ ] API docs/`endpoint-api.md` được cập nhật nếu contract thay đổi.
- [ ] Web/Mobile service có thể dùng contract mà không cần hack riêng theo platform.

---

# 49. Definition of Done cho Customer API

Một endpoint/feature Customer chỉ được đánh dấu **Done** khi các phần phù hợp đã hoàn thành:

1. Contract đã chốt.
2. Controller/service/module đúng kiến trúc.
3. DTO + validation.
4. Prisma/MySQL dùng dữ liệu thật.
5. Authorization/data scope đúng.
6. Business rule được backend kiểm tra.
7. Transaction/concurrency/idempotency được xử lý nếu liên quan.
8. Success/error response đúng convention.
9. Test happy path + negative/edge case quan trọng.
10. Frontend service gọi được API thật.
11. Interceptor xử lý auth/error đúng, không hack riêng feature.
12. Không còn mock làm nguồn dữ liệu chính.
13. CI lint/typecheck/test/build bắt buộc đều pass.

---

# 50. Mẫu contract hoàn chỉnh tham khảo

## 50.1 Request

```http
POST /api/v1/bookings
Authorization: Bearer <access-token>
Content-Type: application/json
Idempotency-Key: 9da2c6d2-...
```

```json
{
  "tripId": 123,
  "seatIds": [10, 11],
  "promotionCode": "SUMMER26",
  "contact": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "email": "a@example.com"
  },
  "holdToken": "hold_abc123"
}
```

## 50.2 Success

```http
201 Created
```

```json
{
  "data": {
    "id": 8801,
    "bookingCode": "VXG8801",
    "status": "PENDING_PAYMENT",
    "tripId": 123,
    "seatIds": [10, 11],
    "pricing": {
      "baseAmount": 500000,
      "discountAmount": 50000,
      "totalAmount": 450000,
      "currency": "VND"
    },
    "createdAt": "2026-09-27T08:30:00+07:00"
  }
}
```

## 50.3 Conflict

```http
409 Conflict
```

```json
{
  "statusCode": 409,
  "error": "SEAT_UNAVAILABLE",
  "message": "Một hoặc nhiều ghế không còn khả dụng.",
  "details": [
    {
      "field": "seatIds",
      "message": "Ghế 11 đã được người khác giữ hoặc đặt."
    }
  ]
}
```

## 50.4 Frontend behavior

```text
SEAT_UNAVAILABLE
→ không tạo booking giả ở client
→ refresh GET /trips/:tripId/seats
→ bỏ ghế không còn khả dụng khỏi selection
→ yêu cầu user chọn lại
```

---

# 51. Quy tắc ngắn gọn cần nhớ

```text
Client gửi lựa chọn.
Backend quyết định business rule.

Client không gửi giá như nguồn sự thật.
Client không gửi trạng thái như nguồn sự thật.
Client không gửi customerId để tự xác định ownership.

Controller mỏng.
Service xử lý nghiệp vụ.
Prisma chỉ ở backend.

Success → data/meta thống nhất.
Error → statusCode + error + message.

401 expired → refresh một lần, single-flight, retry một lần.
403 → không refresh.
409 seat conflict → refresh ghế.

Mutation quan trọng → chống double submit.
Payment/callback → idempotent.
Booking/seat → transaction + concurrency-safe.

Web và Mobile dùng cùng API.
Không tạo backend riêng theo platform.
```
