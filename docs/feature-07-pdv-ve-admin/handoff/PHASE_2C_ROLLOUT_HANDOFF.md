# PR #35 — Phase 2C Rollout Contract Handoff

## Kết luận

Phase 2B đã vô tình biến `prisma/rollouts/add-booking-read-permission.mjs` thành script chỉ chạy được trên `FEATURE07_TEST_DATABASE_URL`. Điều này làm hỏng contract vận hành trước đó của `npm run rollout:booking-read`. Phase 2C tách test mode khỏi operator mode và khôi phục rollout có xác nhận tới database hợp lệ.

## Contract trước và sau

- Contract trước Phase 2B yêu cầu `DATABASE_URL` và `MIGRATION_URL` cùng host, port, schema; shadow phải là database khác; từ chối schema gốc `vexgo`; và yêu cầu `BOOKING_READ_PERMISSION_ROLLOUT_CONFIRM_DATABASE` khớp chính xác schema. Local CI chấp nhận port 3306/3307 với schema `vexgo_feature07*`; local ngoài CI chấp nhận port 3307 với schema này. Host remote được phép nếu operator xác nhận chính xác target.
- Phase 2B yêu cầu `DATABASE_URL` trùng chính xác `FEATURE07_TEST_DATABASE_URL`, đồng thời áp dụng scoped test-account guard. Vì vậy script CLI không còn dùng được cho database vận hành hợp lệ.
- Phase 2C thêm `BOOKING_READ_PERMISSION_ROLLOUT_TEST_MODE=true` chỉ cho tiến trình integration test. Mode này vẫn đòi URL chính xác của test DB cô lập, account/schema test được phép, và runtime/shadow khác test target. Integration test đặt mode này tường minh.
- Khi test mode không bật, script giữ confirmation guard, yêu cầu runtime và migration cùng target, shadow riêng, và từ chối schema gốc. So sánh schema không phân biệt hoa/thường để nhận diện alias. Local non-CI cho phép port 3010 (worktree) hoặc port legacy 3307 với schema `vexgo_feature07*`; CI giữ port 3306/3307. Target remote tiếp tục được chấp nhận khi operator xác nhận đúng schema.
- Script chỉ tự chạy khi được gọi trực tiếp; import trong unit test không kết nối database. Redaction tiếp tục che username/password trong lỗi.

## Regression tests

Đã thêm 11 regression tests cho operator target local port 3010 và remote target có xác nhận đúng; test mode hợp lệ; và các target bị từ chối gồm runtime, shadow kể cả tên schema khác hoa/thường, schema gốc, schema local tùy ý, host/port tùy ý, root account, migration lệch target và confirmation không khớp. Migration URL chỉ khác hoa/thường được xác nhận là cùng target hợp lệ. Các test operator chỉ gọi `assertSafeTargets`; không gọi rollout hoặc kết nối database.

## Database và kết quả kiểm thử

DB target được xác minh từ `.env` nhưng không ghi credential vào báo cáo: test `127.0.0.1:3010/vexgo_feature07_test`, user scoped `vexgo_feature07_test`; quyền là `USAGE ON *.*` và `ALL PRIVILEGES ON vexgo_feature07_test.*`. Runtime/MIGRATION là schema `vexgo_feature07`; shadow là `vexgo_feature07_shadow`. Container riêng của worktree đang publish MySQL tại `127.0.0.1:3010`.

65 test Phase 2B đã chạy lại, tất cả PASS: 40 guard/unit, 14 Feature 07 bookings/tickets DB, 1 rollout/permission DB, 6 promotions API DB, 4 promotion schema DB. Thêm 11 regression unit tests Phase 2C; cả 11 PASS. Tổng cộng 76 test khác nhau PASS, 0 FAIL, 0 SKIP. Các DB suite chạy tuần tự trên schema test; không chạy migration, seed, reset, drop hay rollout trên runtime DB.

Lệnh đã chạy trong `apps/api`:

```text
npm run test -- test/unit/promotions/promotion-test-database.spec.ts test/unit/admin-rbac/feature07-test-database.spec.ts test/unit/admin-rbac/booking-read-rollout-guard.spec.ts
npm run test -- test/integration/bookings/admin-bookings-tickets-db.spec.ts
npm run test -- test/integration/admin-rbac/booking-permission-rollout-db.spec.ts
$envFile = Get-Content ..\..\.env; $testLine = $envFile | Where-Object { $_.StartsWith('FEATURE07_TEST_DATABASE_URL=') } | Select-Object -First 1; $env:DATABASE_URL = $testLine.Substring('FEATURE07_TEST_DATABASE_URL='.Length).Trim(); npm run test -- test/integration/promotions/promotions-api.spec.ts
$envFile = Get-Content ..\..\.env; $testLine = $envFile | Where-Object { $_.StartsWith('FEATURE07_TEST_DATABASE_URL=') } | Select-Object -First 1; $env:DATABASE_URL = $testLine.Substring('FEATURE07_TEST_DATABASE_URL='.Length).Trim(); npm run test -- test/integration/promotions/promotion-schema.spec.ts
npm run test -- test/unit/admin-rbac/booking-read-rollout-guard.spec.ts
npm run typecheck
npm run lint
npm run build
```

Typecheck, lint và API build đều PASS. Build sinh Prisma Client rồi Nest build hoàn tất. Không có blocker kiểm thử còn lại.

## File và artifact

Code/test thay đổi thuộc Phase 2B/2C nằm trong patch local tại `PHASE_2B_2C_REVIEW.patch`, gồm cả các file mới và báo cáo handoff Phase 2B/2C. Patch và các báo cáo chưa stage. Merge vẫn mở trên branch `feature/admin-bookings-tickets`; không commit/push và không resolve GitHub conversations.
