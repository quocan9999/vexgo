# PR #23 – Fix Specification trước khi merge

**Repository:** `quocan9999/vexgo`  
**PR:** #23 – Feature/booking and ticket history  
**Base branch:** `develop`  
**Reviewed head:** `e11c3b6f166a7052cd25982f877509dd81b08440`  
**Các commit đã review:**

- `f352d833fa028f3eb957f0c34ddaed124524fef7` – `fix(web): sync home page search fields with query params and auto trigger search`
- `e11c3b6f166a7052cd25982f877509dd81b08440` – `feat: implement booking and ticket history API and integrate customer UI`

## 1. Mục tiêu

Sửa toàn bộ finding của PR #23 để có thể yêu cầu review lại và merge an toàn vào `develop`.

Ưu tiên:

1. Không để người chưa đăng nhập đọc hoặc thay đổi dữ liệu liên hệ.
2. Customer chỉ được đọc booking và ticket thuộc tài khoản của mình.
3. API phải tuân thủ contract `/api/v1`, validation và response envelope thống nhất.
4. Query filter/sort được công bố phải hoạt động đúng, không chỉ được DTO chấp nhận.
5. Home page phải đồng bộ hai chiều với query string, kể cả khi query bị xóa.
6. Bổ sung regression test có khả năng phát hiện các lỗi thực tế nêu trong tài liệu này.
7. Test local không được phụ thuộc database thật; full GitHub Actions CI phải xanh trước khi merge.

## 2. Ngoài phạm vi

Fix này không yêu cầu triển khai thêm các nghiệp vụ chưa có trong PR #23, ví dụ:

- tạo booking mới;
- giữ ghế hoặc xử lý race condition đặt chỗ;
- thanh toán thật;
- hủy/đổi vé;
- trang quản trị liên hệ hoàn chỉnh;
- thay đổi lớn giao diện Customer Web.

Không đổi hàng loạt naming tiếng Việt trong Prisma và không tạo database/backend riêng cho Customer hoặc Admin.

---

## 3. Commit `f352d83` – đồng bộ Home search khi query bị xóa

### File chính

- `apps/web/src/features/home/components/home-page.tsx`

### Bug hiện tại

Effect đồng bộ URL chỉ chạy phần cập nhật state khi còn ít nhất một trong các giá trị:

- `urlOrigin`
- `urlDestination`
- `urlDate`

Flow lỗi:

1. Người dùng tìm chuyến và URL có query.
2. `selectedProvince`, `selectedDistrict`, `selectedPrice` và `hasSearched` được cập nhật.
3. Người dùng bấm Back hoặc điều hướng về `/` làm query rỗng.
4. Effect vẫn chạy nhưng bỏ qua toàn bộ nhánh cập nhật vì cả ba giá trị đều rỗng.
5. Form và danh sách chuyến tiếp tục hiển thị state cũ dù URL không còn tiêu chí tìm kiếm.

### Yêu cầu

- Đồng bộ state cho cả trường hợp query có giá trị và query bị xóa.
- Khi URL trở về `/` không có search query:
  - reset nơi đi và nơi đến;
  - reset ngày về giá trị mặc định hợp lệ theo business timezone;
  - đưa `hasSearched` về trạng thái phù hợp với URL/`initialHasSearched`;
  - không tiếp tục hiển thị kết quả của query cũ.
- Không tạo vòng lặp `router.push` ↔ `useEffect`.
- Dọn timer scroll khi component unmount hoặc query đổi trước khi timer chạy.
- Không thay đổi giao diện hiện tại ngoài behavior đồng bộ state.

### Test bắt buộc

- Load `/` không query → không tự hiển thị kết quả tìm kiếm cũ.
- Load URL có `origin`, `destination`, `date` → form được điền và danh sách chuyến được mở.
- Load URL dùng alias `from`, `to`, `departureDate` → behavior tương đương.
- Điều hướng từ URL có query về `/` → state cũ được reset.
- Thay đổi query liên tiếp → state cuối cùng khớp URL cuối cùng.

### Acceptance

- URL và form không thể lệch nhau sau Back/Forward hoặc client-side navigation.
- Không còn timer scroll chạy sau khi effect đã cleanup.

---

## 4. Commit `e11c3b6` – khóa quyền truy cập Contacts

### File chính

- `apps/api/src/contacts/contacts.controller.ts`
- `apps/api/src/contacts/contacts.service.ts`
- `apps/api/test/integration/contacts/contacts.spec.ts` hoặc test integration tương đương dưới `apps/api/test/integration/contacts/`

### Lỗi bảo mật hiện tại

Các endpoint sau dùng `@OptionalAuth()`:

- `GET /api/v1/contacts`
- `GET /api/v1/contacts/:id`
- `PATCH /api/v1/contacts/:id/status`

Với implementation hiện tại của `AccessTokenGuard`, request không có header `Authorization` được phép đi qua endpoint optional auth. Hậu quả:

- người ẩn danh có thể đọc danh sách yêu cầu liên hệ;
- người ẩn danh có thể đọc họ tên, số điện thoại, email, tiêu đề và nội dung liên hệ;
- người ẩn danh có thể thay đổi trạng thái yêu cầu liên hệ.

Đây là blocker merge mức nghiêm trọng cao.

### Yêu cầu

- Giữ `POST /api/v1/contacts` là public để Customer/guest gửi yêu cầu liên hệ.
- Ba endpoint đọc/cập nhật phải yêu cầu authentication bắt buộc.
- Thêm authorization bằng role/permission phù hợp với hệ thống hiện có; không chỉ kiểm tra “có token”.
- Customer thông thường không được đọc danh sách liên hệ hoặc cập nhật trạng thái.
- Admin nhà xe chỉ được truy cập nếu business đã xác định ownership/phạm vi dữ liệu phù hợp. Nếu `LienHe` chưa có `nhaXeId`, không được tự giả định tenant scope.
- Super Admin hoặc permission quản trị được chốt phải truy cập được.
- Không bỏ global guard hoặc làm yếu guard để test pass.

### Test bắt buộc

Test ở mức HTTP/controller integration với service hoặc Prisma được mock:

- `POST /contacts` không token → được phép, trả `201`.
- `GET /contacts` không token → `401`.
- `GET /contacts/:id` không token → `401`.
- `PATCH /contacts/:id/status` không token → `401`.
- Customer token không có permission → `403`.
- Admin token không có permission cần thiết → `403`.
- Principal có permission hợp lệ → gọi đúng service và nhận response đúng contract.
- Không dùng database thật trong các test này.

### Acceptance

- Không còn endpoint đọc hoặc cập nhật Contacts dùng `@OptionalAuth()`.
- Không thể lấy PII liên hệ bằng request ẩn danh.
- Không thể đổi trạng thái liên hệ nếu thiếu permission.

---

## 5. Commit `e11c3b6` – thực thi đúng `sortBy`

### File chính

- `apps/api/src/bookings/dto/booking-query.dto.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/tickets/dto/ticket-query.dto.ts`
- `apps/api/src/tickets/tickets.service.ts`

### Bug hiện tại

DTO công bố các giá trị sort:

Booking:

- `createdAt`
- `departureTime`
- `totalAmount`

Ticket:

- `createdAt`
- `departureTime`
- `price`

Nhưng cả hai service luôn gửi Prisma:

```ts
orderBy: {
  createdAt: query.sortDirection ?? 'desc',
}
```

Do đó `sortBy` hợp lệ vẫn bị bỏ qua và API trả dữ liệu sai contract.

### Yêu cầu

Chọn một trong hai hướng và giữ contract/tài liệu đồng bộ:

1. Triển khai đầy đủ từng `sortBy` đã công bố; hoặc
2. Chỉ cho phép `createdAt` cho đến khi có cách sort đúng và hiệu quả cho field liên quan.

Nếu triển khai đầy đủ:

- `createdAt` phải sort ở database.
- `totalAmount`/`price` phải map đúng field Decimal hiện có.
- `departureTime` liên quan quan hệ chuyến xe và cặp ngày/giờ; không được tải một page theo `createdAt` rồi sort trong memory vì sẽ làm sai phân trang toàn tập.
- Phải có thứ tự phụ ổn định, ví dụ ID, để pagination không lặp/mất item khi hai record có cùng giá trị sort.
- `sortDirection` phải áp dụng đúng cho mọi field được hỗ trợ.

### Test bắt buộc

Booking và Ticket cần test riêng:

- mặc định sort `createdAt desc`;
- `createdAt asc`;
- từng `sortBy` còn được DTO cho phép phải tạo đúng `orderBy` hoặc đúng kết quả toàn tập;
- giá trị `sortBy` không hỗ trợ → `400 VALIDATION_ERROR`;
- kết quả pagination ổn định khi nhiều record có cùng giá trị sort.

### Acceptance

- Không còn trường hợp API nhận `sortBy` hợp lệ rồi âm thầm bỏ qua.
- DTO, service, frontend type và `docs/nhiem-vu/endpoint-api.md` thống nhất với nhau.

---

## 6. Commit `e11c3b6` – validation `departureDate`

### File chính

- `apps/api/src/bookings/dto/booking-query.dto.ts`
- `apps/api/src/tickets/dto/ticket-query.dto.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/tickets/tickets.service.ts`

### Bug hiện tại

`departureDate` chỉ dùng `@IsString()`. Giá trị như `abc` vượt qua validation, sau đó service tạo:

```ts
new Date(`${query.departureDate}T00:00:00.000Z`)
```

Kết quả là `Invalid Date` được truyền xuống Prisma và input sai có thể biến thành lỗi server `500` thay vì lỗi validation `400`.

### Yêu cầu

- Validate date-only đúng contract `YYYY-MM-DD` ở DTO.
- Ưu tiên `@IsDateString()` kết hợp kiểm tra date-only nghiêm ngặt; không chấp nhận timestamp nếu contract chỉ cho date.
- Từ chối ngày không tồn tại, ví dụ `2026-02-30`.
- Logic khoảng ngày phải dùng helper/timezone convention hiện có nếu business date phụ thuộc `BUSINESS_TIME_ZONE`.
- Không dùng parsing mơ hồ phụ thuộc timezone máy chạy.
- Trả error response thống nhất:

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Dữ liệu không hợp lệ.",
  "details": [
    { "field": "departureDate", "message": "Ngày khởi hành không hợp lệ." }
  ]
}
```

### Test bắt buộc

Áp dụng cho cả Booking và Ticket:

- `2026-10-02` → hợp lệ.
- `abc` → `400`.
- `2026-2-2` → `400` nếu contract yêu cầu đủ `YYYY-MM-DD`.
- `2026-02-30` → `400`.
- timestamp đầy đủ thay vì date-only → `400`.
- request không truyền `departureDate` → hoạt động bình thường.

### Acceptance

- Input ngày sai không đi tới Prisma.
- Không còn lỗi `500` do `Invalid Date` từ query của client.

---

## 7. Commit `e11c3b6` – thống nhất response envelope

### File chính

- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/tickets/tickets.service.ts`
- `apps/api/src/contacts/contacts.service.ts`
- `apps/web/src/features/account/services/bookings.api.ts`
- `apps/web/src/features/account/services/tickets.api.ts`
- `apps/web/src/features/content/services/contact.api.ts`

### Bug hiện tại

Các response đơn đang trả object trần ở một số service, ví dụ:

- `findCustomerBookingById()`
- `findCustomerTicketById()`
- `lookupTicket()`
- `ContactsService.create()`
- `ContactsService.findOne()`
- `ContactsService.updateStatus()`

Trong khi quy ước repository và type phía Web yêu cầu:

```json
{ "data": { "id": 1 } }
```

Ví dụ `bookingsApi.getBookingDetail()` khai báo `Promise<{ data: BookingItem }>` nhưng backend hiện trả `BookingItem` trực tiếp. Khi UI sử dụng method này, `res.data` sẽ là `undefined`.

### Yêu cầu

- Mọi resource đơn trong scope PR phải trả `{ data: resource }`.
- Danh sách phân trang tiếp tục trả `{ data: [...], meta: {...} }`.
- Backend và frontend TypeScript types phải khớp response runtime.
- Không thêm interceptor bọc response nếu nó làm double-envelope các service vốn đã trả `{ data }`.
- Cập nhật tài liệu API nếu ví dụ hiện tại chưa phản ánh đúng response.

### Test bắt buộc

- Booking detail trả đúng `{ data: booking }`.
- Ticket detail trả đúng `{ data: ticket }`.
- Public ticket lookup trả đúng `{ data: ticket }`.
- Contact create/find/update trả đúng `{ data: contact }`.
- List Booking/Ticket/Contact vẫn chỉ có một lớp `data` và giữ đúng `meta`.
- Web API service đọc đúng payload thật, không chỉ dựa vào type assertion.

### Acceptance

- Không còn response đơn object trần trong ba module mới.
- Không có response dạng `{ data: { data: ... } }`.
- Contract backend, Web service và tài liệu giống nhau.

---

## 8. Chất lượng test – không dùng DB thật

### Hiện trạng review

Đã chạy trên reviewed head:

- 17 unit tests API liên quan Booking/Ticket/Contact: pass.
- 53 unit tests Customer Web: pass.
- API typecheck: pass.
- Web typecheck: pass.

Các test hiện tại chưa phát hiện được lỗi auth Contacts, `sortBy`, invalid date và response envelope.

### Yêu cầu

- Unit test phải mock `PrismaService`; không đọc `.env` để kết nối MySQL thật.
- Integration/controller test phải override/mock service, guards hoặc Prisma theo đúng cấp test.
- Không dùng database dev/staging/production thật.
- Nếu cần test Prisma query shape, assert mock được gọi với `where`, `orderBy`, `skip`, `take` chính xác.
- Test phải fail trên implementation cũ và pass sau khi sửa.
- Backend test tiếp tục nằm đúng quy ước:
  - unit: `apps/api/test/unit/<feature>/*.spec.ts`
  - integration: `apps/api/test/integration/<feature>/*.spec.ts`
  - e2e: `apps/api/test/e2e/*.e2e-spec.ts`

### Lệnh kiểm tra tối thiểu

Từ repository root:

```bash
npm run test --workspace=@vexgo/api -- --run \
  test/unit/bookings/bookings.service.spec.ts \
  test/unit/tickets/tickets.service.spec.ts \
  test/unit/contacts/contacts.service.spec.ts

npm run test --workspace=@vexgo/web
npm run typecheck --workspace=@vexgo/api
npm run typecheck --workspace=@vexgo/web
```

Sau khi bổ sung integration test Contacts, thêm đúng path test đó vào lệnh test mục tiêu.

Trước khi yêu cầu review lại phải chạy đầy đủ:

```bash
npm run test --workspace=@vexgo/api
npm run typecheck --workspace=@vexgo/api
npm run lint --workspace=@vexgo/api
npm run build --workspace=@vexgo/api

npm run test --workspace=@vexgo/web
npm run typecheck --workspace=@vexgo/web
npm run lint --workspace=@vexgo/web
npm run build --workspace=@vexgo/web

npm run typecheck --workspace=@vexgo/admin
npm run lint --workspace=@vexgo/admin
npm run build --workspace=@vexgo/admin

git diff --check
```

Không bypass, skip hoặc nới assertion chỉ để CI xanh.

---

## 9. Hoàn thiện Pull Request template

PR #23 hiện có body trống dù repository có `.github/pull_request_template.md`.

Trước khi yêu cầu review lại, cập nhật PR description đầy đủ:

- mô tả mục tiêu Booking/Ticket history và Contact submission;
- Related Issue/Task hoặc `N/A`;
- chọn đúng loại thay đổi: Feature, Bug Fix, Database, UI/UX, Documentation;
- liệt kê thay đổi chính;
- liệt kê các commit theo thứ tự;
- ghi chính xác lệnh test đã chạy và kết quả;
- thêm screenshot/video cho thay đổi UI hoặc giải thích `N/A`;
- ghi rõ có migration tạo bảng `LienHe`;
- ghi rõ các thay đổi API/authorization;
- hoàn thành checklist;
- nêu các phần reviewer cần chú ý.

Không đánh dấu checklist đã hoàn thành nếu chưa có bằng chứng tương ứng.

---

## 10. Migration và schema checklist

PR có migration:

`prisma/migrations/20261001174244_add_contact_requests/migration.sql`

Yêu cầu kiểm tra trước merge:

- Migration chỉ thực hiện thay đổi cần thiết cho feature Contacts.
- Giải thích hoặc loại bỏ các `DROP INDEX` không trực tiếp liên quan nếu chúng là drift ngoài scope.
- Không sửa migration cũ đã được team sử dụng.
- `prisma/schema.prisma` và migration phải đồng bộ.
- Chạy `prisma validate` và kiểm tra migration trên database test tạm/CI nếu pipeline có hỗ trợ; không dùng database thật của người dùng hoặc production.
- Xác minh rollback/recovery plan phù hợp với quy trình của team.

---

## 11. Thứ tự triển khai khuyến nghị

1. Sửa auth/authorization của Contacts và thêm regression test trước.
2. Chuẩn hóa response envelope cho Booking, Ticket và Contact.
3. Siết validation `departureDate` cho hai DTO.
4. Quyết định contract sort và sửa `sortBy` ở hai service.
5. Sửa đồng bộ Home search khi query bị xóa.
6. Rà soát migration `LienHe` và các `DROP INDEX` ngoài scope.
7. Cập nhật `docs/nhiem-vu/endpoint-api.md` nếu contract thay đổi.
8. Chạy test mục tiêu không dùng DB thật.
9. Chạy full API/Web/Admin CI và `git diff --check`.
10. Điền đầy đủ PR template và trả lời từng review thread bằng commit đã sửa.

## 12. Điều kiện để yêu cầu review lại

Chỉ yêu cầu review lại khi:

- query Home bị xóa thì state tìm kiếm cũ được reset;
- các endpoint đọc/cập nhật Contacts yêu cầu auth và permission đúng;
- Customer/anonymous không thể đọc PII hoặc cập nhật trạng thái liên hệ;
- `sortBy` được thực thi đúng hoặc contract được thu hẹp minh bạch;
- `departureDate` sai trả `400 VALIDATION_ERROR`, không thành `500`;
- mọi response đơn trong scope dùng `{ data: ... }`;
- regression tests mới fail trên code cũ và pass trên code sửa;
- test local không kết nối database thật;
- PR description đã điền theo `.github/pull_request_template.md`;
- các review thread đã được trả lời bằng commit cụ thể;
- API/Web/Admin GitHub Actions CI đều xanh trên head/merge result mới;
- branch đã cập nhật với `develop` mới nhất và không có conflict.

## 13. Trạng thái merge tại thời điểm lập spec

- GitHub báo branch có thể merge về mặt Git và không có conflict.
- Các check API/Admin/Web hiện xanh.
- PR vẫn ở trạng thái `BLOCKED` / `REVIEW_REQUIRED`.
- Không được coi CI xanh là đủ để merge khi các finding bảo mật và API contract ở trên chưa được sửa.

