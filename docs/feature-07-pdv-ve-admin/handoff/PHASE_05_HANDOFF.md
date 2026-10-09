# Handoff Phase 05 — Integration acceptance

**Trạng thái:** PASS — acceptance Feature 07 Admin read-only hoàn tất.
**Branch:** `feature/admin-bookings-tickets`
**Worktree:** `E:/Huit_Local/KhoaLuanCuNhan/SourceCode/vexgo-feature07`
**Commit:** handoff acceptance được ghi trong commit docs P05; SHA được liệt kê trong `FINAL_HANDOFF.md`.

## Isolation và runtime

- Worktree đúng branch `feature/admin-bookings-tickets`, tách khỏi repo gốc.
- `DATABASE_URL` và `MIGRATION_URL` → `127.0.0.1:3307/vexgo_feature07`; `SHADOW_DATABASE_URL` → `127.0.0.1:3307/vexgo_feature07_shadow`; test DB → `127.0.0.1:3307/vexgo_feature07_test`. Không ghi password/secret vào handoff.
- Docker project `vexgo_feature07` chỉ chạy MySQL trên host port 3307, volume `vexgo_feature07_mysql_data`. Compose gốc `vexgo` vẫn ở port 3306 và volume `vexgo_mysql_data`; phpMyAdmin gốc vẫn ở 8080. Hai volume đã được kiểm tra riêng.
- Prisma xác nhận 23 migration đã deploy, schema có 45 bảng; `prisma generate` hoàn tất. Không sửa schema/migration.
- API chạy cổng 4001; health trả 200, CORS preflight từ `http://127.0.0.1:3002` trả 204 và cho credentials. Admin chạy cổng 3002; `.env.local` trỏ API 4001.
- API/Admin được kiểm tra với browser fixture chỉ trên test DB. Sau khi đăng xuất và cleanup bằng Prisma, cả runtime DB và test DB đều có 0 account, employee, booking và ticket fixture.
- Không chạy seed, reset hoặc drop. Không ghi vào DB/volume gốc. Không commit env, secret, log, temp file hoặc generated artifact.

## Kiểm tra đã chạy

- `npm ci` — hoàn tất; npm báo 18 advisories (1 moderate, 16 high, 1 critical). Không chạy audit fix hoặc nâng dependency.
- `npx prisma migrate status --schema prisma/schema.prisma` — 23 migration, up-to-date.
- `npx prisma migrate deploy --schema prisma/schema.prisma` — không còn migration pending.
- `npx prisma generate --schema prisma/schema.prisma` — PASS.
- `npm run test --workspace @vexgo/api -- test/integration/admin-rbac/booking-permission-rollout-db.spec.ts test/integration/bookings/admin-bookings-tickets-db.spec.ts` — 2 files, 10 tests passed trên DB test riêng.
- `npm run test --workspace @vexgo/api -- test/integration/admin-rbac/booking-permission-rollout-db.spec.ts test/integration/bookings/admin-bookings-tickets-db.spec.ts test/unit/auth` — 15 files, 144 tests passed.
- `npm run test --workspace @vexgo/admin -- test/booking-management.spec.tsx test/booking-management-access.spec.tsx test/booking-management-query.spec.tsx test/admin-access.spec.tsx test/fare-prices-layout.spec.tsx` — 5 files, 36 tests passed.
- Admin lint, typecheck và production build — PASS.
- API build — PASS.
- Browser smoke với real Admin login → API → Prisma/MySQL test DB xác minh list phiếu, list vé, booking detail/history, ticket detail/history, partial cancellation và pending refund.
- Responsive review tại 1440×900 và 375×667. Mobile document width không vượt viewport. Tests xác minh điều hướng keyboard và semantic controls.
- `git diff --check` — PASS.

## Findings, dependencies và scope

- Feature 07 Admin remains read-only: sáu endpoint Admin đều GET; không thêm mutation booking/ticket, Customer cancellation/timeline hoặc shipment mutation.
- Tenant scoping dùng tenant lấy từ principal ở backend; integration tests dùng Prisma thật trên hai tenant, kiểm tra cross-tenant list/detail/history, permission, date boundary, stable sorting/pagination, cancellation derived state, history baseline, pending refund và shipment summary.
- Customer history writer là dependency ngoài phạm vi; Admin chỉ hiển thị history đã được ghi thật. Refund processor giữ pending khi `REFUND_PROVIDER_URL` chưa được cấu hình; Feature 07 không gửi refund.
- Whole-branch review đã xử lý các Important findings: cleanup partial setup không xóa unscoped record; history 401/403 ẩn detail đã tải; page ngoài phạm vi giữ pagination recovery; shipment khác chuyến cùng tenant trả mismatch/unknown; sort có control accessible trên mobile và có bookedAt cho tab vé.
- GitNexus cảnh báo CRITICAL ở `getFirstAccessibleAdminPath`; giữ booking section appended để bảo toàn landing priority hiện có, với regression tests cho route priority và booking-only tenant. Index graph đang stale một commit và trỏ checkout gốc.
- Không còn blocker trong scope read-only của Phase 01–05. Không push, tạo PR hoặc merge.

## Kết luận

P01–P05 đạt acceptance cho Admin nhà xe theo phạm vi Feature 07. Xem `FINAL_HANDOFF.md` để biết commit SHA, file chính và kết quả cuối.
