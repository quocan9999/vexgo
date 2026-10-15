# Phase 03 Handoff — Admin UI

- Status: **DONE — browser smoke chưa xác minh**.
- Worktree: `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo-feature10`
- Branch: `feature/tenant-promotions`
- Base: `origin/develop` `0a2888f9e836fc40c6b5f057cce517802dd7d6fb`.
- Starting commit: Phase 02 `1f93a8f`.
- Commit: commit chứa handoff này; SHA được báo sau khi commit.
- Scope: Admin tenant promotion management only. Không thêm migration, không sửa DB, Customer Web, booking consumption, payment hoặc promotion edit/delete.

## Delivered

- Thêm route `/promotions` trong Admin, được bọc bởi `AdminSessionGuard` và yêu cầu `promotion:read`.
- Thêm mục sidebar chỉ hiện trong tenant scope có `promotion:read`; `promotion:create` và `promotion:update` lần lượt chỉ mở quyền tạo và đổi trạng thái. Platform Super Admin không nhận link hoặc quyền tenant.
- Nối list/detail/create/status với API Phase 02 qua `adminApiFetch` và `/api/v1/promotions`; validate envelope `data/meta`, query search/status/sort/page, và giữ structured API errors.
- Thêm tìm kiếm debounce 300 ms, status filter, pagination 10 dòng, loading/error/empty/retry states và hủy request cũ để kết quả search cũ không ghi đè kết quả mới.
- Thêm form phần trăm/số tiền, validation frontend (decimal giữ dạng chuỗi, không dùng floating point), error summary liên kết tới field, giữ giá trị sau lỗi server và chặn submit trùng. Payload tạo không có trường `status`; giao diện nói rõ promotion mới luôn bắt đầu `HOAT_DONG`.
- Thêm detail chỉ đọc, tách trạng thái quản trị khỏi hiệu lực tính toán, trạng thái confirmation trước khi gọi PATCH, xử lý lỗi 409 và làm mới list/detail. Không có edit/delete.
- Desktop dùng bảng, mobile dùng card; reuse shared Admin dialogs/actions/pagination/status/filter components và token từ `apps/admin/DESIGN.md`.

## Verification

- Admin promotion/access/hook/service + tenant/platform navigation targeted tests: **24/24 PASS**.
- `npm run typecheck --workspace=@vexgo/admin`: **PASS** (`next typegen` + `tsc --noEmit`).
- `npm run lint --workspace=@vexgo/admin`: **PASS**.
- API promotion/RBAC integration tests (unchanged API): **28/28 PASS**.
- Full Admin suite (run trước lượt thêm các test tập trung cuối phase): **360/364 PASS**; bốn lỗi async ở các test cũ trong `admin-accounts-management`, `bus-company-permissions`, `customer-shipments`, `customer-tickets`. Chạy riêng bốn file đó sau đó: **37/37 PASS**. Không sửa test hoặc code ngoài scope.
- Browser smoke: **BROWSER SMOKE CHƯA XÁC MINH**. `localhost:3011` và `localhost:4010` không có server lắng nghe; Playwright và Puppeteer không cài trong workspace.
- Phase 03 không thay đổi DB/migration và không truy cập database trong lúc UI work.

## Self-review and risks

- GitNexus trước khi sửa báo `getRequiredAdminPermissions`, `AdminSessionGuard`, `useAdminPermissions`, `SuperAdminLayout` và layout props ở mức **CRITICAL** do là điểm dùng chung. Sau re-index, impact cho `PromotionsManagement`/`getRequiredAdminPermissions` hiển thị **CRITICAL**, 173 symbols, 58 processes, 20 modules. Không đổi guard/hook; chỉ khai báo route permission, thêm section metadata, route và page mới. Tenant reader, create-only action, update-only action, platform isolation, direct guarded route và sidebar được kiểm tra bằng tests.
- `ADMIN_OPERATION_SECTIONS` trả `UNKNOWN` (caller graph trống); xác nhận consumer bằng text search/source: `getFirstAccessibleAdminPath` và `SuperAdminLayout` đọc section metadata. GitNexus cảnh báo 771 cross-language field sites và bỏ trace nhiều flow/callee; không dùng kết quả trống để kết luận không ảnh hưởng.
- `detect-changes --scope all`: 16 files, 195 symbols, 3 affected flows, overall risk **medium**.
- `apps/admin/AGENTS.md` tham chiếu `docs/ADMIN_TENANCY_AND_OPERATIONS.md`, nhưng tài liệu đó không có trong worktree/ZIP. Áp dụng quy tắc tenant từ hướng dẫn repo và `MASTER_SPEC.md`; cần bổ sung tài liệu vận hành này ở phase phù hợp nếu nội dung tồn tại ở nguồn khác.
- Chưa xác minh giao diện bằng browser thật. Không đánh dấu Feature 10 là READY ở Phase 06 nếu browser smoke chưa chạy thành công.

## Files

- Added: `apps/admin/src/app/promotions/page.tsx`.
- Added: `apps/admin/src/features/promotions/{components,hooks,services,types}/...` and `promotions.module.css`.
- Updated: `apps/admin/src/features/admin-auth/services/admin-access.ts` and `apps/admin/src/features/super-admin-layout/components/super-admin-layout.tsx`.
- Added/updated: Admin tests for promotion route access, sidebar isolation, form/status permissions, list request ordering, and API service contract.
- No `.env`, root repository, migration, database, archive, or other feature code was changed.

## Next

Proceed to Phase 04. Read `MASTER_SPEC.md`, this handoff, and only `spec/PHASE_04_BOOKING_CONSUMPTION.md` before work. Keep the feature tenant-scoped, reuse the shared API, and do not push, create a PR, or merge.
