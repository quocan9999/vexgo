# PR #35 — Phase 2B: DB test guard handoff

Ngày kiểm tra: 2026-10-19  
Worktree: `vexgo-feature07`  
Branch: `feature/admin-bookings-tickets`

## Trạng thái trước kiểm thử

- `HEAD`: `7bf5adbcb59ca6cf30c5ffa5dda53d8183b291e7`
- `MERGE_HEAD`: `8b339250a95b6825cef591b1d10ae537ba1068f4`
- `origin/develop`: `8b339250a95b6825cef591b1d10ae537ba1068f4`
- Branch backup `backup/feature-admin-bookings-tickets` còn tồn tại.
- Không có unmerged paths. Merge vẫn mở; không commit, push, abort hoặc reset.

## Root cause và thay đổi

1. `admin-bookings-tickets-db.spec.ts` và `booking-permission-rollout-db.spec.ts` chỉ chấp nhận local port `3307`. Guard cũ chỉ kiểm tra loopback và tên schema có hậu tố `test`, không xác minh username; guard ở rollout test cũng không bảo vệ runtime/shadow. Hai suite hiện dùng chung helper `prisma/test-support/feature07-test-database.cjs`.
2. Promotion guard chỉ cho local `vexgo_promotion` trên `3306` hoặc DB CI đã được cấu hình. Nó không có trường hợp cho phép tường minh target F07 tại port `3010`. `promotion-test-database.ts` giờ chỉ nhận target F07 khi URL bằng chính xác `FEATURE07_TEST_DATABASE_URL`, rồi kiểm tra cùng guard về host, port, schema, user và cách ly DB.
3. Rollout script trước đây có thể chấp nhận schema `vexgo_feature07` trên local port hợp lệ khi confirmation khớp tên DB. Script giờ buộc `DATABASE_URL` bằng `FEATURE07_TEST_DATABASE_URL`; `MIGRATION_URL` phải cùng host/port/schema và cùng scoped account; runtime và shadow phải được khai báo, tách khỏi test target, và confirmation phải khớp chính xác tên schema test. Guard chặn trước khi mở kết nối nếu target không đạt điều kiện.

Guard dùng chung chấp nhận local `127.0.0.1:3010/vexgo_feature07_test` với username `vexgo_feature07_test`; từ chối root, runtime schema, sai user, host, port hoặc schema; và từ chối target trùng runtime/migration/shadow. Legacy local port `3307` vẫn giới hạn ở schema `vexgo_feature07*_test` cùng username, còn CI giữ port `3306/3307` nhưng buộc schema và account `vexgo_feature07_ci_test`. Guard cũng yêu cầu runtime và shadow khác nhau. Promotion guard giữ nguyên điều kiện GitHub Actions cho DB CI hiện có.

Các regression tests kiểm tra target F07 hợp lệ, target CI/legacy hợp lệ, target không có cấu hình tường minh, root/sai account, schema runtime hoặc tùy ý, host/port không hợp lệ, DB trùng runtime/migration/shadow, runtime trùng shadow và rollout dùng test target làm `MIGRATION_URL`. Không đặt `CI` hoặc `GITHUB_ACTIONS` để giả lập trong các lệnh DB integration; fixture CI chỉ được truyền trực tiếp vào unit guard.

## DB target và quyền đã xác minh

Credentials đã được ẩn; truy vấn xác minh chỉ đọc:

- Test: `127.0.0.1:3010/vexgo_feature07_test`, user trùng tên schema `vexgo_feature07_test`.
- Runtime: `127.0.0.1:3010/vexgo_feature07`.
- Migration: `127.0.0.1:3010/vexgo_feature07`.
- Shadow: `127.0.0.1:3010/vexgo_feature07_shadow`.
- `DATABASE()`, `CURRENT_USER()` và port trong container khớp test schema/account; port nội bộ MariaDB là `3306` sau khi kết nối qua published port `3010`.
- Grant của test account: `USAGE ON *.*` và `ALL PRIVILEGES ON vexgo_feature07_test.*`; không có quyền global ngoài `USAGE`, không có grant trên runtime hoặc shadow schema.

Các integration suite có ghi fixture/permission chỉ kết nối test schema trên. Không chạy migration, seed, reset, drop hoặc thay đổi runtime database. `npm run build` chạy `prisma generate`, không kết nối DB.

## Kết quả kiểm thử cuối

| Lệnh | Kết quả |
| --- | --- |
| `npm run test -- test/unit/promotions/promotion-test-database.spec.ts test/unit/admin-rbac/feature07-test-database.spec.ts` | PASS — 2 files, 40 passed, 0 failed, 0 skipped |
| `npm run test -- test/integration/bookings/admin-bookings-tickets-db.spec.ts` | PASS — 14 passed, 0 failed, 0 skipped |
| `npm run test -- test/integration/admin-rbac/booking-permission-rollout-db.spec.ts` | PASS khi chạy lại — 1 passed, 0 failed, 0 skipped |
| `npm run test -- test/integration/promotions/promotions-api.spec.ts` | PASS — 6 passed, 0 failed, 0 skipped |
| `npm run test -- test/integration/promotions/promotion-schema.spec.ts` | PASS — 4 passed, 0 failed, 0 skipped |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS; Prisma Client generated and Nest build completed |

Lần chạy đầu của rollout integration FAILED ở setup: 0 passed, 1 skipped và một lỗi cấp suite vì helper ban đầu coi `MIGRATION_URL` trỏ test target là overlap. Lỗi xảy ra trước khi rollout mở DB connection. Đã sửa guard để rollout tự xác nhận migration target chính là DB test đã cấu hình; lần chạy lại đạt 1/1. Không có thay đổi DB từ lần chạy lỗi. Trước khi sửa code, unit test promotion mới được chạy theo TDD và tái hiện lỗi cũ: 21 passed, 1 failed vì target F07 hợp lệ bị từ chối.

Tổng kết các lần chạy cuối: 65 tests passed, 0 failed, 0 skipped. Không tính lần rollout fail đầu hoặc test RED trong quá trình sửa vào kết quả pass.

## Git và whitespace

Các thay đổi Phase 2B chưa stage:

- `apps/api/test/integration/admin-rbac/booking-permission-rollout-db.spec.ts`
- `apps/api/test/integration/bookings/admin-bookings-tickets-db.spec.ts`
- `apps/api/test/support/promotion-test-database.ts`
- `apps/api/test/unit/promotions/promotion-test-database.spec.ts`
- `prisma/rollouts/add-booking-read-permission.mjs`
- File mới `apps/api/test/unit/admin-rbac/feature07-test-database.spec.ts`
- File mới `prisma/test-support/feature07-test-database.cjs`
- Báo cáo này

`git diff --check` không phát hiện whitespace issue trong các thay đổi chưa stage. `git diff --cached --check` vẫn báo whitespace trong staged merge index hiện có; 12 cảnh báo nằm trong các tài liệu Feature 07 `spec/*.md`, còn các cảnh báo còn lại thuộc nội dung đã được đưa vào từ develop. Những tài liệu đó không được chỉnh trong Phase 2B.

Merge index vẫn có 272 paths được stage từ bước merge trước; các thay đổi Phase 2B ở trên không được stage. Báo cáo này nằm dưới `docs/`, hiện bị local `.git/info/exclude` loại khỏi status; file được tạo tại worktree để reviewer đọc. Không có blocker còn lại trong phạm vi Phase 2B. Chờ reviewer kiểm tra trước khi tạo merge commit.
