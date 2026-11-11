# F12 — Handoff Phase 01: API báo cáo doanh thu & RBAC tenant

- **Phase:** `01`
- **Status:** `DONE`
- **Repo root (không worktree):** `E:\Huit_Local\KhoaLuanCuNhan\SourceCode\vexgo`
- **Branch / implementation HEAD / origin/develop SHA:** `feature/tenant-revenue-reporting` / `775492ea693dc3cff7bc3218764d9099321a2c10` / `bc863de26fe9787f91e2078475f97c16d2f6423f`
- **Implementation commit:** `775492e feat(f12): bổ sung API báo cáo doanh thu theo nhà xe`
- **Files / API / Prisma:** thêm `GET /api/v1/revenue-reports`, DTO, controller, service và module; đăng ký module trong `AppModule`; thêm quyền tenant `revenue:read` vào catalog/default của `NHA_XE_ADMIN`; thêm migration `20261022190000_add_revenue_read_permission`. Không đổi Prisma schema.

## Nguồn tiền, phạm vi và công thức

- Sale chỉ lấy từ `ThanhToan` có `loaiGiaoDich=THANH_TOAN`, `trangThai=THANH_CONG`, `laQuyetToanHopLe=true` và `thoiDiemHoanTat` nằm trong khoảng nửa mở theo `Asia/Ho_Chi_Minh`. Paid-late, `CAN_DOI_SOAT`, pending/failed và attempt khác bị loại.
- Ba truy vấn độc lập lấy sale, refund thành công và lịch sử phát hành vé 0đ; tránh nhân bản hàng do JOIN vé × hàng gửi × payment. Mỗi truy vấn áp tenant predicate từ `requireTenantPrincipal(principal)` trước khi tổng hợp.
- Phân bổ sale dùng tổng `Ve.giaThucTe` và `PhieuGuiHang.tongPhi`; hai snapshot phải bằng `DonGiaoDich.tongTien` và `ThanhToan.soTien`. Discount đã nằm trong giá thực nên không trừ lại. Dữ liệu thiếu/mâu thuẫn fail-closed bằng `REVENUE_SOURCE_DATA_INVALID`.
- Refund chỉ lấy `HOAN_TIEN + THANH_CONG` và `thoiDiemHoanTat`; xác minh `veId` thuộc đúng booking/order. Refund giảm doanh thu vé, kể cả booking kèm hàng. Bảng cơ cấu phải tách toàn bộ tiền vé vào dòng vé và chỉ đưa phí gửi hàng vào dòng gửi hàng độc lập/kèm vé; refund giảm dòng vé. Refund pending/failed không bị trừ.
- Vé của booking 0đ được đếm từ status-history system event có lý do chuẩn, đúng chuyển trạng thái, order tổng 0đ và không có payment. Không tạo payment giả; hiện không có writer phát hành gửi hàng 0đ để đếm.
- Tính tiền bằng `Prisma.Decimal`, chỉ nhận VND nguyên, JSON trả tiền dưới dạng chuỗi số nguyên để giữ chính xác. Kiểm tra `grossReceipts - refundAmount = netRevenue` và `netTicketRevenue + netShipmentRevenue = netRevenue`; series có bucket 0 và cùng nhóm thời gian cho chart/bảng.

## API, validation và quyền

- Response `{ data, meta }`; `data` có totals, ba dòng `ticket` / `standaloneShipment` / `accompaniedShipment` và `series`. Dòng vé net phải bằng `netTicketRevenue`; hai dòng gửi hàng net cộng lại bằng `netShipmentRevenue`. Không thêm CSV export route.
- Query: `fromDate` và `toDate` cùng có hoặc cùng vắng mặt; ngày ISO hợp lệ, tối đa 366 ngày inclusive; `groupBy=day|month|quarter`; mặc định từ đầu tháng hiện tại đến business date hiện tại. Giới hạn truy vấn là `[00:00 fromDate, 00:00 ngày sau toDate)` theo `Asia/Ho_Chi_Minh`.
- Tenant chỉ được lấy từ principal đã xác thực. `revenue:read` là tenant scope; mặc định chỉ cho `NHA_XE_ADMIN`. Tenant employee có thể nhận qua effective tenant override; không cấp mặc định cho nhân viên, Customer hoặc Super Admin.
- `AuthorizationGuard` áp role + permission; service gọi `requireTenantPrincipal`. Permission resolver, tenant RBAC service và shared auth-scope functions được reuse, không sửa.

## Database, kiểm tra và rủi ro

- `.env` được đọc an toàn, chỉ xác nhận URL: `DATABASE_URL → 127.0.0.1:3306/vexgo_feature12`; `SHADOW_DATABASE_URL → 127.0.0.1:3306/vexgo_feature12_shadow`. Không ghi secret vào handoff.
- Migration mới đã deploy trên `vexgo_feature12`; `prisma migrate status` báo schema up to date. Không reset, seed, hoặc sửa database khác; không chạy migration trên shadow trong phase này.
- **Targeted UNIT:** `npm run test --workspace @vexgo/api -- test/unit/auth/permission-catalog.spec.ts test/unit/auth/permission-resolver.spec.ts test/unit/auth/effective-role-permission-loader.spec.ts test/unit/revenue-reports/revenue-reports.service.spec.ts test/unit/revenue-reports/revenue-reports.authorization.spec.ts` — **PASS**, 5 files / 50 tests. Bao gồm query tenant scope, mixed/standalone/ticket sale, refund khác kỳ, 0đ, mismatch/duplicate fail-closed, date boundaries, Decimal VND, DTO và RBAC.
- **Quality:** API typecheck PASS; API lint PASS; API build PASS (Prisma Client được generate vào thư mục ignored theo cấu hình repo); `git diff --cached --check` PASS; `prisma migrate deploy` PASS; `prisma migrate status` PASS.
- **Integration/E2E/browser/UI automation:** `NOT RUN BY REQUEST`. Chưa gọi API runtime và chưa kiểm chứng dữ liệu MySQL qua endpoint; migration status không chứng minh report runtime.
- **GitNexus:** pre-edit `AppModule` impact LOW/exact; permission catalog/default symbols trả `UNKNOWN` do object-property references, sau đó callers được xác nhận bằng text search. Final `detect_changes(scope=all)` báo `HIGH`, 8 affected flows; đã đọc cả 8 trace. Các trace đi từ GetReport qua date/range helpers và shared tenant-principal checks; không sửa các helper/auth guard/resolver dùng chung. Index cảnh báo process-flow coverage bị giới hạn: 893/1093 entrypoint candidates chưa được xếp hạng và 70 walks bị budget cut; vì vậy absence khỏi graph không được xem là không ảnh hưởng. Git hook báo indexed HEAD cũ `aea55ea` dù đã chạy index-only trước detect; hook không chặn commit.
- Tự review: không có tenant id trong DTO; không có query không tenant-scoped; không có float money, mock runtime, export endpoint, secret, generated file hoặc DB dump được stage. Initial checks bắt incorrect Prisma import và test expectations cũ của catalog; đã sửa và chạy lại focused tests thành công.

## Bàn giao tiếp theo

- **Manual UI smoke:** UI chưa thuộc Phase 01. Chưa có UI/API runtime PASS; checklist cho Admin `3018` và API `4019` sẽ bàn giao sau Phase 03 để người dùng tự smoke.
- **Open limitations:** chưa có writer hoàn tiền gửi hàng hoặc thu tiền mặt; nếu writer/contract thay đổi cần audit nguồn trước khi gộp vào báo cáo. Event lịch sử thiếu completion/eligibility marker không được backfill hoặc suy đoán. phpMyAdmin shared đang ở `9090`, không phải `8091`; giữ nguyên shared stack.
- **Git status sau implementation commit:** branch `feature/tenant-revenue-reporting`, ahead 3 so với `origin/develop`; docs handoff/progress commit được thực hiện riêng sau implementation commit.
- **Next phase:** `02` — đọc lại `MASTER_SPEC.md`, `handoff/PROGRESS.md`, handoff này và chỉ `spec/PHASE_02_ADMIN_DASHBOARD.md`; trước UI đọc `apps/admin/AGENTS.md`, `apps/admin/DESIGN.md`, áp dụng skill `ui-ux-pro-max`, kiểm tra shared components/tokens. Không đọc spec Phase 03 trong Phase 02.
- **Resume sau compact:** xác nhận branch/status/HEAD; đọc `MASTER_SPEC.md`, `handoff/PROGRESS.md`, file handoff Phase 01 này và chỉ spec của phase đang chạy; không chạy integration/E2E/browser/UI tests.
