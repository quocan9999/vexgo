# Quy tắc phát triển VexGo

Các quy tắc này áp dụng cho toàn repository và bổ sung cho hướng dẫn riêng trong từng app. Trước khi sửa code, hãy đọc hướng dẫn tại khu vực liên quan. Khi sửa `apps/web` hoặc `apps/admin`, MUST đọc `AGENTS.md` cục bộ của app nếu tồn tại. Khi cần xác minh hành vi riêng theo phiên bản Next.js, SHOULD ưu tiên tài liệu chính thức tương ứng với phiên bản project đang dùng.

## 1. Kiến trúc và nguồn sự thật

- `apps/web` là Customer Web; `apps/admin` là Admin Web; `apps/api` là backend NestJS dùng chung. Hai client có thể có UI/UX và use case khác nhau nhưng MUST dùng chung API, database, domain và business rules.
- MUST NOT tạo backend, database, Prisma model hoặc bản sao business logic riêng cho Admin hay Customer.
- Backend service là nguồn sự thật cho business rules. Frontend có thể tính dữ liệu xem trước hoặc kiểm tra để cải thiện UX, nhưng backend MUST xác thực lại trước khi ghi dữ liệu.
- Luồng chuẩn:

  ```text
  Admin/Customer UI → frontend service/API layer → NestJS Controller
                    → NestJS Service → Prisma → MySQL
  ```

## 2. Backend modules và trách nhiệm

- Mỗi domain/feature MUST nằm trong module riêng dưới `apps/api/src/`, đặt tên bằng tiếng Anh dạng kebab-case, ví dụ `bus-companies/`, `vehicles/`, `routes/`, `trips/`, `bookings/`, `tickets/`, `customers/`, `employees/`, `promotions/`, `shipments/`, `payments/`, `auth/`.
- Module nghiệp vụ SHOULD có `*.module.ts`, `*.controller.ts`, `*.service.ts` và `dto/` khi cần DTO. MUST NOT gom mọi controller, service hoặc DTO vào các thư mục dùng chung theo loại.
- Controller MUST chỉ nhận request, đọc params/query/body, gọi service và trả response. Business logic và truy vấn Prisma thuộc service/backend layer phù hợp; MUST NOT đặt business logic hoặc truy vấn phức tạp trong controller.
- Chỉ backend được truy cập Prisma. Frontend MUST gọi API, không import Prisma Client.

## 3. API contract, validation và response

- Toàn bộ REST API MUST dùng prefix `/api/v1`. URL dùng tiếng Anh, kebab-case khi cần; resource dùng chung MUST dùng endpoint chung, không tự tách `/admin` và `/customer`. Chỉ tạo endpoint riêng khi use case nghiệp vụ thực sự khác nhau.
- Ví dụ hợp lệ: `GET /api/v1/bus-companies`, `GET /api/v1/routes`, `GET /api/v1/trips`, `GET /api/v1/trips/search`. Tránh `/api/getTrips`, `/api/adminTrip` hoặc `/api/customer/routes` nếu không có lý do nghiệp vụ rõ ràng.
- Trước khi nối một flow full-stack, MUST thống nhất method, URL, params/query/body, success response, error response và quyền truy cập. Khi contract thay đổi, cập nhật tài liệu liên quan.
- Input quan trọng MUST có DTO phù hợp; dùng `class-validator` và bật `ValidationPipe` toàn cục. MUST tránh `any` cho input nếu có thể. Validation ở frontend chỉ phục vụ UX; backend MUST validate lại.
- Response thành công MUST theo một envelope thống nhất. Resource đơn:

  ```json
  { "data": { "id": 1 } }
  ```

  Danh sách phân trang:

  ```json
  {
    "data": [{ "id": 1 }],
    "meta": { "page": 1, "pageSize": 10, "totalItems": 50, "totalPages": 5 }
  }
  ```

- MUST dùng `data` và `meta` theo quy ước trên; không tự đặt `result`, `payload`, `responseData` hoặc `items` làm envelope riêng cho feature.
- Error response MUST thống nhất dạng:

  ```json
  { "statusCode": 404, "error": "BUS_COMPANY_NOT_FOUND", "message": "Không tìm thấy nhà xe." }
  ```

  Lỗi validation có thể thêm `details`, mỗi phần tử gồm `field` và `message`; dùng mã lỗi `VALIDATION_ERROR`, ví dụ:

  ```json
  {
    "statusCode": 400,
    "error": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "details": [{ "field": "email", "message": "Email không hợp lệ." }]
  }
  ```
- Query phân trang/tìm kiếm/sắp xếp MUST dùng `page`, `pageSize`, `search`, `sortBy`, `sortDirection` (`asc` hoặc `desc`). Filter riêng cho nghiệp vụ có thể bổ sung như `status`, `busCompanyId`, `routeId`, `departureDate`.

## 4. Frontend và dữ liệu mock

- Feature frontend SHOULD theo cấu trúc `features/<feature>/` với `components/`, `services/`, `types/` và `hooks/` khi cần. Nếu feature có service, MUST gọi API qua service thay vì rải `fetch` trong React component.
- Component tập trung vào render, state UI, form, tương tác và các trạng thái loading/error/empty/success. MUST NOT nhúng business logic backend vào component.
- Mock/fixture được phép khi dựng UI. Feature chỉ hoàn thành khi nguồn dữ liệu chính đi theo luồng UI → API thật → backend → Prisma → MySQL; MUST NOT coi giao diện chạy bằng fixture JSON là feature full-stack hoàn chỉnh.

## 5. Business rules và dữ liệu

- Các quyết định như ghế còn trống, giá vé, khuyến mãi hợp lệ, trạng thái vé, quyền thao tác và phí gửi hàng MUST do backend service quyết định và kiểm tra lại trước khi ghi database.
- `prisma/schema.prisma` là nguồn chính của schema ứng dụng. Khi đổi schema, MUST xem ảnh hưởng đến cả Admin và Customer, cập nhật schema và tạo migration phù hợp. MUST NOT chỉnh database bằng phpMyAdmin mà bỏ qua Prisma; MUST NOT sửa migration đã được team sử dụng, trừ khi cả team thống nhất reset database dev.
- Prisma model/field hiện có dùng tiếng Việt; MUST giữ naming hiện tại, không đổi hàng loạt sang tiếng Anh nếu chưa có quyết định refactor chính thức. File Prisma Client sinh tự động không được sửa thủ công.
- MUST dùng Prisma transaction cho phần cập nhật database của một thao tác nghiệp vụ ghi nhiều bảng cần all-or-nothing, như tạo chuyến và ghế chuyến, booking, hủy vé và hoàn tiền, cập nhật trạng thái thanh toán cùng booking/vé, tạo phiếu gửi hàng cùng hàng hóa, hoặc áp dụng khuyến mãi trên nhiều record. MUST NOT lạm dụng transaction cho CRUD đơn giản trên một bảng.
- MUST NOT hard-delete dữ liệu nghiệp vụ còn lịch sử hoặc đang được tham chiếu. Ưu tiên trạng thái như `ACTIVE`, `INACTIVE`, `CANCELLED`, `DISABLED` khi phù hợp với domain.

## 6. Concurrency và tính nhất quán đặt chỗ

- Nghiệp vụ giữ ghế, đặt vé và xác nhận vé MUST xử lý race condition ở backend/database. MUST NOT dựa vào trạng thái ghế frontend đã tải để kết luận ghế còn trống.
- Backend MUST kiểm tra và giữ/cập nhật trạng thái ghế bằng thao tác atomic hoặc trong cùng transaction trước khi tạo booking/vé. SHOULD dùng transaction và database constraint phù hợp để ngăn bán một ghế của một chuyến cho nhiều người.
- Khi ghế vừa được người khác giữ hoặc đặt, API MUST trả lỗi nghiệp vụ rõ ràng (ví dụ `409 SEAT_UNAVAILABLE`) để frontend yêu cầu chọn ghế khác.

## 7. Idempotency và external services

- Các thao tác có thể được gửi lại như tạo payment, payment callback/webhook và xác nhận booking SHOULD có cơ chế idempotency, ví dụ idempotency key hoặc mã sự kiện/giao dịch từ provider được lưu và ràng buộc duy nhất.
- MUST NOT giữ database transaction mở trong lúc chờ network call tới payment gateway hoặc external service.
- External call, callback và retry MUST được thiết kế để xử lý lặp không tạo payment, booking hoặc vé trùng.
- Payment callback MUST xác minh chữ ký và trạng thái/giao dịch từ provider trước khi cập nhật dữ liệu; MUST NOT tin dữ liệu xác nhận chỉ đến từ frontend.

## 8. Ngày giờ và tiền

- API MUST dùng format thống nhất: timestamp theo ISO 8601 có `Z` hoặc offset; ngày không có giờ dùng `YYYY-MM-DD`.
- Backend MUST quyết định timezone và logic thời gian nghiệp vụ theo timezone được cấu hình. Frontend chỉ định dạng dữ liệu nhận được, MUST NOT tự suy diễn timezone để quyết định nghiệp vụ.
- MUST NOT dùng floating-point cho phép tính tiền nghiệp vụ. Dùng `Decimal` tương ứng MySQL `DECIMAL` hoặc số nguyên theo đơn vị tiền nhỏ nhất; quy tắc làm tròn MUST được xác định thống nhất ở backend.

## 9. Authentication, authorization và CORS

- Authentication xác định ai đăng nhập; authorization xác định người đó được làm gì. Backend MUST kiểm tra quyền và phạm vi dữ liệu; ẩn nút ở frontend không thay thế kiểm tra quyền.
- Thiết kế quyền phải hỗ trợ Customer chỉ thao tác dữ liệu của mình, Admin nhà xe chỉ thao tác dữ liệu thuộc nhà xe đó, và Super Admin có phạm vi toàn hệ thống.
- API chạy local tại `http://localhost:4000`; cấu hình CORS phải cho phép Customer `http://localhost:3000` và Admin `http://localhost:3001`. Dùng env khi phù hợp và MUST NOT hard-code production origin.

## 10. Phối hợp trong team

- Trước khi sửa backend module, MUST kiểm tra module và endpoint hiện có. Khi nhiều người cùng làm một module, thống nhất contract, ownership của feature và cách reuse domain/service logic trước khi code; MUST NOT tạo endpoint hoặc service trùng.
- Admin và Customer dùng chung domain/model hiện có như `NhaXe`, `TuyenXe`, `ChuyenXe`, `Ve`, `KhuyenMai`, `ThanhToan`, `KhachHang`; khác biệt về giao diện hoặc quyền không phải lý do tạo domain/database riêng.
- Backend code và API URL dùng tiếng Anh; MUST NOT trộn tiếng Việt và tiếng Anh trong URL. TypeScript SHOULD dùng kiểu cụ thể thay cho `any`.

## 11. Test organization

- Backend tests MUST nằm dưới `apps/api/test/`; MUST NOT đặt `*.spec.ts` hoặc `*.e2e-spec.ts` trong `apps/api/src/`.
- Unit tests MUST đặt tại `apps/api/test/unit/<feature>/`; integration tests MUST đặt tại `apps/api/test/integration/<feature>/`; e2e tests MUST đặt tại `apps/api/test/e2e/`.
- Unit và integration tests dùng tên `*.spec.ts`; e2e tests dùng tên `*.e2e-spec.ts`.
- Test structure SHOULD mirror domain/feature tương ứng trong `apps/api/src/` khi phù hợp.
- Unit tests SHOULD cô lập class/function đang kiểm tra và mock dependency khi phù hợp. Integration tests MAY boot Nest module/application để kiểm tra nhiều component phối hợp. E2e tests SHOULD kiểm tra flow ở mức HTTP/API gần với client thật.
- MUST NOT tạo duplicate test chỉ vì đổi loại test; MUST NOT đặt business test trong `api-foundation` nếu test thuộc feature riêng.

## 12. Definition of Done

Một feature full-stack chỉ hoàn thành khi có các phần phù hợp với scope: UI/UX; frontend service gọi API thật; NestJS controller/service; DTO và validation; Prisma/MySQL; business rules được kiểm tra ở backend; loading, error, empty (nếu phù hợp) và success feedback; test cho logic quan trọng; không còn mock làm nguồn dữ liệu chính; và cập nhật tài liệu nếu API contract thay đổi.

- PR MUST pass các GitHub Actions CI checks bắt buộc trước khi merge. MUST NOT bypass, disable hoặc weaken test/lint/typecheck/build chỉ để đạt trạng thái xanh.

## Nguyên tắc cốt lõi

**ONE DATABASE · ONE BACKEND · ONE BUSINESS RULE · ONE API CONVENTION**

**DIFFERENT UI/UX · DIFFERENT USE CASE · DIFFERENT PERMISSION**

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vexgo** (797 symbols, 1505 relationships, 52 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/vexgo/context` | Codebase overview, check index freshness |
| `gitnexus://repo/vexgo/clusters` | All functional areas |
| `gitnexus://repo/vexgo/processes` | All execution flows |
| `gitnexus://repo/vexgo/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
